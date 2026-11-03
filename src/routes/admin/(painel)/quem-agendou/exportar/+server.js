import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { formatarCpf } from '$lib/cpf.js';
import { dataHoraAgendada, dataHoraBr, respostaCsv, sn } from '$lib/server/csv.js';
import { filtrosQuemAgendou } from '$lib/server/quemAgendou.js';
import { rotuloDoServico, servicoDoSlug } from '$lib/servicos.js';

// CSV de "Quem agendou" com os mesmos filtros da tela (busca, status e serviço) — sem os arquivos anexos.
export async function GET({ url, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const { where, filtros } = filtrosQuemAgendou(url.searchParams);
  const agendamentos = await db.agendamento.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      dataHora: true,
      status: true,
      origem: true,
      vistoriaNumero: true,
      tipoEvento: { select: { slug: true } },
      canceladoEm: true,
      motivoCancelamento: true,
      nomeCompareceu: true,
      cpfCompareceu: true,
      telefoneCompareceu: true,
      emailCompareceu: true,
      ehProprietario: true,
      proprietarioNome: true,
      procuracaoCpf: true,
      unidade: { select: { bloco: true, numero: true } }
    }
  });

  // colunas de serviço só quando o filtro de serviço foi usado (padrão: CSV da entrega, igual ao de sempre)
  const comServico = filtros.servico !== '';
  const linhas = [
    ['Agendado em', ...(comServico ? ['Serviço', 'Nº da vistoria'] : []), 'Nome', 'CPF', 'Telefone', 'E-mail', 'Bloco', 'Unidade', 'Data agendada', 'Hora agendada', 'É o proprietário', 'Nome do proprietário', 'Procuração anexada', 'Status', 'Origem', 'Desmarcado em', 'Motivo do cancelamento'],
    ...agendamentos.map((a) => {
      const { data, hora } = dataHoraAgendada(a.dataHora);
      return [
        dataHoraBr(a.createdAt),
        ...(comServico ? [rotuloDoServico(servicoDoSlug(a.tipoEvento.slug)), servicoDoSlug(a.tipoEvento.slug) === 'vistoria' ? a.vistoriaNumero : ''] : []),
        a.nomeCompareceu,
        a.cpfCompareceu ? formatarCpf(a.cpfCompareceu) : '',
        a.telefoneCompareceu,
        a.emailCompareceu,
        a.unidade.bloco,
        a.unidade.numero,
        data,
        hora,
        a.ehProprietario === null ? '' : sn(a.ehProprietario),
        a.proprietarioNome,
        sn(Boolean(a.procuracaoCpf)),
        a.status,
        a.origem === 'atendimento_direto' ? 'Atendimento direto' : 'Agendamento',
        dataHoraBr(a.canceladoEm),
        a.motivoCancelamento ?? ''
      ];
    })
  ];
  return respostaCsv(comServico ? 'quem-agendou.csv' : 'quem-agendou-entrega-chaves.csv', linhas);
}
