import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { formatarCpf } from '$lib/cpf.js';
import { dataHoraAgendada, dataHoraBr, respostaCsv, sn } from '$lib/server/csv.js';
import { filtrosQuemAgendou } from '$lib/server/quemAgendou.js';

// CSV de "Quem agendou" com os mesmos filtros da tela (busca e status) — sem os arquivos anexos.
export async function GET({ url, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const { where } = filtrosQuemAgendou(url.searchParams);
  const agendamentos = await db.agendamento.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      dataHora: true,
      status: true,
      origem: true,
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

  const linhas = [
    ['Agendado em', 'Nome', 'CPF', 'Telefone', 'E-mail', 'Bloco', 'Unidade', 'Data agendada', 'Hora agendada', 'É o proprietário', 'Nome do proprietário', 'Procuração anexada', 'Status', 'Origem'],
    ...agendamentos.map((a) => {
      const { data, hora } = dataHoraAgendada(a.dataHora);
      return [
        dataHoraBr(a.createdAt),
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
        a.origem === 'atendimento_direto' ? 'Atendimento direto' : 'Agendamento'
      ];
    })
  ];
  return respostaCsv('quem-agendou-entrega-chaves.csv', linhas);
}
