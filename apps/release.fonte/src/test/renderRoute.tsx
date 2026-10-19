import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, ROUTER_FUTURE } from '@/AppRoutes';
import type { Release } from '@/lib/releases';

export function renderRoute(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    version: '1.0.0',
    date: '2026-10-19',
    summary: 'Resumo da versão.',
    apk: true,
    breaking: false,
    body: '## Ops (celular)\n\n- Novidade no ops.',
    ...overrides,
  };
}

/** Resposta de fetch mínima para o fetchLatestApk. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}
