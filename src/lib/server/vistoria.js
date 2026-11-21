import { error, redirect } from '@sveltejs/kit';
import { db } from './db.js';
import { buscarMurano } from './murano.js';
import { SLUG_VISTORIA } from '../servicos.js';
import { agoraComoRelogioDeBrasilia, conferirVaga, dataHoraDoSlot } from './agenda.js';
import { gerarQrToken } from './agendamento.js';
import { dataPorExtenso, obterTemplate, textosDePartes, titularesDaUnidade, montarVariaveis } from './documentos.js';
import { gerarPdfModeloVistoria } from './pdfModeloVistoria.js';
import {
  DOCUMENTO_ID,
  anularEnvelope,
  assinanteDaCalper,
  baixarPdfAssinado,
  criarEnvelopeVistoria,
  destinatarioDaCopia,
  situacaoDoEnvelopeVistoria
} from './docusign.js';
import { registrarLog, rotuloFuncionario } from './log.js';
import { NOME_DOCUMENTO_FICHA, NOME_DOCUMENTO_VISTORIA, RESULTADO, TIPO_DOCUMENTO_VISTORIA, motivoSemRevistoria, presentesDoAgendamento, signatariosDaVistoria } from '../vistoria.js';
import { TIPO_TERMO_VISTORIA } from '../documentosPadrao.js';
import { ORIGEM_DIRETO } from '../atendimentoDireto.js';

/** Estados do termo da vistoria: pendente (a Calper ainda não assinou) → aguardando_cliente → assinado. */
export const ROTULO_STATUS_TERMO_VISTORIA = {
  pendente: 'aguardando a assinatura da Calper',
  aguardando_cliente: 'Calper assinou — aguardando o proprietário',
  assinado: 'assinado por todos'
};
export const CALPER_JA_ASSINOU_VISTORIA = ['aguardando_cliente', 'assinado'];

/** Agendamento de vistoria (404 se for de outro serviço). */
export async function buscarVistoria(id) {
  const ag = await db.agendamento.findUnique({
    where: { id },
    include: {
      tipoEvento: true,
      documentosAssinados: { select: { id: true, tipo: true, status: true, assinadoEm: true, docusignEnvelopeId: true } },
      unidade: true
    }
  });
  if (!ag || ag.tipoEvento.slug !== SLUG_VISTORIA) throw error(404, 'Agendamento de vistoria não encontrado');
  return ag;
}

export const documentoDaVistoria = (ag) => ag.documentosAssinados.find((d) => d.tipo === TIPO_DOCUMENTO_VISTORIA) ?? null;

/** A procuração anexada (no agendamento público ou no atendimento) vale para este CPF de procurador? */
export function procuracaoValidaParaProcurador(ag, cpf) {
  if (!ag.procuracaoBase64) return false;
  if (!ag.procuracaoCpf) return true;
  return ag.procuracaoCpf === String(cpf ?? '').replace(/\D/g, '');
}

/** Quem assina, a partir do que está gravado no agendamento. */
export function signatariosDoAgendamento(ag) {
  const presentes = presentesDoAgendamento(ag);
  const procurador = presentes.find((p) => p.vinculo === 'procurador');
  return signatariosDaVistoria(presentes, { procuracaoValida: procurador ? procuracaoValidaParaProcurador(ag, procurador.cpf) : false });
}

/**
 * Linhas de assinatura: a Calper (quem atende) primeiro e depois um proprietário/procurador por signatário, na mesma ordem
 * do DocuSign. `ficha` = parte superior (Ficha de reparos); sem `ficha` = Termo de Recebimento. `semNomeCalper`: linha da
 * Calper sem nome (parte do documento que ainda será assinada numa revistoria, por outra pessoa).
 */
