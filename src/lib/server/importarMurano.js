import { createHash } from 'node:crypto';
import readXlsxFile from 'read-excel-file/node';
import { db } from './db.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from './entregaChaves.js';
import { motivoSemAgendamento } from '../unidadeAgendavel.js';

// Importação da base de entrega de chaves (planilha .xlsx) pelo admin, em 2 modos:
//  - "atualizar": casa por bloco+número, só altera os campos que mudaram, cria as unidades novas e NUNCA apaga nada
//    (nem agendamentos, documentos, histórico, nem unidades que não estão na planilha; células em branco não
//    apagam o que já existe);
//  - "sobrescrever": reseta unidades, agendamentos, investidores e histórico e importa do zero (destrutivo).
// Os dois partem de uma PRÉVIA (montarPrevia) que não grava nada.

export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;
export const MAXIMO_UNIDADES = 3000;

const semAcento = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim();

// cabeçalhos aceitos (comparados sem acento/maiúsculas) → campo interno
const CABECALHOS = {
  BLOCO: 'bloco',
  UNIDADE: 'numero',
  TIPOLOGIA: 'tipologia',
  'NOME DO CLIENTE': 'nome',
  'COMPRADOR PRINCIPAL': 'principal',
  ESCRITURA: 'escritura',
  'STATUS QUITACAO': 'quitacao',
  'VISTORIA DE UNIDADE': 'vistoria',
  GRUPO: 'grupo'
};
const STATUS_QUITACAO = { QUITADA: 'quitada', 'A VENCER': 'a_vencer' };

export const ROTULO_CAMPO = {
  tipologia: 'Tipologia',
  statusQuitacao: 'Pagamento',
  compradores: 'Compradores',
  escritura: 'Escritura',
  vistoriaStatus: 'Vistoria',
  grupo: 'Grupo'
};
const CAMPOS = Object.keys(ROTULO_CAMPO);

const texto = (v) => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
};

