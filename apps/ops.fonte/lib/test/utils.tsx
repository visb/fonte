import React, { type ReactElement, type ReactNode } from 'react';
import { render, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerMutationDefaults } from '@/lib/offline/mutationDefaults';

/**
 * Helper central de testes do ops.fonte (RN / jest-expo).
 *
 * Reutilizável entre features: cria um QueryClient sem retry/cache e um wrapper
 * com QueryClientProvider. O mock do @fonte/api-client (via `@/lib/api`) fica em
 * cada arquivo de teste (jest.mock é hoisted por módulo), mas o boilerplate de
 * render/renderHook com client é centralizado aqui.
 */

export function createTestQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  // As mutations de campo têm `mutationFn` em `setMutationDefaults` (story 169):
  // sem registrar, todo hook de escrita quebraria com "No mutationFn found".
  // `retry: false` porque aqui a política real (repetir rede para sempre)
  // deixaria o teste girando.
  registerMutationDefaults(client, { retry: false });
  return client;
}

export function createWrapper(client: QueryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/**
 * Terceiro argumento das escritas de campo: `RequestOptions` com a chave de
 * idempotência gerada pela outbox (story 169 sobre o contrato da 172). Toda
 * asserção de payload dessas mutations passa a esperar isto.
 */
export const expectIdempotencyKey = expect.objectContaining({
  idempotencyKey: expect.any(String),
});

/** Renderiza uma árvore RN com QueryClientProvider. */
export function renderWithClient(
  ui: ReactElement,
  client: QueryClient = createTestQueryClient(),
) {
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

/** renderHook com QueryClientProvider. */
export function renderHookWithClient<TResult, TProps>(
  hook: (props: TProps) => TResult,
  client: QueryClient = createTestQueryClient(),
) {
  return renderHook(hook, { wrapper: createWrapper(client) });
}
