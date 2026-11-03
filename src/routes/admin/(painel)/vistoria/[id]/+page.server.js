import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { TIPOS_PROCURACAO, arquivoParaBase64 } from '$lib/server/agendamento.js';
import { gerarPdfBase64, quartosDaUnidade, titularesDaUnidade } from '$lib/server/documentos.js';
import { corrigirEmailDoDestinatario, DESTINATARIO_VISTORIA, situacaoDoEnvelopeVistoria } from '$lib/server/docusign.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { cpfValido, emailValido, somenteDigitos } from '$lib/cpf.js';
import { statusDaUnidade } from '$lib/server/unidadeStatus.js';
import { agendaPublica } from '$lib/server/agenda.js';
import { podeGerirAgendamentos } from '$lib/gestaoAgendamento.js';
import { podeEditar } from '$lib/perfis.js';
import {
  CALPER_JA_ASSINOU_VISTORIA,
  abrirRevistoria,
  buscarVistoria,
  documentoDaVistoria,
  enviarTermoVistoria,
  montarTermoVistoria,
  procuracaoValidaParaProcurador,
  signatariosDoAgendamento,
  sincronizarTermoVistoria
} from '$lib/server/vistoria.js';
import {
  NOME_DOCUMENTO_VISTORIA,
  RESULTADO,
  motivoSemRevistoria,
  presentesDoAgendamento,
  rotuloDaVistoria
} from '$lib/vistoria.js';

const irPara = (id, passo) => `/admin/vistoria/${id}?passo=${passo}`;
const CANCELADO = 'Este agendamento foi cancelado: o atendimento não pode ser alterado.';
const CONCLUIDO = 'Esta vistoria já foi concluída: o atendimento não pode mais ser alterado. Para uma nova vistoria, abra a revistoria.';
const rotuloUnidade = (u) => `Unidade ${u.numero}, Bloco ${u.bloco}`;

/** O atendimento ainda pode mudar? (não cancelado, não concluído) */
const travado = (ag) => (ag.status === 'cancelado' ? CANCELADO : ag.status === 'realizado' ? CONCLUIDO : null);

