import { AlertCircle } from 'lucide-react';

interface Props {
  message: string;
  onDismiss: () => void;
}

// Erro de geração de documento (individual ou combinado), dispensável pelo
// operador. Mensagem já normalizada por `getErrorMessage`.
export function GenerateErrorAlert({ message, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs underline underline-offset-2 hover:no-underline"
      >
        Fechar
      </button>
    </div>
  );
}