export function linhasDeAssinatura(signatarios, calperNome, { ficha = false, semNomeCalper = false } = {}) {
  const prefixo = ficha ? 'ASSINATURA FICHA' : 'ASSINATURA';
  const linhas = [semNomeCalper || !calperNome ? `[${prefixo} REPRESENTANTE DA CALPER]` : `[${prefixo} REPRESENTANTE DA CALPER: ${calperNome}]`];
  signatarios.forEach((s, i) => linhas.push(`[${prefixo} ${s.vinculo === 'procurador' ? 'PROCURADOR' : 'PROPRIETÁRIO'} ${i + 1}: ${s.nome}]`));
  return linhas.join('\n\n');
}

/** Garante que todas as linhas de assinatura esperadas existam no texto (se a equipe apagou alguma na prévia, volta). */
export function ajustarAssinaturasVistoria(texto, signatarios, calperNome, { ficha = false } = {}) {
  const esperadas = [
    ...(ficha ? linhasDeAssinatura(signatarios, calperNome, { ficha: true }).split('\n\n') : []),
    ...linhasDeAssinatura(signatarios, calperNome, { semNomeCalper: ficha }).split('\n\n')
  ];
  const prefixo = (l) => (l.includes(':') ? l.slice(0, l.indexOf(':')) : l.replace(/\]$/, ''));
  const existentes = new Set(texto.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('[ASSINATURA')).map(prefixo));
  const faltam = esperadas.filter((l) => !existentes.has(prefixo(l)));
  if (faltam.length === 0) return texto;
  return `${texto.trimEnd()}\n\n${faltam.join('\n\n')}`;
}

/** Variáveis do documento da vistoria (unidade, proprietários, datas) e o template do Termo de Recebimento. */
async function baseDoDocumento(ag) {
  const unidade = await db.unidade.findUnique({ where: { id: ag.unidadeId }, include: { investidores: { include: { investidor: true } } } });
  const template = await obterTemplate(unidade.empreendimentoId, TIPO_TERMO_VISTORIA);
  const resultado = signatariosDoAgendamento(ag);
  const signatarios = resultado.ok ? resultado.signatarios : [];
  const procurador = presentesDoAgendamento(ag).find((p) => p.vinculo === 'procurador');
  const titulares = titularesDaUnidade(unidade);
  const variaveis = montarVariaveis({
    unidade,
    partes: textosDePartes(titulares.map((t) => t.nome), procurador ? { vinculo: 'procurador', nome: procurador.nome } : null),
    variaveisTemplate: null
  });
  return { template, signatarios, variaveis };
}

/** Linhas do cabeçalho do FORM-020 (as mesmas da prévia e do PDF): o PDF é o modelo oficial com estes campos escritos por cima. */
function cabecalhoFormulario(variaveis) {
  return [
    'Obra: Murano Residencial',
    `Bloco: ${variaveis.bloco} | Unidade: ${variaveis.unidade}`,
    `Data: ${dataCurtaDeHoje()}`,
    `Nome do Cliente: ${variaveis.proprietarios}`
  ].join('\n');
}

const dataCurtaDeHoje = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/**
 * Prévia do Termo de Recebimento do Imóvel (FORM-020, vistoria aceita) para a unidade. O PDF é o modelo oficial; aqui só
 * aparecem os campos preenchidos. Campos sem valor ficam como {{variável}} para a equipe completar na prévia.
 */
export async function montarTermoVistoria(ag) {
  const { variaveis } = await baseDoDocumento(ag);
  return [
    'TERMO DE RECEBIMENTO DO IMÓVEL',
    'FICHA DE VISTORIA E ENTREGA DE UNIDADE - FORM-020 - Rev. 06',
    cabecalhoFormulario(variaveis),
    `Rio de Janeiro, ${variaveis.dataAssinatura}.`
  ].join('\n');
}

/**
 * Prévia do FORM-020 da vistoria NÃO aceita: Ficha de reparos preenchida (assinada agora, Calper e depois o cliente) e o
 * Termo de Recebimento embaixo, em branco (se houver revistoria aceita, ela assina ali, sobre este mesmo PDF).
 */