/** Lê a planilha e devolve as unidades normalizadas (uma por bloco+número), com avisos e erros por linha. */
export async function lerPlanilha(buffer) {
  if (!buffer || buffer.length === 0) throw new Error('Arquivo vazio.');
  if (buffer.length > TAMANHO_MAXIMO_BYTES) throw new Error('Arquivo grande demais (máximo 5 MB).');

  let abas;
  try {
    abas = await readXlsxFile(buffer);
  } catch {
    throw new Error('Não foi possível ler o arquivo. Envie uma planilha Excel (.xlsx).');
  }

  const unidades = new Map();
  const erros = [];
  const avisos = [];
  const colunas = new Set();
  let linhasLidas = 0;

  for (const { sheet, data } of abas) {
    const cab = (data[0] ?? []).map((c) => CABECALHOS[semAcento(c)] ?? null);
    // abas sem BLOCO e UNIDADE (ex.: a legenda da vistoria) são ignoradas
    if (!cab.includes('bloco') || !cab.includes('numero')) continue;
    cab.forEach((c) => c && colunas.add(c));

    data.slice(1).forEach((linha, i) => {
      const n = i + 2; // número da linha na planilha
      const campo = (nome) => linha[cab.indexOf(nome)];
      if (linha.every((c) => c === null || c === undefined || String(c).trim() === '')) return;
      linhasLidas++;

      const bloco = texto(campo('bloco'));
      const numero = texto(campo('numero'));
      if (!bloco || !numero) {
        erros.push({ aba: sheet, linha: n, motivo: 'Bloco ou unidade em branco.' });
        return;
      }
      const chave = `${bloco}::${numero}`;
      const u = unidades.get(chave) ?? { bloco, numero, compradores: [], origens: [] };
      u.origens.push(`${sheet}!${n}`);

      const nome = texto(campo('nome'));
      if (nome && !['N/A', 'NA', '-'].includes(nome.toUpperCase())) {
        u.compradores.push({ nome, principal: /^s/i.test(String(campo('principal') ?? '').trim()) });
      }

      const mescla = (chaveCampo, valor, rotulo) => {
        if (valor === null || valor === undefined) return;
        if (u[chaveCampo] !== undefined && u[chaveCampo] !== valor) {
          avisos.push(`${rotulo} da unidade ${bloco}/${numero} aparece com valores diferentes na planilha ("${u[chaveCampo]}" e "${valor}"): vale o primeiro.`);
          return;
        }
        u[chaveCampo] = valor;
      };
      if (colunas.has('tipologia')) mescla('tipologia', texto(campo('tipologia'))?.toUpperCase() ?? null, 'Tipologia');
      if (colunas.has('quitacao')) {
        const bruto = texto(campo('quitacao'))?.toUpperCase() ?? null;
        const norm = bruto ? semAcento(bruto) : null;
        if (bruto && !STATUS_QUITACAO[norm]) avisos.push(`Pagamento "${bruto}" da unidade ${bloco}/${numero} não reconhecido (esperado QUITADA ou A VENCER): ignorado.`);
        mescla('statusQuitacao', norm ? (STATUS_QUITACAO[norm] ?? null) : null, 'Pagamento');
      }
      if (colunas.has('escritura')) mescla('escritura', texto(campo('escritura')), 'Escritura');
      if (colunas.has('vistoria')) mescla('vistoriaStatus', texto(campo('vistoria')), 'Vistoria');
      if (colunas.has('grupo')) {
        const g = texto(campo('grupo'))?.toUpperCase() ?? null;
        mescla('grupo', g && ['A', 'B'].includes(g) ? g : null, 'Grupo');
      }
      unidades.set(chave, u);
    });
  }

  if (colunas.size === 0) {
    throw new Error('Não encontrei as colunas BLOCO e UNIDADE. Confira se é a planilha da base de entrega de chaves.');
  }
  if (unidades.size === 0) throw new Error('A planilha não tem nenhuma unidade.');
  if (unidades.size > MAXIMO_UNIDADES) throw new Error(`Unidades demais (${unidades.size}); o máximo é ${MAXIMO_UNIDADES}.`);

  // campos cuja coluna não existe na planilha ficam de fora (undefined): não são alterados
  const lista = [...unidades.values()].map((u) => {
    // se ninguém foi marcado como principal, o primeiro comprador é o principal
    if (u.compradores.length > 0 && !u.compradores.some((c) => c.principal)) u.compradores[0].principal = true;
    return u;
  });
  const colunasFaltando = Object.entries({ grupo: 'GRUPO' }).filter(([c]) => !colunas.has(c)).map(([, rotulo]) => rotulo);
  return { unidades: lista, erros, avisos, linhasLidas, colunasPresentes: [...colunas], colunasFaltando };
}

const norm = (v) => (v === undefined || v === '' ? null : v);
const chaveCompradores = (c) => (Array.isArray(c) ? c.map((x) => `${x.principal ? '*' : ''}${x.nome}`).join(' | ') : '');
const rotuloCompradores = (c) => (Array.isArray(c) && c.length ? c.map((x) => `${x.nome}${x.principal && c.length > 1 ? ' (principal)' : ''}`).join(' | ') : null);

/**
 * Junta os compradores do cadastro com os da planilha SEM nunca remover ninguém: quem já está cadastrado fica
 * (a planilha da base lista só o comprador principal de cada unidade, então um co-comprador que não aparece nela
 * não é sinal de que saiu), quem é novo entra, e o principal passa a ser o que a planilha marca.
 */
export function mesclarCompradores(atuais, daPlanilha) {
  const igual = (a, b) => semAcento(a.nome) === semAcento(b.nome);
  const lista = (Array.isArray(atuais) ? atuais : []).map((c) => ({ nome: c.nome, principal: Boolean(c.principal) }));
  for (const c of daPlanilha) if (!lista.some((x) => igual(x, c))) lista.push({ nome: c.nome, principal: false });
  const principal = daPlanilha.find((c) => c.principal);
  if (principal) lista.forEach((x) => (x.principal = igual(x, principal)));
  else if (lista.length > 0 && !lista.some((x) => x.principal)) lista[0].principal = true;
  return lista;
}

