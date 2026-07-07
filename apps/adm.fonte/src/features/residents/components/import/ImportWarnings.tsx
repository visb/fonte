import { AlertTriangle, X } from 'lucide-react';
import { IMPORT_WARNINGS_TEXTS } from '../../constants';

export interface ImportWarning {
  key: string;
  message: string;
  /** Rótulo legível do campo; quando presente, exibido como prefixo (campo → mensagem). */
  label?: string;
}

interface ImportWarningsProps {
  warnings: ImportWarning[];
  /** Quando fornecido, cada alerta ganha um botão X para dispensa individual. */
  onDismiss?: (key: string) => void;
}

/**
 * Lista dos alertas de revisão manual produzidos pelo import.
 *
 * - Import individual (`ImportResidentPage`): passado `onDismiss`, exibe o X de
 *   dispensa por alerta.
 * - Import em lote (popover no card / seção no modal, story 107): sem `onDismiss`
 *   e com `label` por alerta, renderiza campo → mensagem para visualização.
 */
export function ImportWarnings({ warnings, onDismiss }: ImportWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-400">
        <AlertTriangle size={14} />
        {IMPORT_WARNINGS_TEXTS.reviewHeader}
      </div>
      <ul className="space-y-1">
        {warnings.map((w) => (
          <li
            key={w.key}
            className="flex items-start gap-2 text-xs text-yellow-700 dark:text-yellow-500"
          >
            <span className="flex-1">
              {w.label && <span className="font-medium">{w.label}: </span>}
              {w.message}
            </span>
            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(w.key)}
                className="shrink-0 text-yellow-600/70 hover:text-yellow-800 dark:hover:text-yellow-300"
                aria-label="Dispensar alerta"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
