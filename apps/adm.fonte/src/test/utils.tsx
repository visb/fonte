import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';

/**
 * Helper de teste central reutilizável entre features (story 80).
 *
 * Fornece uma factory de `QueryClient` + provider para testar hooks de
 * react-query (`useQuery`/`useMutation`) e componentes que dependem do cache,
 * sem repetir o boilerplate em cada arquivo de teste.
 *
 * O mock do `@fonte/api-client` (via `@/lib/api`) continua sendo declarado por
 * arquivo com `vi.mock('@/lib/api', ...)` porque o `vi.mock` é hoisted por
 * módulo — ver `createApiMock` abaixo para a forma reutilizável do shape.
 */

/** Cria um QueryClient isolado com retry desligado (testes determinísticos). */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Wrapper de provider para `renderHook`/`render`. */
export function createWrapper(client?: QueryClient) {
  const queryClient = client ?? createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

/** `renderHook` já embrulhado no QueryClientProvider; devolve o client p/ asserts. */
export function renderHookWithClient<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: { client?: QueryClient; initialProps?: TProps },
) {
  const { queryClient, wrapper } = createWrapper(options?.client);
  const result = renderHook(hook, { wrapper, initialProps: options?.initialProps });
  return { ...result, queryClient };
}

/** `render` de componente já embrulhado no QueryClientProvider. */
export function renderWithClient(ui: ReactElement, client?: QueryClient) {
  const { queryClient, wrapper } = createWrapper(client);
  return { ...render(ui, { wrapper }), queryClient };
}