/**
 * Diferenças entre a unidade que já existe e a da planilha. Só campos presentes e preenchidos na planilha contam,
 * e nada é apagado: célula em branco é ignorada e compradores só são acrescentados (ver mesclarCompradores).
 * Cada diferença traz `valorNovo`, o valor que será gravado.
 */
export function calcularDiferencas(existente, nova) {
  const dif = [];
  const ignorados = [];
  for (const campo of CAMPOS) {
    if (campo === 'compradores') {
      const atuais = Array.isArray(existente.compradores) ? existente.compradores : [];
      if (nova.compradores.length === 0) {
        if (atuais.length > 0) ignorados.push(campo);
        continue;
      }
      const mesclados = mesclarCompradores(atuais, nova.compradores);
      if (chaveCompradores(mesclados) !== chaveCompradores(atuais)) {
        dif.push({ campo, de: rotuloCompradores(atuais), para: rotuloCompradores(mesclados), valorNovo: mesclados });
      }
      continue;
    }
    if (nova[campo] === undefined) continue; // coluna ausente na planilha
    const novo = norm(nova[campo]);
    const atual = norm(existente[campo]);
    if (novo === null) {
      // célula em branco na planilha: nunca apaga o que já existe
      if (atual !== null) ignorados.push(campo);
      continue;
    }
    if (atual !== novo) dif.push({ campo, de: atual, para: novo, valorNovo: novo });
  }
  return { dif, ignorados };
}

/** Contagens do que seria apagado no modo "sobrescrever". */
async function contagensParaApagar() {
  const [unidades, agendamentos, documentos, procuracoes, presencas, historico, investidores, acompanhantes, emails] = await Promise.all([
    db.unidade.count(),
    db.agendamento.count(),
    db.documentoAssinado.count(),
    db.procuracaoUnidade.count(),
    db.presencaEntrega.count(),
    db.historicoUnidade.count(),
    db.investidor.count(),
    db.acompanhante.count(),
    db.emailEnviado.count()
  ]);
  return { unidades, agendamentos, documentos, procuracoes, presencas, historico, investidores, acompanhantes, emails };
}

/**
 * Prévia (não grava nada): o que cada modo faria com a planilha. `unidades` vem de lerPlanilha.
 * Devolve contagens, a lista de alterações por unidade, as unidades com agendamento/documento em andamento
 * afetadas e um `hash` do resultado (a aplicação confere que nada mudou entre a prévia e a confirmação).
 */
