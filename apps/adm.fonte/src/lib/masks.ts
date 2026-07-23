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

/**
 * Helpers de EXIBIÇÃO para documentos (CPF/RG) que já vêm resolvidos do backend.
 *
 * O backend aplica a política LGPD (`SensitiveDataInterceptor` + `@RevealSensitive`):
 * ADMIN/COORDINATOR recebem o documento cru completo; SERVANT recebe a versão
 * redigida (`***.***.789-00` / `***XX`). Reaplicar `maskCPF`/`maskRG` (formatadores
 * de input, dígitos crus → formatado) sobre esse valor pronto quebra o redigido —
 * `***.***.789-00` vira `789.00`. Estes helpers evitam o double-mask: só formatam
 * quando o valor é dígito cru completo; caso contrário devolvem como veio.
 *
 * NÃO substituem `maskCPF`/`maskRG`/`withMask`, que continuam sendo as máscaras de
 * input dos formulários.
 */
export function displayCpf(v?: string | null): string {
  if (v == null) return '';
  if (v.includes('*')) return v;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) return maskCPF(digits);
  return v;
}

export function displayRg(v?: string | null): string {
  if (v == null) return '';
  if (v.includes('*')) return v;
  const raw = v.replace(/[^0-9Xx]/g, '');
  // Só reformata quando o valor veio cru (sem separadores) — evita mexer no que já
  // chegou formatado ou redigido.
  if (raw.length > 0 && raw === v) return maskRG(raw);
  return v;
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
