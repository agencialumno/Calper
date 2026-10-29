// Cor da etiqueta "Escritura atual" — UM mapa só, usado em todo lugar onde a etiqueta aparece (aba Unidades, aba Chaves,
// dossiê e passo 1 do atendimento, que usam o mesmo componente UnidadeStatus). A cor nunca é a única informação: o texto
// do status fica dentro da etiqueta. Fundo claro (100) + texto escuro (800/900): contraste acima de 4,5:1 (testado).
//
// As classes do Tailwind estão escritas por extenso de propósito (o Tailwind só gera o que encontra no código). Os hex
// de `fundo`/`texto` são os mesmos da paleta do Tailwind e servem para o teste de contraste.

const semAcento = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

/** Chave de comparação: sem acento, caixa alta, hífens/travessões e espaços repetidos viram um espaço só. */
export const chaveEscritura = (valor) => semAcento(valor).replace(/[-–—_]+/g, ' ').replace(/\s+/g, ' ').trim();

export const NEUTRO = { cor: 'cinza', classe: 'bg-gray-100 text-gray-700', fundo: '#f3f4f6', texto: '#374151' };

export const CORES_ESCRITURA = {
  'CESSAO ARREMATACAO': { cor: 'vermelho', classe: 'bg-red-100 text-red-800', fundo: '#fee2e2', texto: '#991b1b' },
  'PENDENTE ESCRITURA': { cor: 'laranja', classe: 'bg-orange-100 text-orange-800', fundo: '#ffedd5', texto: '#9a3412' },
  'ESCRITURA PUBLICA ASSINADA': { cor: 'verde', classe: 'bg-green-100 text-green-800', fundo: '#dcfce7', texto: '#166534' },
  'PROMESSA DE COMPRA E VENDA': { cor: 'azul', classe: 'bg-blue-100 text-blue-800', fundo: '#dbeafe', texto: '#1e40af' },
  'PROMESSA DE CESSAO': { cor: 'ciano', classe: 'bg-cyan-100 text-cyan-900', fundo: '#cffafe', texto: '#164e63' },
  'CESSAO DE DIREITOS': { cor: 'roxo', classe: 'bg-purple-100 text-purple-800', fundo: '#f3e8ff', texto: '#6b21a8' },
  'CESSAO DE DIREITO (INDISPONIBILIDADE)': { cor: 'rosa', classe: 'bg-pink-100 text-pink-800', fundo: '#fce7f3', texto: '#9d174d' }
};
// a chave acima de "indisponibilidade" tem parênteses: normaliza igual às demais
const MAPA = Object.fromEntries(Object.entries(CORES_ESCRITURA).map(([k, v]) => [chaveEscritura(k), v]));

/** Cor da etiqueta para um status de escritura. Valor desconhecido, vazio ou com grafia diferente → neutro (não quebra a tela). */
export function corEscrituraAtual(valor) {
  return MAPA[chaveEscritura(valor)] ?? NEUTRO;
}
