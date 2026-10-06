// Avaliação de força de senha — sem dependências, funciona no navegador e no servidor.

export const REQUISITOS = [
  { chave: 'tamanho', rotulo: 'Pelo menos 8 caracteres', teste: (s) => s.length >= 8 },
  { chave: 'maiuscula', rotulo: 'Uma letra maiúscula', teste: (s) => /[A-Z]/.test(s) },
  { chave: 'minuscula', rotulo: 'Uma letra minúscula', teste: (s) => /[a-z]/.test(s) },
  { chave: 'numero', rotulo: 'Um número', teste: (s) => /[0-9]/.test(s) },
  { chave: 'especial', rotulo: 'Um caractere especial (ex: !@#$%)', teste: (s) => /[^A-Za-z0-9]/.test(s) }
];

const ORDEM_NIVEIS = ['vazia', 'fraca', 'media', 'forte', 'muito_forte'];

export const NIVEL_LABEL = {
  vazia: 'Nenhuma',
  fraca: 'Fraca',
  media: 'Média',
  forte: 'Forte',
  muito_forte: 'Muito forte'
};

/** Nível mínimo exigido para a senha ser aceita no sistema. */
export const NIVEL_MINIMO = 'forte';

export function avaliarForcaSenha(senha) {
  const valor = senha ?? '';
  const checklist = REQUISITOS.map((r) => ({ ...r, cumprido: r.teste(valor) }));
  const pontos = checklist.filter((r) => r.cumprido).length;

  let nivel;
  if (!valor) nivel = 'vazia';
  else if (pontos <= 2) nivel = 'fraca';
  else if (pontos === 3) nivel = 'media';
  else if (pontos === 4) nivel = 'forte';
  else nivel = 'muito_forte';

  return { checklist, pontos, nivel, total: REQUISITOS.length };
}

export function senhaAceitavel(senha) {
  const { nivel } = avaliarForcaSenha(senha);
  return ORDEM_NIVEIS.indexOf(nivel) >= ORDEM_NIVEIS.indexOf(NIVEL_MINIMO);
}
