import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';

/**
 * Feedback de ação do app (story 126).
 *
 * FRONTEIRA (decisão travada): **mutation → toast; campo → inline.**
 * - Resultado de ação (mutation: salvar, excluir, matricular) vira toast, e o
 *   toast é disparado no hook da mutation (`onSuccess`/`onError`) — não na page
 *   nem no componente, para todo consumidor ganhar o mesmo feedback.
 * - Erro de validação de campo (`errors.<campo>.message` do react-hook-form/zod)
 *   e validação local de input (ex.: tipo de arquivo) continuam **inline**, ao
 *   lado do campo. Validação pertence ao campo, não ao toast.
 *
 * Importar sempre deste módulo — nunca `sonner` direto — para o padrão não
 * derivar e o erro passar sempre por `getErrorMessage` (regra do CLAUDE.md).
 */

/** Sucesso de uma ação. Ex.: `toastSuccess('Turma criada.')`. */
export function toastSuccess(message: string): void {
  toast.success(message);
}

/** Falha de uma ação. A mensagem sai de `getErrorMessage(error, fallback)`. */
export function toastError(error: unknown, fallback: string): void {
  toast.error(getErrorMessage(error, fallback));
}

/**
 * Toast com ação — ex.: "Desfazer" logo após uma ação permanente (story 127).
 */
export function toastAction(
  message: string,
  action: { label: string; onClick: () => void },
): void {
  toast(message, { action });
}
