import { redirect } from '@sveltejs/kit';
import { formatarCpf } from '$lib/cpf.js';
import { dataHoraAgendada, dataHoraBr, respostaCsv, sn } from '$lib/server/csv.js';
import { filtrosDePresenca } from '$lib/server/presenca.js';
import { buscarSituacaoEntregas } from '$lib/server/situacaoEntregas.js';

const ROTULO_DOC = {
  pendente: 'aguardando a Calper',
  calper_assinou: 'Calper assinou',
  aguardando_cliente: 'aguardando o cliente',
  assinado: 'assinado'
};

// CSV com os dois grupos de quem agendou a entrega de chaves: quem já recebeu (com a data) e quem ainda
// não recebeu (pra a equipe cobrar). Mesmos filtros da tela.
export async function GET({ url, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const { filtros } = filtrosDePresenca(url.searchParams);
  const { receberam, faltam } = await buscarSituacaoEntregas(filtros);

  const linha = (situacao, i) => {
    const { data, hora } = dataHoraAgendada(i.agendadoPara);
    return [
      situacao,
      i.bloco,
      i.numero,
      i.agendouNome,
      i.cpf ? formatarCpf(i.cpf) : '',
      i.telefone,
      i.email,
      i.ehProprietario === null ? '' : sn(i.ehProprietario),
      i.proprietarioNome,
      data,
      hora,
      i.entregueEm ? 'sim' : sn(i.compareceu),
      i.retirante,
      dataHoraBr(i.entregueEm),
      ROTULO_DOC[i.documentos.termo] ?? 'não enviado',
      ROTULO_DOC[i.documentos.checklist] ?? 'não enviado'
    ];
  };

  const linhas = [
    ['Situação', 'Bloco', 'Unidade', 'Quem agendou', 'CPF', 'Telefone', 'E-mail', 'É o proprietário', 'Nome do proprietário', 'Data agendada', 'Hora agendada', 'Compareceu', 'Quem retirou/retira', 'Chave entregue em', 'Termo', 'Checklist'],
    ...faltam.map((i) => linha('Ainda não recebeu', i)),
    ...receberam.map((i) => linha('Recebeu a chave', i))
  ];
  return respostaCsv('entrega-chaves-recebeu-x-falta.csv', linhas);
}