export async function montarFichaVistoria(ag) {
  const { variaveis } = await baseDoDocumento(ag);
  return [
    'FICHA DE REPAROS',
    'FICHA DE VISTORIA E ENTREGA DE UNIDADE - FORM-020 - Rev. 06',
    cabecalhoFormulario(variaveis),
    `Vistoria: ${ag.vistoriaNumero}ª — resultado: VISTORIA NÃO ACEITA`,
    '',
    'Reparos necessários:',
    String(ag.vistoriaReparos ?? '').trim(),
    '',
    `Telefone para contato: ${ag.vistoriaTelefoneRetorno ?? ''}`,
    '',
    `Rio de Janeiro, ${variaveis.dataAssinatura}.`
  ].join('\n');
}

/** Lê de volta, da prévia (já revisada pela equipe), os campos que o PDF do modelo recebe. */
export function dadosDaPreviaVistoria(texto) {
  const linha = (re) => re.exec(texto)?.[1]?.trim() ?? '';
  const bu = /^Bloco:\s*(.*?)\s*\|\s*Unidade:\s*(.*)$/m.exec(texto);
  const reparos = /^Reparos necessários:[^\S\n]*\n([\s\S]*?)\n[^\S\n]*Telefone para contato:/m.exec(texto)?.[1]?.trim() ?? '';
  return {
    bloco: bu?.[1]?.trim() ?? '',
    unidade: bu?.[2]?.trim() ?? '',
    proprietarios: linha(/^Nome do Cliente:\s*(.*)$/m),
    dataCurta: linha(/^Data:\s*(.*)$/m),
    data: linha(/^Rio de Janeiro,\s*(.*?)\.?\s*$/m),
    reparos,
    telefone: linha(/^Telefone para contato:[^\S\n]*(.*)$/m)
  };
}

/** PDF assinado da vistoria anterior (não aceita) da unidade, base do envelope da revistoria; null se não houver. */
export async function baseDaRevistoria(ag) {
  if (ag.vistoriaNumero <= 1) return null;
  const anterior = await db.agendamento.findFirst({
    where: { unidadeId: ag.unidadeId, tipoEventoId: ag.tipoEventoId, status: { not: 'cancelado' }, vistoriaNumero: { lt: ag.vistoriaNumero }, vistoriaResultado: RESULTADO.naoAceita },
    orderBy: { vistoriaNumero: 'desc' },
    include: { documentosAssinados: { where: { tipo: TIPO_DOCUMENTO_VISTORIA, status: 'assinado' }, select: { id: true, pdfBase64: true } } }
  });
  const doc = anterior?.documentosAssinados[0];
  if (!doc?.pdfBase64) return null;
  const quem = signatariosDoAgendamento(anterior);
  return { pdfBase64: doc.pdfBase64.replace(/^data:application\/pdf;base64,/, ''), linhas: quem.ok ? quem.signatarios.length : 0, anteriorId: anterior.id, numero: anterior.vistoriaNumero };
}

/**
 * Cria o envelope do DocuSign com o termo: a Calper (funcionário logado) assina primeiro, embutida no admin; depois cada
 * proprietário/procurador presente recebe o link. Devolve { erro } se algo impedir; em caso de sucesso, redireciona à assinatura.
 */
