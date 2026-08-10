/**
 * Envio de fluxo de campo pela tela (story 171).
 *
 * Toda mutation de campo é retomável (story 169): sem sinal ela **pausa** e o
 * `onSuccess` só chega quando a fila subir — que pode ser daqui a horas. Tela que
 * espera o `onSuccess` para navegar deixa o operador travado no botão girando, e
 * tela que trata a pausa como erro mostra falha onde não houve nenhuma.
 *
 * Este helper separa os três desfechos:
 *
 * - `onSent`  — o servidor confirmou (só acontece com rede);
 * - `onQueued`— entrou na fila sem sinal: a tela segue em frente **agora**;
 * - `onFailed`— rejeição de verdade, com rede (o motivo vale ser mostrado).
 */
import { useIsOnline } from './network';

interface FieldMutationLike<TInput, TData> {
  mutate: (
    input: TInput,
    options?: { onSuccess?: (data: TData) => void; onError?: (error: unknown) => void },
  ) => void;
}

export interface FieldSubmitHandlers<TData> {
  onSent?: (data: TData) => void;
  onQueued?: () => void;
  onFailed?: (error: unknown) => void;
}

export type FieldSubmit<TInput, TData> = (
  input: TInput,
  handlers?: FieldSubmitHandlers<TData>,
) => void;

/**
 * Decide o desfecho pelo estado da rede **no momento do toque**: depois disso o
 * item é da fila, e o que acontecer com ele aparece na tela de pendências
 * (story 170), não num alerta fora de contexto.
 */
export function useFieldSubmit<TInput, TData>(
  mutation: FieldMutationLike<TInput, TData>,
): FieldSubmit<TInput, TData> {
  const isOnline = useIsOnline();

  return (input, handlers = {}) => {
    const queuedOffline = !isOnline;

    mutation.mutate(input, {
      onSuccess: (data) => {
        if (!queuedOffline) handlers.onSent?.(data);
      },
      onError: (error) => {
        if (!queuedOffline) handlers.onFailed?.(error);
      },
    });

    if (queuedOffline) handlers.onQueued?.();
  };
}
