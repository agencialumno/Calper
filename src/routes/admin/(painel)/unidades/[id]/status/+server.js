import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { podeEditar } from '$lib/perfis.js';
import { ROTULO_CAMPO, ROTULO_QUITACAO } from '$lib/rotulosUnidade.js';

// Alteração rápida dos dados de status da unidade direto pelos cartões (abas Unidades e Chaves, e o atendimento).
// Só admin e supervisor: a guarda de /admin já barra o colaborador (POST), e aqui conferimos de novo.
const CAMPOS = ['tipologia', 'grupo', 'statusQuitacao', 'vistoriaStatus', 'escrituraAtual'];

const texto = (v, max) => {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return t === '' ? null : t.slice(0, max);
};

/** Valida o valor de um campo; devolve { ok, valor } ou { ok: false, erro }. */
function validar(campo, bruto) {
  if (campo === 'grupo') {
    const v = texto(bruto, 1)?.toUpperCase() ?? null;
    return v === null || ['A', 'B'].includes(v) ? { ok: true, valor: v } : { ok: false, erro: 'Grupo precisa ser A ou B.' };
  }
  if (campo === 'statusQuitacao') {
    const v = texto(bruto, 30);
    return v === null || ROTULO_QUITACAO[v] ? { ok: true, valor: v } : { ok: false, erro: 'Status-Quitação inválido.' };
  }
  return { ok: true, valor: texto(bruto, campo === 'tipologia' ? 40 : 200) };
}

export async function POST(event) {
  const { params, request, locals } = event;
  if (!locals.funcionario || !podeEditar(locals.funcionario.perfil)) throw error(403, 'Seu perfil não pode alterar dados.');

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    throw error(400, 'Dados inválidos.');
  }
  const unidade = await db.unidade.findUnique({ where: { id: params.id } });
  if (!unidade) throw error(404, 'Unidade não encontrada.');

  const data = {};
  const mudancas = [];
  for (const campo of CAMPOS) {
    if (!(campo in corpo)) continue;
    const v = validar(campo, corpo[campo]);
    if (!v.ok) return json({ erro: v.erro }, { status: 400 });
    const atual = unidade[campo] ?? null;
    if (v.valor === atual) continue;
    data[campo] = v.valor;
    mudancas.push(`${ROTULO_CAMPO[campo]}: ${atual ?? '—'} → ${v.valor ?? '—'}`);
  }
  if (mudancas.length === 0) return json({ ok: true, alterado: false });
  // a vistoria aprovada acompanha o status da vistoria
  if ('vistoriaStatus' in data) data.vistoriaAprovada = String(data.vistoriaStatus ?? '').trim().toUpperCase() === 'APROVADA';

  await db.unidade.update({ where: { id: unidade.id }, data });
  await db.historicoUnidade.create({
    data: { unidadeId: unidade.id, tipo: 'outro', descricao: `Status atualizado: ${mudancas.join('; ')}`, criadoPorId: locals.funcionario.id }
  });
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'unidade_editada',
    descricao: `${rotuloFuncionario(locals.funcionario)} atualizou o status da Unidade ${unidade.numero}, Bloco ${unidade.bloco} (${mudancas.join('; ')})`,
    entidadeTipo: 'Unidade',
    entidadeId: unidade.id
  });
  return json({ ok: true, alterado: true });
}
