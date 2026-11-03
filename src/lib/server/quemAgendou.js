import { LISTA_SERVICOS, slugDoServico } from '../servicos.js';

/** Filtros de /admin/quem-agendou (busca, status e serviço) a partir da query string; o CSV usa os mesmos. */
export function filtrosQuemAgendou(searchParams) {
  const q = (searchParams.get('q') ?? '').trim();
  const status = searchParams.get('status') ?? '';
  // sem serviço escolhido, continua só a entrega de chaves (como sempre); 'todos' lista os dois
  const pedido = searchParams.get('servico');
  const servico = pedido === 'todos' || LISTA_SERVICOS.some((x) => x.valor === pedido && x.valor !== 'entrega-chaves') ? pedido : '';
  const slugs = servico === 'todos' ? LISTA_SERVICOS.map((x) => x.slug) : [slugDoServico(servico || undefined)];

  const where = {
    tipoEvento: { slug: slugs.length === 1 ? slugs[0] : { in: slugs } },
    ...(['confirmado', 'realizado', 'cancelado'].includes(status) ? { status } : {}),
    ...(q
      ? {
          OR: [
            { nomeCompareceu: { contains: q, mode: 'insensitive' } },
            { proprietarioNome: { contains: q, mode: 'insensitive' } },
            { emailCompareceu: { contains: q, mode: 'insensitive' } },
            { telefoneCompareceu: { contains: q } },
            { cpfCompareceu: { contains: q.replace(/\D/g, '') || '__sem_digitos__' } },
            { unidade: { numero: { contains: q, mode: 'insensitive' } } }
          ]
        }
      : {})
  };
  return { filtros: { q, status, servico }, where };
}
