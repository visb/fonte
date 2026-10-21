import { useCallback, useState } from 'react';
import type { Activity } from '@fonte/api-client';

/**
 * Modo do modal de responsável (story 220):
 * - `approve`: aprovar a solicitação já escolhendo o responsável (REQUESTED → TODO);
 * - `change`: atribuir/trocar o responsável sem mudar a situação.
 */
export type ResponsibleModalMode = 'approve' | 'change';

export interface ResponsibleModalTarget {
  activity: Activity;
  mode: ResponsibleModalMode;
}

/**
 * Estado do modal de responsável, num lugar só (a page), em vez de um modal por
 * card. Não é campo de formulário: é qual atividade está com o seletor aberto.
 */
export function useResponsibleModal() {
  const [target, setTarget] = useState<ResponsibleModalTarget | null>(null);

  const open = useCallback(
    (activity: Activity, mode: ResponsibleModalMode) => setTarget({ activity, mode }),
    [],
  );
  const close = useCallback(() => setTarget(null), []);

  return { target, open, close };
}
