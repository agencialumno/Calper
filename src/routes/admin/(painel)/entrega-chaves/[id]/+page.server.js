import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { TIPOS_PROCURACAO, arquivoParaBase64 } from '$lib/server/agendamento.js';
import { gerarPdfBase64, montarDocumento, quartosDaUnidade, titularesDaUnidade } from '$lib/server/documentos.js';
import {
  CALPER_JA_ASSINOU,
  NOME_DOCUMENTO,
  ROTULO_VINCULO,
  SLUG_ENTREGA_CHAVES,
  enviarDocumentoParaAssinatura,
  procuracaoValidaParaRetirante,
  retiranteDoAgendamento,
  signatariosDoCliente,
  sincronizarDocumento
} from '$lib/server/entregaChaves.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { cpfValido, emailValido, somenteDigitos } from '$lib/cpf.js';
import { montarChecklist, parseChecklist } from '$lib/documentosPadrao.js';

async function buscarAgendamento(id) {
  const agendamento = await db.agendamento.findUnique({
    where: { id },
    include: {
      tipoEvento: true,
      presencas: { orderBy: { createdAt: 'asc' } },
      documentosAssinados: { select: { tipo: true, status: true, assinadoEm: true } },
      unidade: {
        include: { empreendimento: true, investidores: { include: { investidor: true } } }
      }
    }
  });
  if (!agendamento || agendamento.tipoEvento.slug !== SLUG_ENTREGA_CHAVES) {
    throw error(404, 'Agendamento de entrega de chaves não encontrado');
  }
  return agendamento;
}

const irPara = (id, passo) => `/admin/entrega-chaves/${id}?passo=${passo}`;

