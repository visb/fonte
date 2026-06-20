import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { RegistrationField, RegistrationFieldType } from '@fonte/types';

const OPTION_TYPES: RegistrationFieldType[] = ['select', 'multi_select'];

/** Campo como chega do admin: `id` ainda pode estar ausente (gerado aqui). */
export type RegistrationFieldInput = Omit<RegistrationField, 'id'> & { id?: string };

/**
 * Normaliza a definição de campos vinda do admin (story 68):
 * - gera um `id` estável (uuid) para campos sem id;
 * - garante `id` único por evento (400 se houver duplicado);
 * - mantém apenas as opções para tipos que as usam;
 * - reindexa `order` pela posição declarada (0..n-1) para ordenação estável.
 *
 * A validação de forma (label, type ∈ enum, options não-vazio p/ select) já
 * acontece no DTO via class-validator; aqui cuidamos da unicidade dos ids.
 */
export function normalizeRegistrationFields(
  input: RegistrationFieldInput[] | undefined,
): RegistrationField[] {
  if (!input || input.length === 0) return [];

  const seen = new Set<string>();
  return input.map((field, index) => {
    const id = field.id && field.id.trim() ? field.id.trim() : randomUUID();
    if (seen.has(id)) {
      throw new BadRequestException(
        `id de campo duplicado no formulário de inscrição: ${id}`,
      );
    }
    seen.add(id);

    const normalized: RegistrationField = {
      id,
      label: field.label,
      type: field.type,
      required: field.required,
      order: index,
    };
    if (OPTION_TYPES.includes(field.type)) {
      normalized.options = field.options ?? [];
    }
    if (field.placeholder != null && field.placeholder !== '') {
      normalized.placeholder = field.placeholder;
    }
    return normalized;
  });
}

const PHONE_RE = /^[+()\d\s.-]{5,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

/**
 * Valida e coage as respostas dos campos custom (story 68) a partir da
 * definição do evento. Lança 400 se um campo obrigatório falta ou se o tipo é
 * incompatível. Retorna o mapa apenas com os fieldIds conhecidos (ignora chaves
 * estranhas) e valores já normalizados.
 */
export function validateAndPickAnswers(
  fields: RegistrationField[],
  rawAnswers: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const answers = rawAnswers ?? {};
  const out: Record<string, unknown> = {};

  for (const field of fields) {
    const value = answers[field.id];
    const missing =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (missing) {
      if (field.required) {
        throw new BadRequestException(`Campo obrigatório ausente: ${field.label}`);
      }
      continue;
    }

    out[field.id] = coerceByType(field, value);
  }

  return out;
}

function coerceByType(field: RegistrationField, value: unknown): unknown {
  const reject = () =>
    new BadRequestException(`Valor inválido para o campo: ${field.label}`);

  switch (field.type) {
    case 'short_text':
    case 'long_text':
    case 'file': {
      // file guarda a storage key (string opaca).
      if (typeof value !== 'string') throw reject();
      return value;
    }
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (typeof value === 'boolean' || Number.isNaN(n)) throw reject();
      return n;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw reject();
    }
    case 'date': {
      if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) throw reject();
      if (Number.isNaN(new Date(value).getTime())) throw reject();
      return value;
    }
    case 'email': {
      if (typeof value !== 'string' || !EMAIL_RE.test(value)) throw reject();
      return value;
    }
    case 'phone': {
      if (typeof value !== 'string' || !PHONE_RE.test(value)) throw reject();
      return value;
    }
    case 'select': {
      if (typeof value !== 'string' || !(field.options ?? []).includes(value)) {
        throw reject();
      }
      return value;
    }
    case 'multi_select': {
      if (!Array.isArray(value)) throw reject();
      const options = field.options ?? [];
      if (!value.every((v) => typeof v === 'string' && options.includes(v))) {
        throw reject();
      }
      return value;
    }
    default:
      throw reject();
  }
}
