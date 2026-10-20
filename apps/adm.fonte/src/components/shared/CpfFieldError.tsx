import type { FieldError } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { cpfConflictIdOf } from '@/lib/cpf';

/**
 * Story 219 — erro do campo CPF. No 409 de CPF em uso, mostra o link para o
 * cadastro do filho que já tem o CPF (abre em nova aba: o formulário atual
 * não perde o que foi digitado).
 */
export function CpfFieldError({ error }: { error?: FieldError }) {
  if (!error?.message) return null;
  const conflictId = cpfConflictIdOf(error);
  return (
    <p className="text-xs text-destructive" role="alert">
      {error.message}
      {conflictId && (
        <>
          {' '}
          <Link to={`/residents/${conflictId}`} target="_blank" rel="noreferrer" className="underline font-medium">
            Ver cadastro
          </Link>
        </>
      )}
    </p>
  );
}