export async function enviarTermoVistoria(event, { agendamentoId, texto }) {
  const { locals } = event;
  const ag = await buscarVistoria(agendamentoId);
  if (ag.status === 'cancelado') return { erro: 'Este agendamento foi cancelado: não dá para enviar documentos.' };
  const ehFicha = ag.vistoriaResultado === RESULTADO.naoAceita;
  if (!ehFicha && ag.vistoriaResultado !== RESULTADO.aceita) return { erro: 'Registre o resultado da vistoria antes de gerar o documento.' };
  const nomeDocumento = ehFicha ? NOME_DOCUMENTO_FICHA : NOME_DOCUMENTO_VISTORIA;
  const existente = documentoDaVistoria(ag);
  if (CALPER_JA_ASSINOU_VISTORIA.includes(existente?.status)) return { erro: 'A Calper já assinou este documento.' };
  const irParaAssinatura = () => redirect(303, `/admin/vistoria/${ag.id}/assinar`);

  const quem = signatariosDoAgendamento(ag);
  if (!quem.ok) return { erro: quem.erro };

  // revistoria aceita: o envelope usa o PDF assinado da vistoria anterior (não aceita) como base; só o Termo (parte de baixo) recebe assinaturas
  const base = ehFicha ? null : await baseDaRevistoria(ag);
  let textoFinal = '';
  if (base) {
    if (quem.signatarios.length > base.linhas) {
      return { erro: `A revistoria tem mais assinantes (${quem.signatarios.length}) do que o documento da ${base.numero}ª vistoria tem de linhas (${base.linhas}). Ajuste quem comparece.` };
    }
  } else {
    textoFinal = ajustarAssinaturasVistoria(String(texto ?? '').trim(), quem.signatarios, locals.funcionario.nome, { ficha: ehFicha });
    if (!String(texto ?? '').trim()) return { erro: 'O documento está vazio.' };
    const pendente = textoFinal.match(/\{\{\s*\w+\s*\}\}/g);
    if (pendente) return { erro: `Preencha antes de enviar: ${[...new Set(pendente)].join(', ')}` };
  }

  let envelopeId;
  let comCopia = false;
  try {
    const pdfBase64 = base
      ? base.pdfBase64
      : await gerarPdfModeloVistoria({
          ...dadosDaPreviaVistoria(textoFinal),
          parte: ehFicha ? 'ficha' : 'termo',
          assinantes: quem.signatarios.map((x) => ({ nome: x.nome, procurador: x.vinculo === 'procurador' }))
        });
    const copia = await destinatarioDaCopia();
    ({ envelopeId, comCopia } = await criarEnvelopeVistoria({
      pdfBase64,
      nomeDocumento,
      parte: ehFicha ? 'ficha' : 'termo',
      linhas: base ? base.linhas : quem.signatarios.length,
      // a Calper assina pelo funcionário que faz o atendimento (nome e e-mail do perfil dele)
      calper: { nome: locals.funcionario.nome, email: locals.funcionario.email, clientUserId: ag.id },
      assinantes: quem.signatarios,
      copia
    }));
    // reenvio com o texto corrigido antes de a Calper assinar: o envelope anterior fica sem uso
    if (existente?.docusignEnvelopeId) await anularEnvelope(existente.docusignEnvelopeId, 'termo reenviado com outro texto');
  } catch (err) {
    if (err?.amigavel) return { erro: err.message };
    console.error('DocuSign (vistoria):', err?.response?.body ?? err);
    return { erro: 'Não foi possível enviar para assinatura (DocuSign). Veja o log do servidor.' };
  }

  await db.documentoAssinado.upsert({
    where: { agendamentoId_tipo: { agendamentoId: ag.id, tipo: TIPO_DOCUMENTO_VISTORIA } },
    update: { docusignEnvelopeId: envelopeId, status: 'pendente' },
    create: { agendamentoId: ag.id, unidadeId: ag.unidadeId, tipo: TIPO_DOCUMENTO_VISTORIA, docusignEnvelopeId: envelopeId }
  });
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'termo_vistoria_enviado_assinatura',
    descricao: `${rotuloFuncionario(locals.funcionario)} abriu o envelope do ${nomeDocumento}${base ? ` (revistoria: base é o PDF assinado da ${base.numero}ª vistoria)` : ''} — Unidade ${ag.unidade.numero}, Bloco ${ag.unidade.bloco}: a Calper assina primeiro (${locals.funcionario.nome}); depois ${quem.signatarios.map((s) => `${s.nome} (${s.email})`).join(', ')}${comCopia ? '; a cópia do documento final vai para o e-mail da Calper' : ''}`,
    entidadeTipo: 'DocumentoAssinado',
    entidadeId: envelopeId
  });
  throw irParaAssinatura();
}

