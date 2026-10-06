// Utilitários de CPF — isomórficos (sem dependências de Node), usados tanto
// no servidor quanto no navegador (ex: validação ao vivo na importação em massa).

/** Valida CPF (dígitos verificadores) — aceita com ou sem pontuação. */
export function cpfValido(cpfBruto) {
  if (!cpfBruto) return false;
  const cpf = String(cpfBruto).replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calcDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcDigito(cpf.slice(0, 9));
  const d2 = calcDigito(cpf.slice(0, 9) + d1);
  return cpf === cpf.slice(0, 9) + String(d1) + String(d2);
}

export function somenteDigitos(cpfBruto) {
  return String(cpfBruto ?? '').replace(/\D/g, '');
}

export function formatarCpf(cpfBruto) {
  const cpf = somenteDigitos(cpfBruto).padEnd(11, '_').slice(0, 11);
  return cpf.replace(/(.{3})(.{3})(.{3})(.{2})/, '$1.$2.$3-$4');
}

export function emailValido(emailBruto) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(emailBruto ?? '').trim());
}
