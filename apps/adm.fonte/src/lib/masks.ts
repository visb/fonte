import type { ChangeEvent } from 'react';

type FieldReturn = {
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  [key: string]: unknown;
};

export const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export const maskRG = (v: string) => {
  const d = v.replace(/[^0-9Xx]/g, '').slice(0, 9);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}-${d.slice(8)}`;
};

export const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/**
 * Normaliza um telefone para exibição mascarada assumindo um DDD padrão quando
 * ele não veio na origem. Usado só no boundary do import (preview → form/commit):
 * a IA extrai o telefone cru, e aqui garantimos que sai sempre como
 * `(DD) NNNNN-NNNN`. Quando o número tem 8 (fixo) ou 9 (celular) dígitos — ou
 * seja, sem DDD — prefixa o `ddd` padrão. Com 10/11 dígitos o DDD já veio e é
 * respeitado. Mantém `maskPhone`/`withMask` puros (só formatação).
 */
export function normalizePhoneWithDefaultDDD(v: string, ddd = '41') {
  const d = (v ?? '').replace(/\D/g, '');
  if (!d) return '';
  const withDDD = d.length === 8 || d.length === 9 ? `${ddd}${d}` : d;
  return maskPhone(withDDD);
}

export function withMask(field: FieldReturn, maskFn: (v: string) => string) {
  return {
    ...field,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      e.target.value = maskFn(e.target.value);
      return field.onChange(e);
    },
  };
}
