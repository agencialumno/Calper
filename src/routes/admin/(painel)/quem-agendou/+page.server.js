import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { agendaPublica } from '$lib/server/agenda.js';
import { LISTA_SERVICOS, servicoDoSlug, rotuloDoServico } from '$lib/servicos.js';
import { rotuloDaVistoria } from '$lib/vistoria.js';
import { filtrosQuemAgendou } from '$lib/server/quemAgendou.js';
import { alterarUnidade, bloqueiosDoAgendamento, desmarcar, remarcar, unidadesParaTroca } from '$lib/server/gestaoAgendamento.js';
import { podeGerirAgendamentos } from '$lib/gestaoAgendamento.js';

// Todas as pessoas que agendaram entrega de chaves ou vistoria pelo formulário público (/agendar-entrega-chaves),
// inclusive agendamentos cancelados, pra a equipe ter a lista completa de quem agendou.
export async function load({ url, locals }) {
  const { filtros, where } = filtrosQuemAgendou(url.searchParams);
  const podeGerir = podeGerirAgendamentos(locals.funcionario.perfil);

  const [agendamentos, total] = await Promise.all([
    db.agendamento.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        dataHora: true,
        status: true,
        origem: true,
        vistoriaNumero: true,
        vistoriaResultado: true,
        tipoEvento: { select: { slug: true } },
        nomeCompareceu: true,
        cpfCompareceu: true,
        telefoneCompareceu: true,
        emailCompareceu: true,
        ehProprietario: true,
        proprietarioNome: true,
        procuracaoCpf: true, // só pra saber se há procuração, sem trazer o arquivo
        unidadeOriginalId: true,
        checkinEm: true,
        retiranteNome: true,
        observacoesAtendimento: true,
        canceladoEm: true,
        motivoCancelamento: true,
        _count: { select: { presencas: true, documentosAssinados: true } },
        unidade: { select: { id: true, bloco: true, numero: true } }
      }
    }),
    db.agendamento.count({ where: { tipoEvento: { slug: filtros.servico === 'todos' ? { in: LISTA_SERVICOS.map((x) => x.slug) } : filtros.servico || 'entrega-chaves' } } })
  ]);

  // quais têm arquivo enviado no agendamento (só os ids: sem trazer o base64 pesado)
  const ids = agendamentos.map((a) => a.id);
  const [comIdentidade, comProcuracaoArquivo, unidadesAntigas] = await Promise.all([
    db.agendamento.findMany({ where: { id: { in: ids }, documentoBase64: { not: null } }, select: { id: true } }),
    db.agendamento.findMany({ where: { id: { in: ids }, procuracaoBase64: { not: null } }, select: { id: true } }),
    db.unidade.findMany({ where: { id: { in: agendamentos.map((a) => a.unidadeOriginalId).filter(Boolean) } }, select: { id: true, bloco: true, numero: true } })
  ]);
  const idsIdentidade = new Set(comIdentidade.map((a) => a.id));
  const idsProcuracao = new Set(comProcuracaoArquivo.map((a) => a.id));
  const unidadeAntiga = new Map(unidadesAntigas.map((u) => [u.id, `Bloco ${u.bloco} - nº ${u.numero}`]));
  // opções das ações (só para admin/supervisor): unidades livres e horários com vaga
  // (vagas e unidades livres de cada serviço: a troca e a remarcação respeitam o serviço do agendamento)
  const servicos = LISTA_SERVICOS.map((x) => x.valor);
  const [livres, agendas] = podeGerir
    ? await Promise.all([
        Promise.all(servicos.map((sv) => unidadesParaTroca(sv))),
        Promise.all(servicos.map((sv) => agendaPublica(new Date(), { servico: sv })))
      ])
    : [[], []];
  const unidadesLivres = Object.fromEntries(servicos.map((sv, i) => [sv, livres[i] ?? []]));
  const agenda = Object.fromEntries(servicos.map((sv, i) => [sv, agendas[i] ?? []]));

  return {
    podeGerir,
    unidadesLivres,
    agenda,
    filtros,
    servicos: LISTA_SERVICOS.map((x) => ({ valor: x.valor, rotulo: x.rotulo })),
    exportarHref: `/admin/quem-agendou/exportar?${url.searchParams}`,
    total,
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      agendadoEm: a.createdAt,
      dataHora: a.dataHora,
      status: a.status,
      direto: a.origem === 'atendimento_direto',
      servico: servicoDoSlug(a.tipoEvento.slug),
      servicoRotulo: rotuloDoServico(servicoDoSlug(a.tipoEvento.slug)),
      vistoriaNumero: servicoDoSlug(a.tipoEvento.slug) === 'vistoria' ? a.vistoriaNumero : null,
      // resultado do atendimento da vistoria (aceita / não aceita); nulo enquanto não houve resultado
      vistoriaResultado: servicoDoSlug(a.tipoEvento.slug) === 'vistoria' ? a.vistoriaResultado : null,
      vistoriaResultadoRotulo: servicoDoSlug(a.tipoEvento.slug) === 'vistoria' && a.vistoriaResultado ? rotuloDaVistoria(a) : null,
      nome: a.nomeCompareceu,
      cpf: a.cpfCompareceu,
      telefone: a.telefoneCompareceu,
      email: a.emailCompareceu,
      ehProprietario: a.ehProprietario,
      proprietarioNome: a.proprietarioNome,
      temProcuracao: Boolean(a.procuracaoCpf),
      unidadeId: a.unidade.id,
      unidade: `Bloco ${a.unidade.bloco} - nº ${a.unidade.numero}`,
      canceladoEm: a.canceladoEm,
      motivoCancelamento: a.motivoCancelamento,
      bloqueios: bloqueiosDoAgendamento(a),
      // identidade/procuração enviadas no agendamento de uma unidade que foi trocada: pedir novo envio para a nova
      trocouUnidade: a.unidadeOriginalId && a.unidadeOriginalId !== a.unidade.id ? { de: unidadeAntiga.get(a.unidadeOriginalId) ?? '—' } : null,
      temIdentidadeEnviada: idsIdentidade.has(a.id),
      temProcuracaoEnviada: idsProcuracao.has(a.id)
    }))
  };
}

// Alterar / Remarcar / Desmarcar: só admin e supervisor. O hooks já responde 403 ao colaborador nesta rota (POST de quem
// só lê) e a regra é conferida de novo na lib (defesa dupla).
const responder = (r) => (r.ok ? { sucesso: r.mensagem } : fail(r.status ?? 400, { erro: r.erro }));

export const actions = {
  alterar: async (event) => {
    const form = await event.request.formData();
    return responder(await alterarUnidade(event, { agendamentoId: form.get('agendamentoId'), novaUnidadeId: form.get('unidadeId') }));
  },
  remarcar: async (event) => {
    const form = await event.request.formData();
    return responder(await remarcar(event, { agendamentoId: form.get('agendamentoId'), data: form.get('data'), horario: form.get('horario') }));
  },
  desmarcar: async (event) => {
    const form = await event.request.formData();
    return responder(await desmarcar(event, { agendamentoId: form.get('agendamentoId'), motivo: form.get('motivo') }));
  }
};
