import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/api', () => ({
  api: { observability: { stats: vi.fn(), reset: vi.fn(), health: vi.fn() } },
}));

import { api } from '@/lib/api';
import { renderWithClient } from '@/test/utils';
import { VOLATILE_DATA_NOTICE } from '../constants';
import { ObservabilityPage } from './ObservabilityPage';

const stats = (overrides: Record<string, unknown> = {}) => ({
  startedAt: '2026-08-30T12:00:00.000Z',
  runtime: {
    uptimeSec: 120,
    eventLoopLagMs: { p50: 1, p99: 5, max: 9 },
    memory: { rssMb: 100, heapUsedMb: 50, heapTotalMb: 80, externalMb: 2 },
    cpuPercent: 10,
    nodeVersion: 'v22.14.0',
  },
  routes: [],
  recent: [],
  ...overrides,
});

const routeSample = {
  route: 'GET /api/v1/residents',
  count: 4,
  errors: 0,
  avgDurationMs: 50,
  maxDurationMs: 90,
  p50DurationMs: 40,
  p95DurationMs: 85,
  avgCpuMs: 6,
  avgDbQueries: 3,
  avgDbMs: 10,
  avgHeapDeltaKb: 20,
  lastAt: '2026-08-30T12:01:00.000Z',
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('ObservabilityPage', () => {
  it('mostra LoadingState enquanto carrega', () => {
    vi.mocked(api.observability.stats).mockReturnValue(new Promise(() => {}) as never);
    renderWithClient(<ObservabilityPage />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('mostra ErrorState com retry quando a busca falha', async () => {
    vi.mocked(api.observability.stats).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderWithClient(<ObservabilityPage />);

    await screen.findByRole('button', { name: 'Tentar novamente' });
    expect(api.observability.stats).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(api.observability.stats).toHaveBeenCalledTimes(2));
  });

  it('mostra EmptyState quando nenhuma rota foi registrada', async () => {
    vi.mocked(api.observability.stats).mockResolvedValue(stats() as never);
    renderWithClient(<ObservabilityPage />);

    expect(await screen.findByText('Nenhuma rota registrada ainda.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma requisição registrada ainda.')).toBeInTheDocument();
  });

  it('renderiza runtime, custo por rota e últimas requisições', async () => {
    vi.mocked(api.observability.stats).mockResolvedValue(
      stats({
        routes: [routeSample],
        recent: [
          {
            requestId: 'r1',
            method: 'GET',
            route: 'GET /api/v1/residents',
            status: 200,
            durationMs: 30,
            cpuMs: 4,
            dbQueries: 2,
            dbMs: 6,
            heapDeltaKb: 10,
            at: '2026-08-30T12:01:00.000Z',
          },
        ],
      }) as never,
    );
    renderWithClient(<ObservabilityPage />);

    expect(await screen.findByText('Custo por rota')).toBeInTheDocument();
    expect(screen.getByText('Últimas requisições')).toBeInTheDocument();
    expect(screen.getAllByText('GET /api/v1/residents').length).toBeGreaterThan(0);
    expect(screen.getByTestId('runtime-value-CPU')).toHaveTextContent('10.0%');
  });

  // O aviso de volatilidade é permanente: sem ele a primeira pergunta vira
  // "cadê o histórico dos últimos 30 dias" (que é o Sentry, não esta tela).
  it('mantém o aviso de "desde o último restart" em qualquer estado', async () => {
    vi.mocked(api.observability.stats).mockRejectedValue(new Error('boom'));
    const { unmount } = renderWithClient(<ObservabilityPage />);
    expect(screen.getByText(new RegExp(VOLATILE_DATA_NOTICE.slice(0, 40)))).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Tentar novamente' });
    unmount();

    vi.mocked(api.observability.stats).mockResolvedValue(stats() as never);
    renderWithClient(<ObservabilityPage />);
    expect(await screen.findByText(/Agregado desde/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(VOLATILE_DATA_NOTICE.slice(0, 40)))).toBeInTheDocument();
  });

  it('dispara a mutation ao clicar em Zerar contadores', async () => {
    vi.mocked(api.observability.stats).mockResolvedValue(stats() as never);
    vi.mocked(api.observability.reset).mockResolvedValue({
      startedAt: '2026-08-30T12:30:00.000Z',
    } as never);
    const user = userEvent.setup();
    renderWithClient(<ObservabilityPage />);

    await user.click(screen.getByRole('button', { name: /Zerar contadores/ }));
    await waitFor(() => expect(api.observability.reset).toHaveBeenCalledTimes(1));
  });

  it('mostra o erro do reset com getErrorMessage', async () => {
    vi.mocked(api.observability.stats).mockResolvedValue(stats() as never);
    vi.mocked(api.observability.reset).mockRejectedValue({
      response: { data: { message: 'Sem permissão' } },
    });
    const user = userEvent.setup();
    renderWithClient(<ObservabilityPage />);

    await user.click(screen.getByRole('button', { name: /Zerar contadores/ }));
    expect(await screen.findByText('Sem permissão')).toBeInTheDocument();
  });
});