export async function montarPrevia(unidades) {
  const murano = await buscarMurano();
  const existentes = murano
    ? await db.unidade.findMany({
        where: { empreendimentoId: murano.id },
        select: {
          id: true, bloco: true, numero: true, tipologia: true, grupo: true, statusQuitacao: true,
          compradores: true, escritura: true, vistoriaStatus: true,
          agendamentos: { where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES }, status: { not: 'cancelado' } }, select: { status: true, documentosAssinados: { select: { tipo: true, status: true } } } }
        }
      })
    : [];
  const porChave = new Map(existentes.map((u) => [`${u.bloco}::${u.numero}`, u]));

  const novas = [];
  const alteradas = [];
  const afetadas = [];
  let iguais = 0;
  let celulasEmBrancoIgnoradas = 0;
  for (const u of unidades) {
    const atual = porChave.get(`${u.bloco}::${u.numero}`);
    if (!atual) {
      novas.push({ bloco: u.bloco, numero: u.numero, tipologia: u.tipologia ?? null, vistoriaStatus: u.vistoriaStatus ?? null, compradores: u.compradores.length });
      continue;
    }
    const { dif, ignorados } = calcularDiferencas(atual, u);
    celulasEmBrancoIgnoradas += ignorados.length;
    if (dif.length === 0) {
      iguais++;
      continue;
    }
    alteradas.push({ bloco: u.bloco, numero: u.numero, diferencas: dif });
    const ags = atual.agendamentos;
    if (ags.length > 0) {
      const docs = ags.flatMap((a) => a.documentosAssinados);
      const mudaComprador = dif.some((d) => d.campo === 'compradores');
      afetadas.push({
        bloco: u.bloco,
        numero: u.numero,
        agendamentos: ags.map((a) => a.status),
        documentos: docs.map((d) => `${d.tipo}: ${d.status}`),
        mudaComprador,
        gravidade: mudaComprador && docs.length > 0 ? 'alta' : 'media'
      });
    }
  }

  // compradores já cadastrados que NÃO estão na planilha: ficam em Atualizar; somem em Sobrescrever
  let unidadesComCompradoresForaDaPlanilha = 0;
  const compradoresPerdidos = [];
  for (const u of unidades) {
    const atual = porChave.get(`${u.bloco}::${u.numero}`);
    if (!atual || !Array.isArray(atual.compradores)) continue;
    const foraDaPlanilha = atual.compradores.filter((c) => !u.compradores.some((n) => semAcento(n.nome) === semAcento(c.nome)));
    if (foraDaPlanilha.length > 0) {
      unidadesComCompradoresForaDaPlanilha++;
      compradoresPerdidos.push({ bloco: u.bloco, numero: u.numero, nomes: foraDaPlanilha.map((c) => c.nome) });
    }
  }

  const chavesPlanilha = new Set(unidades.map((u) => `${u.bloco}::${u.numero}`));
  const ausentes = existentes.filter((u) => !chavesPlanilha.has(`${u.bloco}::${u.numero}`)).map((u) => ({ bloco: u.bloco, numero: u.numero }));

  const ocultas = unidades
    .map((u) => ({ bloco: u.bloco, numero: u.numero, motivo: motivoSemAgendamento({ vistoriaStatus: u.vistoriaStatus ?? null, compradores: u.compradores }) }))
    .filter((u) => u.motivo);

  const apagar = await contagensParaApagar();
  const resumo = { total: unidades.length, novas: novas.length, alteradas: alteradas.length, iguais, ausentes: ausentes.length, celulasEmBrancoIgnoradas, unidadesComCompradoresForaDaPlanilha };
  const hash = createHash('sha256').update(JSON.stringify({ resumo, novas, alteradas, apagar, ausentes, compradoresPerdidos })).digest('hex').slice(0, 24);
  return { resumo, novas, alteradas, afetadas, ausentes, ocultas, apagar, compradoresPerdidos, hash, existeEmpreendimento: Boolean(murano) };
}

// --- aplicação ---

async function garantirMurano(cliente) {
  const existente = await cliente.empreendimento.findFirst({ where: { nome: { contains: 'Murano', mode: 'insensitive' } } });
  return existente ?? cliente.empreendimento.create({ data: { nome: 'Murano', estagioAtual: 'Entrega das Chaves', etapa: 'entrega_chaves' } });
}

const dadosDeCriacao = (empreendimentoId, u) => ({
  empreendimentoId,
  bloco: u.bloco,
  numero: u.numero,
  tipologia: u.tipologia ?? null,
  grupo: u.grupo ?? null,
  statusQuitacao: u.statusQuitacao ?? null,
  compradores: u.compradores, // fonte de leitura dos documentos; o histórico é só registro
  escritura: u.escritura ?? null,
  vistoriaStatus: u.vistoriaStatus ?? null,
  vistoriaAprovada: semAcento(u.vistoriaStatus) === 'APROVADA',
  observacoes: u.compradores.length === 0 ? 'Sem comprador cadastrado na base importada.' : null
});