export async function load(event) {
  const { params, url, locals } = event;
  const ag = await buscarVistoria(params.id);
  const u = ag.unidade;
  // vistoria já concluída: abre direto o resumo
  if (ag.status === 'realizado' && !url.searchParams.get('passo')) throw redirect(303, irPara(ag.id, 5));
  const passo = Math.min(5, Math.max(1, Number(url.searchParams.get('passo')) || 1));

  // documento aberto no DocuSign: confere lá se a Calper e os proprietários já assinaram
  let clientes = [];
  const doc = documentoDaVistoria(ag);
  if (doc && doc.status !== 'assinado') {
    try {
      const r = await sincronizarTermoVistoria({ ...doc, agendamentoId: ag.id }, event);
      doc.status = r.status;
      clientes = r.clientesPendentes;
      if (r.status === 'assinado') ag.status = 'realizado';
    } catch (err) {
      console.error('DocuSign (sincronizar vistoria):', err?.response?.body ?? err);
    }
  }

  const presentes = presentesDoAgendamento(ag);
  const procuradorPresente = presentes.find((p) => p.vinculo === 'procurador') ?? null;
  const quem = signatariosDoAgendamento(ag);
  const temPresencaValida = presentes.length > 0 && !(procuradorPresente && !procuracaoValidaParaProcurador(ag, procuradorPresente.cpf));

  // navegação livre; o que ainda não pode ser feito explica o motivo e leva à etapa que resolve
  let bloqueio = null;
  if (passo >= 2 && passo <= 4 && !temPresencaValida) {
    bloqueio = {
      texto: procuradorPresente
        ? 'Quem comparece é procurador: anexe a procuração antes de seguir.'
        : 'Marque quem comparece (um comprador ou um procurador com procuração) antes de seguir.',
      passo: 1,
      rotulo: 'Ir para "Quem comparece"'
    };
  } else if (passo === 4 && ag.vistoriaResultado !== RESULTADO.aceita && ag.vistoriaResultado !== RESULTADO.naoAceita) {
    bloqueio = { texto: 'Registre o resultado da vistoria antes de seguir para o documento.', passo: 3, rotulo: 'Ir para "Resultado"' };
  } else if (passo === 4 && ag.vistoriaResultado === RESULTADO.naoAceita) {
    bloqueio = { texto: 'Vistoria não aceita: não há documento nem assinatura. Os reparos ficam registrados no resultado.', passo: 5, rotulo: 'Ver o resumo' };
  } else if (passo === 4 && !quem.ok) {
    bloqueio = { texto: quem.erro, passo: 1, rotulo: 'Ir para "Quem comparece"' };
  }

  const titulares = titularesDaUnidade(u);
  const proxima = await db.agendamento.findFirst({
    where: { unidadeId: u.id, tipoEventoId: ag.tipoEventoId, status: { not: 'cancelado' }, vistoriaNumero: { gt: ag.vistoriaNumero } },
    select: { id: true, vistoriaNumero: true }
  });
  const podeGerir = podeGerirAgendamentos(locals.funcionario.perfil);
  const calperJaAssinou = CALPER_JA_ASSINOU_VISTORIA.includes(doc?.status);

  const base = {
    passo,
    aviso: url.searchParams.get('aviso'),
    podeEditar: podeEditar(locals.funcionario.perfil),
    bloqueio,
    calper: { nome: locals.funcionario.nome, email: locals.funcionario.email },
    documento: doc ? { status: doc.status } : null,
    pendentes: clientes,
    // revistoria: só admin e supervisor, e só depois de "não aceita"
    revistoria: {
      podeGerir,
      bloqueio: motivoSemRevistoria(ag, { existeProxima: Boolean(proxima) }),
      proxima,
      agenda: podeGerir && ag.vistoriaResultado === RESULTADO.naoAceita ? await agendaPublica(new Date(), { servico: 'vistoria' }) : []
    },
    agendamento: {
      id: ag.id,
      status: ag.status,
      origem: ag.origem,
      vistoriaNumero: ag.vistoriaNumero,
      dataHora: ag.dataHora,
      canceladoEm: ag.canceladoEm,
      motivoCancelamento: ag.motivoCancelamento,
      concluidaEm: ag.vistoriaConcluidaEm,
      nome: ag.nomeCompareceu,
      telefone: ag.telefoneCompareceu,
      email: ag.emailCompareceu,
      ehProprietario: ag.ehProprietario,
      proprietarioNome: ag.proprietarioNome,
      observacoes: ag.observacoesAtendimento ?? '',
      resultado: ag.vistoriaResultado,
      resultadoRotulo: rotuloDaVistoria(ag),
      reparos: ag.vistoriaReparos ?? '',
      telefoneRetorno: ag.vistoriaTelefoneRetorno ?? ag.telefoneCompareceu ?? '',
      temProcuracao: Boolean(ag.procuracaoBase64),
      procuracaoCpf: ag.procuracaoCpf,
      temIdentidade: Boolean(ag.documentoBase64),
      identidadeTipo: ag.documentoBase64 ? ag.documentoBase64.slice(5, ag.documentoBase64.indexOf(';')) : null
    },
    unidade: { id: u.id, bloco: u.bloco, numero: u.numero, quartos: quartosDaUnidade(u), ...statusDaUnidade(u) },
    titulares: titulares.map((t) => ({ id: t.id, nome: t.nome, cpf: t.cpf, principal: t.principal, emailSugerido: t.email })),
    presentes,
    signatarios: quem.ok ? quem.signatarios : [],
    avisoAssinantes: quem.ok ? null : quem.erro,
    documentoLiberado: !travado(ag) && !calperJaAssinou
  };

  if (!bloqueio && passo === 4 && !calperJaAssinou) {
    return { ...base, texto: await montarTermoVistoria(ag, locals.funcionario.nome) };
  }
  return base;
}

