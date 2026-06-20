import { z } from 'zod';
import type { RegistrationField, RegistrationAnswerValue } from '@fonte/types';

/** Base fixa: name/contact obrigatórios, email opcional. */
const baseShape = {
  name: z.string().min(1, 'Informe seu nome'),
  contact: z.string().min(5, 'Informe um telefone/WhatsApp ou e-mail de contato'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
};

const PHONE_RE = /^[+()\d\s.-]{5,}$/;

/** Schema zod de UM campo custom, a partir da definição (story 68). */
function fieldSchema(field: RegistrationField): z.ZodTypeAny {
  const req = field.required;
  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      const s = z.string();
      return req ? s.min(1, 'Campo obrigatório') : s.optional().or(z.literal(''));
    }
    case 'number': {
      const inner = req
        ? z.coerce.number({ invalid_type_error: 'Informe um número' })
        : z.coerce.number({ invalid_type_error: 'Informe um número' }).optional();
      return z.preprocess(
        (v) => (v === '' || v == null ? undefined : v),
        inner,
      );
    }
    case 'boolean':
      return z.boolean().optional().default(false);
    case 'date': {
      const s = z.string();
      return req ? s.min(1, 'Campo obrigatório') : s.optional().or(z.literal(''));
    }
    case 'email': {
      const s = z.string().email('E-mail inválido');
      return req ? s : s.optional().or(z.literal(''));
    }
    case 'phone': {
      const s = z.string().regex(PHONE_RE, 'Telefone inválido');
      return req ? s : s.optional().or(z.literal(''));
    }
    case 'select': {
      const s = z.string();
      return req ? s.min(1, 'Selecione uma opção') : s.optional().or(z.literal(''));
    }
    case 'multi_select': {
      const s = z.array(z.string());
      return req ? s.min(1, 'Selecione ao menos uma opção') : s.optional().default([]);
    }
    case 'file': {
      // Guarda a storage key resolvida pelo upload prévio.
      const s = z.string();
      return req ? s.min(1, 'Anexe um arquivo') : s.optional().or(z.literal(''));
    }
    default:
      return z.any().optional();
  }
}

/**
 * Monta o schema zod completo (base fixa + campos custom) para o form público
 * dinâmico (story 68). As respostas custom ficam aninhadas em `answers`.
 */
export function buildRegistrationSchema(fields: RegistrationField[]) {
  const answersShape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) answersShape[field.id] = fieldSchema(field);
  return z.object({
    ...baseShape,
    answers: z.object(answersShape),
  });
}

/** Valores default do form a partir das definições. */
export function buildDefaultValues(fields: RegistrationField[]) {
  const answers: Record<string, RegistrationAnswerValue> = {};
  for (const field of fields) {
    if (field.type === 'multi_select') answers[field.id] = [];
    else if (field.type === 'boolean') answers[field.id] = false;
    else answers[field.id] = '';
  }
  return { name: '', contact: '', email: '', answers };
}
