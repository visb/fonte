import { AlertTriangle } from 'lucide-react';
import type { ImportConflict } from '@fonte/api-client';
import { existingConflictMessage, sessionConflictMessage } from '../../constants';

interface ImportConflictAlertProps {
  conflicts: ImportConflict[];
  sessionConflictName?: string | null;
}

/**
 * Alerta inline de conflito de importação — usado no card e no topo do modal.
 * Lista os filhos já cadastrados que batem por nome/CPF (story 103) e, se
 * houver, o filho já aprovado nesta sessão. Renderiza `null` quando não há
 * conflito, para o chamador só liberar a aprovação nesse caso.
 */
export function ImportConflictAlert({ conflicts, sessionConflictName }: ImportConflictAlertProps) {
  const hasExisting = conflicts.length > 0;
  if (!hasExisting && !sessionConflictName) return null;

  return (
    <div
      role="alert"
      className="space-y-1 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {hasExisting && (
        <p className="flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{existingConflictMessage(conflicts.map((c) => c.name))}</span>
        </p>
      )}
      {sessionConflictName && (
        <p className="flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{sessionConflictMessage(sessionConflictName)}</span>
        </p>
      )}
    </div>
  );
}
