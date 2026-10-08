// Pesquisa pós-visita — constantes compartilhadas entre form (client) e validação (server).

export const ESCALA = [
  { valor: 'otimo', rotulo: 'Ótimo', pontos: 5 },
  { valor: 'muito_bom', rotulo: 'Muito Bom', pontos: 4 },
  { valor: 'bom', rotulo: 'Bom', pontos: 3 },
  { valor: 'ruim', rotulo: 'Ruim', pontos: 2 },
  { valor: 'pessimo', rotulo: 'Péssimo', pontos: 1 }
];

const PONTOS_POR_VALOR = Object.fromEntries(ESCALA.map((e) => [e.valor, e.pontos]));
const VALORES_VALIDOS = new Set(ESCALA.map((e) => e.valor));

export function escalaValida(valor) {
  return VALORES_VALIDOS.has(valor);
}

export const PERGUNTAS_ESCALA = [
  { campo: 'educacaoFuncionarios', rotulo: 'Educação dos funcionários' },
  { campo: 'organizacaoLimpeza', rotulo: 'Organização e limpeza da obra' },
  { campo: 'expectativasAndamento', rotulo: 'Expectativas quanto ao andamento' },
  { campo: 'clarezaInformacoes', rotulo: 'Clareza das informações' },
  { campo: 'acabamentoObra', rotulo: 'Acabamento / obra em geral' }
];

/** Média (0–5) das 5 respostas de escala de uma pesquisa. */
export function mediaPesquisa(pesquisa) {
  const pontos = PERGUNTAS_ESCALA.map((p) => PONTOS_POR_VALOR[pesquisa[p.campo]] ?? 0);
  return pontos.reduce((a, b) => a + b, 0) / pontos.length;
}