export async function load(event) {
  const { params, url } = event;
  const agendamento = await buscarAgendamento(params.id);
  const u = agendamento.unidade;
  // entrega já concluída: abre direto o resumo (passo 5), sem reabrir o fluxo de assinatura
  if (agendamento.status === 'realizado' && !url.searchParams.get('passo')) {
    throw redirect(303, irPara(agendamento.id, 5));
  }
  const passo = Math.min(5, Math.max(1, Number(url.searchParams.get('passo')) || 1));

  const retirante = retiranteDoAgendamento(agendamento);
  // termo e checklist só depois de confirmar quem retira (e, sendo procurador, com procuração)
  const procuradorSemProcuracao = retirante?.vinculo === 'procurador' && !procuracaoValidaParaRetirante(agendamento, retirante.cpf);
  if ((passo === 3 || passo === 4) && (!retirante || procuradorSemProcuracao)) {
    throw redirect(303, irPara(agendamento.id, 2));
  }

  // documento já aberto no DocuSign: confere lá se a Calper e o cliente já assinaram
  const pendentesPorDocumento = {};
  for (const doc of await db.documentoAssinado.findMany({
    where: { agendamentoId: agendamento.id, status: { in: ['pendente', 'calper_assinou', 'aguardando_cliente'] } }
  })) {
    try {
      const { status, clientesPendentes } = await sincronizarDocumento(doc, event);
      pendentesPorDocumento[doc.tipo] = clientesPendentes;
      const registrado = agendamento.documentosAssinados.find((d) => d.tipo === doc.tipo);
      if (registrado) registrado.status = status;
    } catch (err) {
      console.error('DocuSign (sincronizar):', err?.response?.body ?? err);
    }
  }

  const documentos = Object.fromEntries(
    ['termo', 'checklist'].map((tipo) => [
      tipo,
      agendamento.documentosAssinados.find((d) => d.tipo === tipo)?.status ?? null
    ])
  );

  // o checklist vem depois do termo: só abre quando a Calper já assinou o termo
  if (passo === 4 && !CALPER_JA_ASSINOU.includes(documentos.termo)) {
    throw redirect(303, irPara(agendamento.id, 3));
  }

  const base = {
    passo,
    aviso: url.searchParams.get('aviso'),
    documentos,
    // quem ainda não assinou (nome/e-mail), por documento — vem da consulta ao DocuSign feita acima
    pendentes: pendentesPorDocumento,
    agendamento: {
      id: agendamento.id,
      status: agendamento.status,
      // quando o último documento foi assinado por todos (entrega concluída)
      concluidaEm: agendamento.documentosAssinados.map((d) => d.assinadoEm).filter(Boolean).sort((x, y) => y - x)[0] ?? null,
      dataHora: agendamento.dataHora,
      // quem AGENDOU (campos originais, nunca alterados pelo fluxo do dia)
      nome: agendamento.nomeCompareceu,
      cpf: agendamento.cpfCompareceu,
      email: agendamento.emailCompareceu,
      ehProprietario: agendamento.ehProprietario,
      proprietarioNome: agendamento.proprietarioNome,
      // quem RETIRA as chaves (confirmado no passo 2)
      retiranteNome: agendamento.retiranteNome,
      retiranteCpf: agendamento.retiranteCpf,
      retiranteEmail: agendamento.retiranteEmail,
      conjugeNome: agendamento.conjugeNome,
      conjugeEmail: agendamento.conjugeEmail,
      temProcuracao: Boolean(agendamento.procuracaoBase64),
      // CPF de quem a procuração anexada representa (nulo em registros antigos) e o nome, quando
      // foi a própria pessoa que agendou — o passo 2 só dispensa novo upload se o retirante for ela
      procuracaoCpf: agendamento.procuracaoCpf,
      procuracaoNome:
        agendamento.procuracaoCpf && agendamento.procuracaoCpf === agendamento.cpfCompareceu
          ? agendamento.nomeCompareceu
          : null,
      procuracaoTipo: agendamento.procuracaoBase64
        ? agendamento.procuracaoBase64.slice(5, agendamento.procuracaoBase64.indexOf(';'))
        : null
    },
    unidade: {
      id: u.id,
      bloco: u.bloco,
      numero: u.numero,
      quartos: quartosDaUnidade(u), // tipologia (base Murano) ou campo quartos
      statusQuitacao: u.statusQuitacao,
      vistoriaAprovada: u.vistoriaAprovada,
      vistoriaStatus: u.vistoriaStatus,
      escritura: u.escritura,
      escrituraRegistrada: u.escrituraRegistrada
    },
    titulares: titularesDaUnidade(u).map((t) => ({ id: t.id, nome: t.nome, cpf: t.cpf, principal: t.principal })),
    retirante: retirante ? { nome: retirante.nome, vinculo: retirante.vinculo } : null,
    presencas: agendamento.presencas.map((p) => ({
      id: p.id,
      nome: p.nome,
      vinculo: p.vinculo,
      vinculoRotulo: ROTULO_VINCULO[p.vinculo] ?? p.vinculo,
      createdAt: p.createdAt
    })),
    signatario: { nome: retirante?.nome ?? null, email: retirante?.email ?? null },
    conjuge: retirante ? signatariosDoCliente(agendamento, retirante).conjuge : null
  };

  // quem retira (e seu vínculo) define como as partes aparecem no texto (procurador = representação)
  const opcoes = { retirante, conjuge: base.conjuge };

  // passo 3 = termo, passo 4 = checklist; com a Calper já assinada o documento só mostra o andamento
  if (passo === 3 && !CALPER_JA_ASSINOU.includes(documentos.termo)) {
    return { ...base, texto: (await montarDocumento(u.id, 'termo', opcoes)).texto };
  }
  if (passo === 4 && !CALPER_JA_ASSINOU.includes(documentos.checklist)) {
    const { texto } = await montarDocumento(u.id, 'checklist', opcoes);
    return { ...base, checklist: parseChecklist(texto) };
  }
  return base;
}