async function registrarCadastros(tx, empreendimentoId, unidades, funcionarioId, origem) {
  const comComprador = unidades.filter((u) => u.compradores.length > 0);
  if (comComprador.length === 0) return;
  const criadas = await tx.unidade.findMany({
    where: { empreendimentoId, OR: comComprador.map((u) => ({ bloco: u.bloco, numero: u.numero })) },
    select: { id: true, bloco: true, numero: true }
  });
  const idDe = new Map(criadas.map((c) => [`${c.bloco}::${c.numero}`, c.id]));
  await tx.historicoUnidade.createMany({
    data: comComprador.flatMap((u) =>
      u.compradores.map((c) => ({
        unidadeId: idDe.get(`${u.bloco}::${u.numero}`),
        tipo: 'cadastro',
        descricao: `${c.nome} — ${c.principal ? 'comprador principal' : 'comprador'} (${origem}).`,
        criadoPorId: funcionarioId
      }))
    )
  });
}

/**
 * Modo "atualizar": cria as unidades novas e atualiza só os campos que mudaram. Não apaga nada e não toca em
 * agendamentos, documentos, presenças nem no histórico existente (só acrescenta registros).
 */
export async function aplicarAtualizar(unidades, { funcionarioId, nomeArquivo }) {
  const origem = `importado da planilha ${nomeArquivo}`;
  return db.$transaction(
    async (tx) => {
      const murano = await garantirMurano(tx);
      const existentes = await tx.unidade.findMany({ where: { empreendimentoId: murano.id } });
      const porChave = new Map(existentes.map((u) => [`${u.bloco}::${u.numero}`, u]));

      const novas = unidades.filter((u) => !porChave.has(`${u.bloco}::${u.numero}`));
      if (novas.length > 0) {
        await tx.unidade.createMany({ data: novas.map((u) => dadosDeCriacao(murano.id, u)) });
        await registrarCadastros(tx, murano.id, novas, funcionarioId, origem);
      }

      let atualizadas = 0;
      for (const u of unidades) {
        const atual = porChave.get(`${u.bloco}::${u.numero}`);
        if (!atual) continue;
        const { dif } = calcularDiferencas(atual, u);
        if (dif.length === 0) continue;
        const data = {};
        for (const d of dif) {
          data[d.campo] = d.valorNovo;
          if (d.campo === 'vistoriaStatus') data.vistoriaAprovada = semAcento(u.vistoriaStatus) === 'APROVADA';
        }
        await tx.unidade.update({ where: { id: atual.id }, data });
        await tx.historicoUnidade.create({
          data: {
            unidadeId: atual.id,
            tipo: 'outro',
            descricao: `Atualizada pela importação (${nomeArquivo}): ${dif.map((d) => `${ROTULO_CAMPO[d.campo]}: ${d.de ?? '—'} → ${d.para}`).join('; ')}`,
            criadoPorId: funcionarioId
          }
        });
        atualizadas++;
      }
      return { modo: 'atualizar', criadas: novas.length, atualizadas, iguais: unidades.length - novas.length - atualizadas };
    },
    { timeout: 60000, maxWait: 15000 }
  );
}

/**
 * Modo "sobrescrever" (DESTRUTIVO): apaga unidades, agendamentos, documentos assinados, procurações, presenças,
 * histórico, acompanhantes, pesquisas, e-mails e notificações de investidores e todos os investidores (com as
 * sessões deles) e importa do zero. NÃO mexe em funcionários/sessões da equipe, logs de auditoria, tipos de evento,
 * agenda, atualizações da obra, nem no empreendimento e nos modelos de documento (textos e dados fixos do termo).
 */
export async function aplicarSobrescrever(unidades, { funcionarioId, nomeArquivo }) {
  const origem = `importado da planilha ${nomeArquivo}`;
  return db.$transaction(
    async (tx) => {
      // filhos antes dos pais (chaves estrangeiras)
      await tx.presencaEntrega.deleteMany();
      await tx.procuracaoUnidade.deleteMany();
      await tx.documentoAssinado.deleteMany();
      await tx.pesquisaSatisfacao.deleteMany();
      await tx.acompanhante.deleteMany();
      await tx.emailEnviado.deleteMany();
      await tx.notificacao.deleteMany({ where: { destinatarioTipo: 'investidor' } });
      await tx.agendamento.deleteMany();
      await tx.historicoUnidade.deleteMany();
      await tx.unidadeInvestidor.deleteMany();
      await tx.sessao.deleteMany();
      await tx.unidade.deleteMany();
      await tx.investidor.deleteMany();

      const murano = await garantirMurano(tx);
      await tx.empreendimento.update({ where: { id: murano.id }, data: { etapa: 'entrega_chaves' } });
      await tx.unidade.createMany({ data: unidades.map((u) => dadosDeCriacao(murano.id, u)) });
      await registrarCadastros(tx, murano.id, unidades, funcionarioId, origem);
      return { modo: 'sobrescrever', criadas: unidades.length, atualizadas: 0, iguais: 0 };
    },
    { timeout: 60000, maxWait: 15000 }
  );
}

