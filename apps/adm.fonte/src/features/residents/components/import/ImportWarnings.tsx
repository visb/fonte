import { AlertTriangle, X } from 'lucide-react';

export interface ImportWarning {
  key: string;
  message: string;
}

interface ImportWarningsProps {
  warnings: ImportWarning[];
  onDismiss: (key: string) => void;
}

/**
 * Banner with the manual-review alerts produced by the AI import. Rendered at the
 * wizard level so it stays visible across all steps; each alert is dismissed
 * individually via its X button.
 */
export function ImportWarnings({ warnings, onDismiss }: ImportWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-400">
        <AlertTriangle size={14} />
        Atenção — campos que precisam de revisão manual
      </div>
      <ul className="space-y-1">
        {warnings.map((w) => (
          <li
            key={w.key}
            className="flex items-start gap-2 text-xs text-yellow-700 dark:text-yellow-500"
          >
            <span className="flex-1">{w.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(w.key)}
              className="shrink-0 text-yellow-600/70 hover:text-yellow-800 dark:hover:text-yellow-300"
              aria-label="Dispensar alerta"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
