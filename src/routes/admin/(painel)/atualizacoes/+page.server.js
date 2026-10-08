import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { arquivoParaBase64 } from '$lib/server/agendamento.js';
import { enviarEmail, templateAtualizacaoObra } from '$lib/server/email.js';

export async function load() {
  const [empreendimentos, atualizacoes] = await Promise.all([
    db.empreendimento.findMany({ orderBy: { nome: 'asc' } }),
    db.atualizacaoEstagio.findMany({
      include: { empreendimento: true, emails: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  return {
    empreendimentos,
    atualizacoes: atualizacoes.map((a) => ({
      id: a.id,
      empreendimento: a.empreendimento.nome,
      titulo: a.titulo,
      descricao: a.descricao,
      temMidia: Boolean(a.midiaBase64),
      totalEmails: a.emails.length,
      enviados: a.emails.filter((e) => e.enviado).length,
      createdAt: a.createdAt
    }))
  };
}

export const actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData();
    const empreendimentoId = String(form.get('empreendimentoId') ?? '');
    const titulo = String(form.get('titulo') ?? '').trim();
    const descricao = String(form.get('descricao') ?? '').trim();

    if (!empreendimentoId || !titulo || !descricao) {
      return fail(400, { erro: 'Preencha empreendimento, título e descrição.' });
    }

    const empreendimento = await db.empreendimento.findUnique({ where: { id: empreendimentoId } });
    if (!empreendimento) return fail(400, { erro: 'Empreendimento não encontrado.' });

    let midiaBase64 = null;
    const midia = form.get('midia');
    if (midia && typeof midia !== 'string' && midia.size > 0) {
      try {
        midiaBase64 = await arquivoParaBase64(midia);
      } catch (err) {
        return fail(400, { erro: err.message });
      }
    }

    const atualizacao = await db.atualizacaoEstagio.create({
      data: {
        empreendimentoId,
        titulo,
        descricao,
        midiaBase64,
        publicadoPorId: locals.funcionario.id
      }
    });

    await db.empreendimento.update({ where: { id: empreendimentoId }, data: { estagioAtual: titulo } });

    // destinatários: todos os e-mails de investidores com unidade nesse empreendimento
    const vinculos = await db.unidadeInvestidor.findMany({
      where: { unidade: { empreendimentoId } },
      include: { investidor: true },
      distinct: ['investidorId']
    });

    const resultados = await Promise.allSettled(
      vinculos.map((v) =>
        enviarEmail({
          to: v.email,
          subject: `Atualização — ${empreendimento.nome}`,
          html: templateAtualizacaoObra({
            nomeInvestidor: v.investidor.nome,
            empreendimento: empreendimento.nome,
            titulo,
            descricao
          })
        })
      )
    );

    await db.emailEnviado.createMany({
      data: vinculos.map((v, i) => ({
        atualizacaoId: atualizacao.id,
        investidorId: v.investidorId,
        email: v.email,
        enviado: resultados[i].status === 'fulfilled',
        erro: resultados[i].status === 'rejected' ? String(resultados[i].reason?.message ?? 'erro') : null
      }))
    });

    // sino pra cada investidor do empreendimento — o e-mail já foi disparado acima
    await db.notificacao.createMany({
      data: vinculos.map((v) => ({
        destinatarioTipo: 'investidor',
        investidorId: v.investidorId,
        titulo: `Atualização — ${empreendimento.nome}`,
        mensagem: titulo,
        link: '/jornada'
      }))
    });

    return { sucesso: true, totalEnviados: vinculos.length };
  }
};