/**
 * Confere no DocuSign em que ponto está o envelope do termo e atualiza o documento no banco:
 * Calper assinou → "aguardando_cliente"; envelope concluído → baixa o PDF assinado, marca "assinado" e a vistoria fica "realizada".
 * Chamada também pelo cron (sem `event`). Devolve { status, clientesPendentes }.
 */
export async function sincronizarTermoVistoria(documento, event = null) {
  if (documento.status === 'assinado') return { status: 'assinado', clientesPendentes: [] };
  if (!documento.agendamentoId) return { status: documento.status, clientesPendentes: [] };

  const situacao = await situacaoDoEnvelopeVistoria(documento.docusignEnvelopeId);
  const log = (dados) =>
    registrarLog({ event: event ?? { locals: {}, getClientAddress: () => null, request: { headers: new Headers() } }, atorTipo: 'funcionario', ...dados });
  const ag = await db.agendamento.findUnique({ where: { id: documento.agendamentoId }, include: { unidade: true } });
  const local = `Unidade ${ag.unidade.numero}, Bloco ${ag.unidade.bloco}`;
  const atendente = event?.locals?.funcionario;

  const novo = situacao.status === 'completed' ? 'assinado' : situacao.calperAssinou ? 'aguardando_cliente' : 'pendente';
  if (novo === documento.status) return { status: novo, clientesPendentes: situacao.clientesPendentes };

  if (novo === 'assinado') {
    const pdfBase64 = await baixarPdfAssinado(documento.docusignEnvelopeId, DOCUMENTO_ID.termo);
    await db.documentoAssinado.update({ where: { id: documento.id }, data: { status: 'assinado', pdfBase64, assinadoEm: new Date() } });
    if (ag.status !== 'realizado') {
      await db.agendamento.update({ where: { id: ag.id }, data: { status: 'realizado', vistoriaConcluidaEm: new Date() } });
    }
    if (ag.vistoriaResultado === RESULTADO.naoAceita) {
      // vistoria não aceita: só termina com a Ficha de reparos assinada; o documento assinado fica guardado nesta tentativa
      await db.historicoUnidade.create({
        data: {
          unidadeId: ag.unidadeId,
          tipo: 'apontamento',
          descricao: `${ag.vistoriaNumero > 1 ? `Revistoria (${ag.vistoriaNumero}ª vistoria)` : `Vistoria ${ag.vistoriaNumero}`} não aceita. Reparos: ${String(ag.vistoriaReparos ?? '').slice(0, 500)}. Telefone para contato: ${ag.vistoriaTelefoneRetorno ?? '—'}. Ficha assinada via DocuSign`,
          criadoPorId: atendente?.id ?? null
        }
      });
      await log({
        funcionarioId: atendente?.id,
        acao: 'vistoria_nao_aceita',
        descricao: `${NOME_DOCUMENTO_FICHA} da ${local} assinada por todos via DocuSign — vistoria ${ag.vistoriaNumero} não aceita`,
        entidadeTipo: 'Agendamento',
        entidadeId: ag.id
      });
    } else {
      await db.historicoUnidade.create({
        data: { unidadeId: ag.unidadeId, tipo: 'evento_realizado', descricao: `Vistoria ${ag.vistoriaNumero} aceita (${NOME_DOCUMENTO_VISTORIA} assinado via DocuSign)`, criadoPorId: atendente?.id ?? null }
      });
      await log({
        funcionarioId: atendente?.id,
        acao: 'vistoria_aceita',
        descricao: `${NOME_DOCUMENTO_VISTORIA} da ${local} assinado por todos via DocuSign — vistoria ${ag.vistoriaNumero} aceita`,
        entidadeTipo: 'Agendamento',
        entidadeId: ag.id
      });
    }
  } else {
    await db.documentoAssinado.update({ where: { id: documento.id }, data: { status: novo } });
    await log({
      funcionarioId: atendente?.id,
      acao: 'documento_assinado_calper',
      descricao: `${ag.vistoriaResultado === RESULTADO.naoAceita ? NOME_DOCUMENTO_FICHA : NOME_DOCUMENTO_VISTORIA} da ${local} assinado pela Calper; o DocuSign enviou o e-mail para ${situacao.clientesPendentes.map((c) => c.nome).join(' e ')}`,
      entidadeTipo: 'DocumentoAssinado',
      entidadeId: documento.id
    });
  }
  return { status: novo, clientesPendentes: situacao.clientesPendentes };
}