export const actions = {
  // Passo 2: confirma quem retira as chaves. Quem não é comprador da unidade precisa de procuração.
  confirmarRetirante: async (event) => {
    const { request, params, locals } = event;
    const agendamento = await buscarAgendamento(params.id);
    const form = await request.formData();

    const quem = String(form.get('quem') ?? '');
    const email = String(form.get('email') ?? '').trim();
    if (!emailValido(email)) {
      return fail(400, { erro: 'Informe um e-mail válido de quem retira as chaves — ele é usado na assinatura.' });
    }

    // cônjuge (opcional): assina junto, recebendo o próprio link do DocuSign
    const conjugeNome = String(form.get('conjugeNome') ?? '').trim();
    const conjugeEmail = String(form.get('conjugeEmail') ?? '').trim();
    if (conjugeNome || conjugeEmail) {
      if (conjugeNome.length < 3) return fail(400, { erro: 'Informe o nome completo do cônjuge.' });
      if (!emailValido(conjugeEmail)) return fail(400, { erro: 'Informe um e-mail válido do cônjuge.' });
      if (conjugeEmail.toLowerCase() === email.toLowerCase()) {
        return fail(400, {
          erro: 'O e-mail do cônjuge precisa ser diferente do e-mail de quem retira: cada um recebe o próprio link.'
        });
      }
    }

    const titular = titularesDaUnidade(agendamento.unidade).find((t) => t.id === quem);
    let nome;
    let cpf = null;
    let vinculo;
    let procuracaoNova = null;

    if (titular) {
      nome = titular.nome;
      cpf = titular.cpf;
      vinculo = titular.principal ? 'comprador_principal' : 'comprador';
    } else if (quem === 'outro') {
      nome = String(form.get('nome') ?? '').trim();
      cpf = somenteDigitos(form.get('cpf'));
      if (nome.length < 3) return fail(400, { erro: 'Informe o nome completo de quem retira as chaves.' });
      if (!cpfValido(cpf)) return fail(400, { erro: 'Informe um CPF válido de quem retira as chaves.' });
      try {
        procuracaoNova = await arquivoParaBase64(form.get('procuracao'), {
          tipos: TIPOS_PROCURACAO,
          mensagemTipo:
            'A procuração precisa ser um documento: PDF, DOC ou DOCX. Para foto, use o botão "Tirar foto" (ela vira PDF).'
        });
      } catch (err) {
        return fail(400, { erro: err.message });
      }
      // a procuração do agendamento só vale se for da mesma pessoa que está retirando; se mudou
      // o procurador, exige novo upload
      if (!procuracaoNova && !procuracaoValidaParaRetirante(agendamento, cpf)) {
        return fail(400, {
          erro: agendamento.procuracaoBase64
            ? 'A procuração anexada no agendamento é de outra pessoa: envie a procuração de quem está retirando as chaves.'
            : 'Quem retira não é comprador desta unidade: envie a procuração para continuar.'
        });
      }
      vinculo = 'procurador';
    } else {
      return fail(400, { erro: 'Escolha quem está retirando as chaves.' });
    }

    await db.$transaction([
      db.agendamento.update({
        where: { id: agendamento.id },
        // grava só os campos do retirante; os de quem agendou (nomeCompareceu etc.) ficam intactos
        data: {
          retiranteNome: nome,
          retiranteCpf: cpf,
          retiranteEmail: email,
          conjugeNome: conjugeNome || null,
          conjugeEmail: conjugeEmail || null,
          ...(procuracaoNova ? { procuracaoBase64: procuracaoNova, procuracaoCpf: cpf } : {})
        }
      }),
      ...(procuracaoNova
        ? [
            db.procuracaoUnidade.create({
              data: {
                unidadeId: agendamento.unidadeId,
                agendamentoId: agendamento.id,
                nome,
                cpf,
                origem: 'atendimento',
                arquivoBase64: procuracaoNova
              }
            })
          ]
        : []),
      // só um retirante por entrega; acompanhantes registrados não são afetados
      db.presencaEntrega.deleteMany({
        where: { agendamentoId: agendamento.id, vinculo: { not: 'acompanhante' } }
      }),
      db.presencaEntrega.create({
        data: {
          agendamentoId: agendamento.id,
          unidadeId: agendamento.unidadeId,
          nome,
          vinculo,
          cpf,
          registradoPorId: locals.funcionario.id
        }
      })
    ]);

    const u = agendamento.unidade;
    const local = `Unidade ${u.numero}, Bloco ${u.bloco}`;
    if (procuracaoNova) {
      await registrarLog({
        event,
        atorTipo: 'funcionario',
        acao: 'documento_enviado',
        descricao: `${rotuloFuncionario(locals.funcionario)} anexou a procuração de ${nome} (CPF ${cpf}) — ${local}`,
        entidadeTipo: 'Agendamento',
        entidadeId: agendamento.id
      });
    }
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'retirante_confirmado',
      descricao: `${rotuloFuncionario(locals.funcionario)} registrou a presença de ${nome} (${ROTULO_VINCULO[vinculo]}) na entrega de chaves — ${local}. Agendamento feito por ${agendamento.nomeCompareceu ?? '—'}${agendamento.emailCompareceu ? ` (${agendamento.emailCompareceu})` : ''}`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });

    throw redirect(303, irPara(agendamento.id, 3));
  },

  // Lista de presença: outras pessoas que compareceram além de quem retira as chaves.
  adicionarPresente: async (event) => {
    const { request, params, locals } = event;
    const agendamento = await buscarAgendamento(params.id);
    const form = await request.formData();
    const nome = String(form.get('nome') ?? '').trim();
    if (nome.length < 3) return fail(400, { erro: 'Informe o nome de quem compareceu.' });

    await db.presencaEntrega.create({
      data: {
        agendamentoId: agendamento.id,
        unidadeId: agendamento.unidadeId,
        nome,
        vinculo: 'acompanhante',
        registradoPorId: locals.funcionario.id
      }
    });
    const u = agendamento.unidade;
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'presenca_registrada',
      descricao: `${rotuloFuncionario(locals.funcionario)} registrou a presença de ${nome} (${ROTULO_VINCULO.acompanhante}) — Unidade ${u.numero}, Bloco ${u.bloco}`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });
    return { sucesso: 'presenca' };
  },

  removerPresente: async (event) => {
    const { request, params, locals } = event;
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const presenca = await db.presencaEntrega.findFirst({
      where: { id, agendamentoId: params.id, vinculo: 'acompanhante' },
      include: { unidade: true }
    });
    if (!presenca) return fail(404, { erro: 'Registro não encontrado.' });

    await db.presencaEntrega.delete({ where: { id } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'presenca_removida',
      descricao: `${rotuloFuncionario(locals.funcionario)} removeu ${presenca.nome} da lista de presença — Unidade ${presenca.unidade.numero}, Bloco ${presenca.unidade.bloco}`,
      entidadeTipo: 'Agendamento',
      entidadeId: params.id
    });
    return { sucesso: 'presenca' };
  },

  // "Verificar agora": consulta o DocuSign na hora (sem esperar o cron) e atualiza o status do documento.
  verificar: async (event) => {
    const form = await event.request.formData();
    const tipo = String(form.get('tipo') ?? '');
    const doc = await db.documentoAssinado.findUnique({
      where: { agendamentoId_tipo: { agendamentoId: event.params.id, tipo } }
    });
    if (!doc) return fail(404, { erro: 'Documento não encontrado.' });
    try {
      const { status } = await sincronizarDocumento(doc, event);
      return { verificado: { tipo, status, em: new Date().toISOString() } };
    } catch (err) {
      console.error('DocuSign (verificar):', err?.response?.body ?? err);
      return fail(400, { erro: 'Não foi possível consultar o DocuSign agora. Tente novamente em instantes.' });
    }
  },

  // Lê o documento como ele vai (PDF) antes de criar o envelope: o cliente confere na tela do atendimento.
  previa: async ({ request }) => {
    const form = await request.formData();
    const tipo = String(form.get('tipo') ?? '');
    const texto = textoDoFormulario(form, tipo);
    if (texto === null) return fail(400, { erro: 'Documento inválido.' });
    try {
      return { previa: { tipo, pdfBase64: await gerarPdfBase64(texto, NOME_DOCUMENTO[tipo], tipo) } };
    } catch (err) {
      console.error('Prévia do documento:', err);
      return fail(400, { erro: 'Não foi possível gerar a leitura do documento.' });
    }
  },

  enviar: async (event) => {
    const { request, params } = event;
    const form = await request.formData();
    const tipo = String(form.get('tipo') ?? '');
    const texto = textoDoFormulario(form, tipo);
    if (texto === null) return fail(400, { erro: 'Documento inválido.' });

    // redireciona pro DocuSign em caso de sucesso; só volta aqui se algo impediu o envio
    const resultado = await enviarDocumentoParaAssinatura(event, {
      agendamentoId: params.id,
      tipo,
      texto,
      origem: 'fluxo'
    });
    return fail(400, { erro: resultado.erro });
  }
};

/** Texto final do documento a partir do formulário do passo (termo = textarea, checklist = campos). */
function textoDoFormulario(form, tipo) {
  if (tipo === 'termo') return String(form.get('texto') ?? '');
  if (tipo !== 'checklist') return null;
  const numeros = form.getAll('numero').map(String);
  const descricoes = form.getAll('descricao').map(String);
  const temQtdes = form.getAll('temQtde').map(String);
  const qtdes = form.getAll('qtde').map((q) => String(q).trim());
  return montarChecklist({
    cabecalho: String(form.get('cabecalho') ?? ''),
    itens: numeros.map((numero, i) => ({
      numero,
      descricao: descricoes[i] ?? '',
      temQtde: temQtdes[i] === '1',
      qtde: qtdes[i] ?? '',
      recebido: form.get(`recebido_${numero}`) === 'sim'
    })),
    rodape: String(form.get('rodape') ?? '')
  });
}
