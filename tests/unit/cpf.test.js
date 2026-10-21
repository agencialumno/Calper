import { describe, expect, it } from 'vitest';
import { cpfValido, emailValido, formatarCpf, somenteDigitos } from '../../src/lib/cpf.js';

describe('cpf e e-mail', () => {
  it('valida dígito verificador', () => {
    expect(cpfValido('111.444.777-35')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('12345678900')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });
  it('formata e limpa', () => {
    expect(formatarCpf('11144477735')).toBe('111.444.777-35');
    expect(somenteDigitos('111.444.777-35')).toBe('11144477735');
  });
  it('e-mail', () => {
    expect(emailValido('a@b.com')).toBe(true);
    expect(emailValido('a@b')).toBe(false);
    expect(emailValido('sem arroba')).toBe(false);
  });
});
