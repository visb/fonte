import React, { type ReactElement, type ReactNode } from 'react';
import { render, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Helper central de testes do app.fonte (RN / jest-expo).
 *
 * Reutilizável entre features: cria um QueryClient sem retry/cache e um wrapper
 * com QueryClientProvider. O mock do @fonte/api-client (via `@/lib/api`) fica em
 * cada arquivo de teste (jest.mock é hoisted por módulo), mas o boilerplate de
 * render/renderHook com client é centralizado aqui. Espelha o helper da story 81
 * (apps/ops.fonte/lib/test/utils.tsx).
 */

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function createWrapper(client: QueryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

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