// --- Revistoria ---

/**
 * Abre a próxima vistoria da unidade (vistoriaNumero + 1) depois de "não aceita". `quando`: 'agora' (atendimento direto,
 * check-in na hora, sem vaga) ou { data: 'YYYY-MM-DD', horario: 'HH:MM' } escolhido na agenda de vistoria (respeita as vagas).
 * Só admin e supervisor (o chamador confere). Devolve { erro } ou { id }.
 */
export async function abrirRevistoria(event, { agendamentoId, quando }) {
  const { locals } = event;
  const anterior = await buscarVistoria(agendamentoId);
  const tipoEvento = anterior.tipoEvento;
  const murano = await buscarMurano();
  if (!murano || anterior.unidade.empreendimentoId !== murano.id) return { erro: 'Vistoria indisponível para esta unidade.' };

  const agora = new Date();
  const direto = quando === 'agora';
  const dataHora = direto ? agoraComoRelogioDeBrasilia(agora) : dataHoraDoSlot(quando.data, quando.horario);

  let criado;
  try {
    criado = await db.$transaction(
      async (tx) => {
        const proxima = await tx.agendamento.findFirst({
          where: { unidadeId: anterior.unidadeId, tipoEventoId: tipoEvento.id, status: { not: 'cancelado' }, vistoriaNumero: { gt: anterior.vistoriaNumero } },
          select: { id: true }
        });
        const motivo = motivoSemRevistoria(anterior, { existeProxima: Boolean(proxima) });
        if (motivo) return { erro: `Não dá para abrir a revistoria: ${motivo}.` };
        if (!direto) {
          const vaga = await conferirVaga(tx, quando.data, quando.horario, { servico: 'vistoria' });
          if (!vaga.ok) return { erro: vaga.motivo };
        }
        const ag = await tx.agendamento.create({
          data: {
            unidadeId: anterior.unidadeId,
            tipoEventoId: tipoEvento.id,
            investidorId: anterior.investidorId,
            dataHora,
            status: 'confirmado',
            qrToken: gerarQrToken(),
            vistoriaNumero: anterior.vistoriaNumero + 1,
            nomeCompareceu: anterior.nomeCompareceu,
            cpfCompareceu: anterior.cpfCompareceu,
            telefoneCompareceu: anterior.telefoneCompareceu,
            emailCompareceu: anterior.emailCompareceu,
            ehProprietario: anterior.ehProprietario,
            proprietarioNome: anterior.proprietarioNome,
            ...(direto ? { origem: ORIGEM_DIRETO, checkinEm: agora } : {})
          }
        });
        await tx.historicoUnidade.create({
          data: {
            unidadeId: anterior.unidadeId,
            tipo: 'outro',
            descricao: `Revistoria (${ag.vistoriaNumero}ª vistoria) aberta ${direto ? 'para agora' : `para ${quando.data.split('-').reverse().join('/')} às ${quando.horario}`}`,
            criadoPorId: locals.funcionario.id
          }
        });
        return { ag };
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (err) {
    console.error('Revistoria:', err);
    return { erro: 'Não foi possível abrir a revistoria. Confira a tela e tente de novo.' };
  }
  if (criado.erro) return { erro: criado.erro };

  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'revistoria_aberta',
    descricao: `${rotuloFuncionario(locals.funcionario)} abriu a revistoria (${criado.ag.vistoriaNumero}ª vistoria) — Unidade ${anterior.unidade.numero}, Bloco ${anterior.unidade.bloco}, ${direto ? 'para agora' : `${quando.data} ${quando.horario}`}`,
    entidadeTipo: 'Agendamento',
    entidadeId: criado.ag.id
  });
  return { id: criado.ag.id };
}
