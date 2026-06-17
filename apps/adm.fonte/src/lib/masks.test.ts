import { describe, expect, it, vi } from 'vitest';
import { maskCPF, maskPhone, maskRG, withMask } from './masks';

describe('maskCPF', () => {
  it('formata progressivamente conforme os dígitos', () => {
    expect(maskCPF('123')).toBe('123');
    expect(maskCPF('1234')).toBe('123.4');
    expect(maskCPF('1234567')).toBe('123.456.7');
    expect(maskCPF('12345678901')).toBe('123.456.789-01');
  });

  it('descarta não-dígitos e limita a 11 dígitos', () => {
    expect(maskCPF('abc123def456')).toBe('123.456');
    expect(maskCPF('123456789012345')).toBe('123.456.789-01');
  });
});

describe('maskRG', () => {
  it('formata e aceita X final', () => {
    expect(maskRG('12')).toBe('12');
    expect(maskRG('1234567')).toBe('12.345.67');
    expect(maskRG('12345678X')).toBe('12.345.678-X');
  });
});

describe('maskPhone', () => {
  it('formata telefone fixo (10 dígitos)', () => {
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('formata celular (11 dígitos)', () => {
    expect(maskPhone('11999998888')).toBe('(11) 99999-8888');
  });

  it('formata parcialmente e abre parêntese', () => {
    expect(maskPhone('')).toBe('');
    expect(maskPhone('1')).toBe('(1');
    expect(maskPhone('1199')).toBe('(11) 99');
  });
});

describe('withMask', () => {
  it('aplica a máscara ao valor e repassa o evento ao onChange original', () => {
    const onChange = vi.fn();
    const field = { onChange, name: 'cpf' };
    const wrapped = withMask(field, maskCPF);

    expect(wrapped.name).toBe('cpf');

    const event = {
      target: { value: '12345678901' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    wrapped.onChange(event);

    expect(event.target.value).toBe('123.456.789-01');
    expect(onChange).toHaveBeenCalledWith(event);
  });
});
