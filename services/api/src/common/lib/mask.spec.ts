import { maskCpf, maskRg, maskSensitiveFields } from './mask';

describe('maskCpf', () => {
  it('masks a well-formed CPF keeping the final block', () => {
    expect(maskCpf('123.456.789-00')).toBe('***.***.789-00');
    expect(maskCpf('12345678900')).toBe('***.***.789-00');
  });

  it('returns *** for malformed CPF', () => {
    expect(maskCpf('123')).toBe('***');
  });

  it('passes through null/undefined', () => {
    expect(maskCpf(null)).toBeNull();
    expect(maskCpf(undefined)).toBeUndefined();
  });
});

describe('maskRg', () => {
  it('keeps only the last two characters', () => {
    expect(maskRg('12.345.678-9')).toBe('***-9');
    expect(maskRg('AB1234')).toBe('***34');
  });

  it('returns *** for very short values', () => {
    expect(maskRg('1')).toBe('***');
  });

  it('passes through null', () => {
    expect(maskRg(null)).toBeNull();
  });
});

describe('maskSensitiveFields', () => {
  it('masks cpf/rg in a flat object', () => {
    const obj = { name: 'Ana', cpf: '12345678900', rg: '123456789' };
    maskSensitiveFields(obj);
    expect(obj.cpf).toBe('***.***.789-00');
    expect(obj.rg).toBe('***89');
    expect(obj.name).toBe('Ana');
  });

  it('masks nested and arrayed objects', () => {
    const payload = {
      data: [
        { cpf: '11111111111', rg: 'X9' },
        { cpf: null, user: { cpf: '22222222222' } },
      ],
    };
    maskSensitiveFields(payload);
    expect(payload.data[0].cpf).toBe('***.***.111-11');
    expect((payload.data[1].user as { cpf: string }).cpf).toBe('***.***.222-22');
    expect(payload.data[1].cpf).toBeNull();
  });

  it('tolerates cycles without infinite recursion', () => {
    const a: Record<string, unknown> = { cpf: '12345678900' };
    a.self = a;
    expect(() => maskSensitiveFields(a)).not.toThrow();
    expect(a.cpf).toBe('***.***.789-00');
  });
});