/** Cópia (JSON, sem arquivos nem senhas) do que o modo "sobrescrever" apagaria — pra guardar antes de confirmar. */
export async function copiaDosDados() {
  const [unidades, agendamentos, documentos, procuracoes, presencas, historico, investidores, acompanhantes] = await Promise.all([
    db.unidade.findMany(),
    db.agendamento.findMany({ select: { id: true, unidadeId: true, status: true, dataHora: true, nomeCompareceu: true, cpfCompareceu: true, telefoneCompareceu: true, emailCompareceu: true, ehProprietario: true, proprietarioNome: true, conjugeNome: true, conjugeEmail: true, retiranteNome: true, retiranteCpf: true, retiranteEmail: true, createdAt: true } }),
    db.documentoAssinado.findMany({ select: { id: true, agendamentoId: true, tipo: true, status: true, docusignEnvelopeId: true, assinadoEm: true } }),
    db.procuracaoUnidade.findMany({ select: { id: true, unidadeId: true, agendamentoId: true, nome: true, cpf: true, origem: true, createdAt: true } }),
    db.presencaEntrega.findMany(),
    db.historicoUnidade.findMany(),
    db.investidor.findMany({ select: { id: true, nome: true, cpf: true, primeiroAcesso: true, termoAceitoEm: true, createdAt: true } }),
    db.acompanhante.findMany({ select: { id: true, agendamentoId: true, nome: true } })
  ]);
  return { geradoEm: new Date().toISOString(), observacao: 'Sem arquivos (PDFs/procurações em base64) e sem senhas.', unidades, agendamentos, documentos, procuracoes, presencas, historico, investidores, acompanhantes };
}

const sTexto = (v, max = 200) => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return t === '' ? undefined : t.slice(0, max);
};

/**
 * Revalida as unidades que voltam do navegador (JSON do formulário de confirmação): nada do que vem do cliente é
 * confiado. Devolve a lista limpa ou lança Error se o formato for inválido.
 */
export function sanitizarUnidades(bruto) {
  if (!Array.isArray(bruto) || bruto.length === 0 || bruto.length > MAXIMO_UNIDADES) throw new Error('Dados da prévia inválidos.');
  const vistos = new Set();
  return bruto.map((u) => {
    const bloco = sTexto(u?.bloco, 20);
    const numero = sTexto(u?.numero, 20);
    if (!bloco || !numero) throw new Error('Dados da prévia inválidos (bloco/unidade).');
    const chave = `${bloco}::${numero}`;
    if (vistos.has(chave)) throw new Error('Dados da prévia inválidos (unidade repetida).');
    vistos.add(chave);
    const compradores = (Array.isArray(u.compradores) ? u.compradores : []).slice(0, 10).map((c) => ({ nome: sTexto(c?.nome), principal: Boolean(c?.principal) })).filter((c) => c.nome);
    const limpa = { bloco, numero, compradores };
    for (const campo of ['tipologia', 'escritura', 'vistoriaStatus']) {
      const v = sTexto(u[campo]);
      if (v !== undefined) limpa[campo] = v;
    }
    if (['quitada', 'a_vencer'].includes(u.statusQuitacao)) limpa.statusQuitacao = u.statusQuitacao;
    if (['A', 'B'].includes(u.grupo)) limpa.grupo = u.grupo;
    return limpa;
  });
}