export const actions = {
  // Etapa 1: quem comparece. Compradores marcados (cada um com e-mail para assinar) e/ou procurador (com procuração).
  salvarPresentes: async (event) => {
    const { request, params, locals } = event;
    const ag = await buscarVistoria(params.id);
    const bloqueada = travado(ag);
    if (bloqueada) return fail(400, { erro: bloqueada });
    if (documentoDaVistoria(ag)) {
      return fail(400, { erro: 'O termo já foi enviado ao DocuSign: não dá para trocar quem comparece. Para corrigir um e-mail, use "Corrigir e-mail".' });
    }
    const form = await request.formData();
    const titulares = titularesDaUnidade(ag.unidade);
    const marcados = new Set(form.getAll('presente').map(String));
    const presentes = [];

    for (const t of titulares.filter((x) => marcados.has(x.id))) {
      const email = String(form.get(`email_${t.id}`) ?? '').trim();
      if (email && !emailValido(email)) return fail(400, { erro: `O e-mail de ${t.nome} não é válido.` });
      presentes.push({ nome: t.nome, cpf: t.cpf ?? null, email, vinculo: t.principal ? 'comprador_principal' : 'comprador' });
    }

    let procuracaoNova = null;
    if (form.get('procurador') === 'sim') {
      const nome = String(form.get('procNome') ?? '').trim();
      const cpf = somenteDigitos(form.get('procCpf'));
      const email = String(form.get('procEmail') ?? '').trim();
      if (nome.length < 3) return fail(400, { erro: 'Informe o nome completo do procurador.' });
      if (!cpfValido(cpf)) return fail(400, { erro: 'Informe um CPF válido do procurador.' });
      if (email && !emailValido(email)) return fail(400, { erro: 'O e-mail do procurador não é válido.' });
      try {
        procuracaoNova = await arquivoParaBase64(form.get('procuracao'), {
          tipos: TIPOS_PROCURACAO,
          mensagemTipo: 'A procuração precisa ser um documento: PDF, DOC ou DOCX. Para foto, use o botão "Tirar foto" (ela vira PDF).'
        });
      } catch (err) {
        return fail(400, { erro: err.message });
      }
      // mesma regra da entrega: a procuração anexada só vale se for da mesma pessoa (mesmo CPF)
      if (!procuracaoNova && !procuracaoValidaParaProcurador(ag, cpf)) {
        return fail(400, {
          erro: ag.procuracaoBase64
            ? 'A procuração anexada é de outra pessoa: envie a procuração do procurador que comparece.'
            : 'Procurador comparece: envie a procuração para continuar.'
        });
      }
      presentes.push({ nome, cpf, email, vinculo: 'procurador' });
    }

    if (presentes.length === 0) {
      return fail(400, { erro: 'Marque quem comparece: pelo menos um comprador ou um procurador com procuração.' });
    }

    await db.$transaction([
      db.agendamento.update({
        where: { id: ag.id },
        data: {
          vistoriaPresentes: presentes,
          checkinEm: ag.checkinEm ?? new Date(),
          ...(procuracaoNova ? { procuracaoBase64: procuracaoNova, procuracaoCpf: presentes.find((p) => p.vinculo === 'procurador').cpf } : {})
        }
      }),
      ...(procuracaoNova
        ? [
            db.procuracaoUnidade.create({
              data: {
                unidadeId: ag.unidadeId,
                agendamentoId: ag.id,
                nome: presentes.find((p) => p.vinculo === 'procurador').nome,
                cpf: presentes.find((p) => p.vinculo === 'procurador').cpf,
                origem: 'atendimento',
                arquivoBase64: procuracaoNova
              }
            })
          ]
        : [])
    ]);
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'vistoria_presentes_registrados',
      descricao: `${rotuloFuncionario(locals.funcionario)} registrou quem comparece à vistoria ${ag.vistoriaNumero} — ${rotuloUnidade(ag.unidade)}: ${presentes.map((p) => `${p.nome} (${p.vinculo === 'procurador' ? 'procurador' : 'comprador'})`).join(', ')}${procuracaoNova ? '; procuração anexada' : ''}`,
      entidadeTipo: 'Agendamento',
      entidadeId: ag.id
    });
    throw redirect(303, irPara(ag.id, 2));
  },

  // Observações livres do atendimento (etapa 2 e resumo). Vão para o resumo e para os CSVs.
  salvarObservacoes: async (event) => {
    const { request, params, locals } = event;
    const ag = await buscarVistoria(params.id);
    if (ag.status === 'cancelado') return fail(400, { erro: CANCELADO });
    const form = await request.formData();
    const observacoes = String(form.get('observacoes') ?? '').trim().slice(0, 2000);
    await db.agendamento.update({ where: { id: ag.id }, data: { observacoesAtendimento: observacoes || null } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'observacoes_atendimento_salvas',
      descricao: `${rotuloFuncionario(locals.funcionario)} ${observacoes ? 'registrou' : 'apagou'} as observações da vistoria — ${rotuloUnidade(ag.unidade)}${observacoes ? `: "${observacoes.slice(0, 200)}"` : ''}`,
      entidadeTipo: 'Agendamento',
      entidadeId: ag.id
    });
    return { sucesso: 'observacoes' };
  },

  // Etapa 3: resultado. Aceita → segue para o termo. Não aceita → reparos e telefone, sem documento; a vistoria fecha aqui.
  registrarResultado: async (event) => {
    const { request, params, locals } = event;
    const ag = await buscarVistoria(params.id);
    const bloqueada = travado(ag);
    if (bloqueada) return fail(400, { erro: bloqueada });
    if (documentoDaVistoria(ag)) return fail(400, { erro: 'O termo já foi enviado ao DocuSign: o resultado não pode mais mudar.' });
    const presentes = presentesDoAgendamento(ag);
    const procurador = presentes.find((p) => p.vinculo === 'procurador');
    if (presentes.length === 0 || (procurador && !procuracaoValidaParaProcurador(ag, procurador.cpf))) {
      return fail(400, { erro: 'Registre quem comparece (com a procuração, se for procurador) antes do resultado.' });
    }
    const form = await request.formData();
    const resultado = String(form.get('resultado') ?? '');
    const local = rotuloUnidade(ag.unidade);

    if (resultado === RESULTADO.aceita) {
      await db.agendamento.update({
        where: { id: ag.id },
        data: { vistoriaResultado: RESULTADO.aceita, vistoriaReparos: null, vistoriaTelefoneRetorno: null }
      });
      await registrarLog({
        event,
        atorTipo: 'funcionario',
        acao: 'vistoria_resultado_aceita',
        descricao: `${rotuloFuncionario(locals.funcionario)} registrou a vistoria ${ag.vistoriaNumero} como aceita — ${local}; falta o termo assinado`,
        entidadeTipo: 'Agendamento',
        entidadeId: ag.id
      });
      throw redirect(303, irPara(ag.id, 4));
    }

    if (resultado !== RESULTADO.naoAceita) return fail(400, { erro: 'Escolha o resultado da vistoria: aceita ou não aceita.' });
    const reparos = String(form.get('reparos') ?? '').trim().slice(0, 4000);
    const telefone = String(form.get('telefoneRetorno') ?? '').trim().slice(0, 40);
    if (reparos.length < 3) return fail(400, { erro: 'Descreva os reparos necessários: o campo é obrigatório na vistoria não aceita.' });
    if (somenteDigitos(telefone).length < 10) return fail(400, { erro: 'Informe um telefone para contato (com DDD): o campo é obrigatório na vistoria não aceita.' });

    await db.$transaction([
      db.agendamento.update({
        where: { id: ag.id },
        data: {
          vistoriaResultado: RESULTADO.naoAceita,
          vistoriaReparos: reparos,
          vistoriaTelefoneRetorno: telefone,
          status: 'realizado',
          vistoriaConcluidaEm: new Date()
        }
      }),
      db.historicoUnidade.create({
        data: { unidadeId: ag.unidadeId, tipo: 'apontamento', descricao: `Vistoria ${ag.vistoriaNumero} não aceita. Reparos: ${reparos.slice(0, 500)}`, criadoPorId: locals.funcionario.id }
      })
    ]);
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'vistoria_nao_aceita',
      descricao: `${rotuloFuncionario(locals.funcionario)} registrou a vistoria ${ag.vistoriaNumero} como não aceita — ${local}. Reparos: "${reparos.slice(0, 200)}". Telefone: ${telefone}`,
      entidadeTipo: 'Agendamento',
      entidadeId: ag.id
    });
    throw redirect(303, irPara(ag.id, 5));
  },

  // Leitura do termo (PDF) na tela do atendimento, antes de criar o envelope.
  previa: async ({ request, params, locals }) => {
    const ag = await buscarVistoria(params.id);
    const form = await request.formData();
    const texto = String(form.get('texto') ?? '');
    if (!texto.trim()) return fail(400, { erro: 'Documento inválido.' });
    const quem = signatariosDoAgendamento(ag);
    if (!quem.ok) return fail(400, { erro: quem.erro });
    try {
      return { previa: { pdfBase64: await gerarPdfBase64(texto, NOME_DOCUMENTO_VISTORIA, 'vistoria') } };
    } catch (err) {
      console.error('Prévia do termo da vistoria:', err);
      return fail(400, { erro: 'Não foi possível gerar a leitura do documento.' });
    }
  },

  enviar: async (event) => {
    const form = await event.request.formData();
    const resultado = await enviarTermoVistoria(event, { agendamentoId: event.params.id, texto: String(form.get('texto') ?? '') });
    return fail(400, { erro: resultado.erro });
  },

  verificar: async (event) => {
    const ag = await buscarVistoria(event.params.id);
    const doc = documentoDaVistoria(ag);
    if (!doc) return fail(404, { erro: 'Documento não encontrado.' });
    try {
      const { status } = await sincronizarTermoVistoria({ ...doc, agendamentoId: ag.id }, event);
      return { verificado: { status, em: new Date().toISOString() } };
    } catch (err) {
      console.error('DocuSign (verificar vistoria):', err?.response?.body ?? err);
      return fail(400, { erro: 'Não foi possível consultar o DocuSign agora. Tente novamente em instantes.' });
    }
  },

  // "Corrigir e-mail": o e-mail de um proprietário/procurador estava errado. Atualiza o cadastro e o destinatário no DocuSign.
  corrigirEmail: async (event) => {
    const { request, params, locals } = event;
    const ag = await buscarVistoria(params.id);
    if (ag.status === 'cancelado') return fail(400, { erroEmail: CANCELADO });
    const form = await request.formData();
    const indice = Number(form.get('quem'));
    const novo = String(form.get('email') ?? '').trim();
    if (!emailValido(novo)) return fail(400, { erroEmail: 'Informe um e-mail válido.' });
    const presentes = presentesDoAgendamento(ag);
    const signatarios = presentes.filter((p) => p.vinculo !== 'procurador').concat(presentes.filter((p) => p.vinculo === 'procurador'));
    const pessoa = signatarios[indice];
    if (!pessoa) return fail(400, { erroEmail: 'Escolha quem terá o e-mail corrigido.' });
    if (novo.toLowerCase() === String(pessoa.email ?? '').toLowerCase()) return fail(400, { erroEmail: 'Esse já é o e-mail cadastrado.' });
    if (signatarios.some((p, i) => i !== indice && String(p.email ?? '').toLowerCase() === novo.toLowerCase())) {
      return fail(400, { erroEmail: 'O e-mail precisa ser diferente do das outras pessoas que assinam: cada uma recebe o próprio link.' });
    }

    const doc = documentoDaVistoria(ag);
    if (doc) {
      if (doc.status === 'assinado') return fail(400, { erroEmail: 'Todos já assinaram: não há mais o que corrigir no envelope.' });
      try {
        const situacao = await situacaoDoEnvelopeVistoria(doc.docusignEnvelopeId);
        const alvo = situacao.clientes.find((c) => c.recipientId === DESTINATARIO_VISTORIA.assinante(indice + 1));
        if (alvo?.assinou) return fail(400, { erroEmail: `${pessoa.nome} já assinou: o e-mail não pode mais ser corrigido no envelope.` });
      } catch (err) {
        console.error('DocuSign (situação antes de corrigir e-mail da vistoria):', err?.response?.body ?? err);
        return fail(502, { erroEmail: 'Não foi possível consultar o DocuSign agora. Nada foi alterado; tente de novo em instantes.' });
      }
      try {
        await corrigirEmailDoDestinatario({
          envelopeId: doc.docusignEnvelopeId,
          destinatario: DESTINATARIO_VISTORIA.assinante(indice + 1),
          nome: pessoa.nome,
          email: novo,
          reenviar: doc.status === 'aguardando_cliente'
        });
      } catch (err) {
        console.error('DocuSign (corrigir e-mail da vistoria):', err?.response?.body ?? err);
        return fail(502, { erroEmail: 'O DocuSign não aceitou a correção agora. Nada foi alterado; tente de novo em instantes.' });
      }
    }

    // a ordem dos signatários no envelope é compradores primeiro, procurador por último: grava na mesma pessoa
    const atualizados = presentes.map((p) => (p.nome === pessoa.nome && p.vinculo === pessoa.vinculo ? { ...p, email: novo } : p));
    await db.agendamento.update({ where: { id: ag.id }, data: { vistoriaPresentes: atualizados } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'email_assinante_corrigido',
      descricao: `${rotuloFuncionario(locals.funcionario)} corrigiu o e-mail de ${pessoa.nome} (vistoria) de ${pessoa.email ?? '—'} para ${novo} — ${rotuloUnidade(ag.unidade)}${doc ? ' (envelope do DocuSign atualizado)' : ''}`,
      entidadeTipo: 'Agendamento',
      entidadeId: ag.id
    });
    return { sucessoEmail: `E-mail de ${pessoa.nome} corrigido para ${novo}.${doc ? ' O DocuSign foi atualizado.' : ''}` };
  },

  // Revistoria: só admin e supervisor, só depois de "não aceita"; data/horário da agenda de vistoria (com vagas) ou "agora".
  abrirRevistoria: async (event) => {
    const { request, params, locals } = event;
    if (!podeGerirAgendamentos(locals.funcionario.perfil)) return fail(403, { erroRevistoria: 'Só admin e supervisor abrem a revistoria.' });
    const form = await request.formData();
    const agora = form.get('quando') === 'agora';
    const data = String(form.get('data') ?? '');
    const horario = String(form.get('horario') ?? '');
    if (!agora && (!data || !horario)) return fail(400, { erroRevistoria: 'Escolha a data e o horário na agenda de vistoria, ou marque "agora".' });
    const r = await abrirRevistoria(event, { agendamentoId: params.id, quando: agora ? 'agora' : { data, horario } });
    if (r.erro) return fail(400, { erroRevistoria: r.erro });
    throw redirect(303, irPara(r.id, 1));
  }
};
