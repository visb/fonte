import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObservabilityRouteStats } from '@fonte/api-client';
import { OTHER_ROUTE, OTHER_ROUTE_LABEL } from '../constants';
import { RouteCostTable } from './RouteCostTable';

function route(overrides: Partial<ObservabilityRouteStats> = {}): ObservabilityRouteStats {
  return {
    route: 'GET /api/v1/residents',
    count: 10,
    errors: 0,
    avgDurationMs: 100,
    maxDurationMs: 300,
    p50DurationMs: 80,
    p95DurationMs: 250,
    avgCpuMs: 12,
    avgDbQueries: 5,
    avgDbMs: 30,
    avgHeapDeltaKb: 100,
    lastAt: '2026-08-30T12:00:00.000Z',
    ...overrides,
  };
}

/** Nomes das rotas na ordem em que estão renderizadas no corpo da tabela. */
function renderedRoutes(): string[] {
  const body = document.querySelector('tbody') as HTMLElement;
  return within(body)
    .getAllByRole('row')
    .map((row) => row.querySelectorAll('td')[0].textContent?.split(' Demais')[0] ?? '');
}

const slow = route({ route: 'GET /slow', p95DurationMs: 1500, avgCpuMs: 5, avgDbQueries: 3 });
const cpu = route({ route: 'GET /cpu', p95DurationMs: 200, avgCpuMs: 90, avgDbQueries: 1 });
const db = route({ route: 'GET /db', p95DurationMs: 400, avgCpuMs: 20, avgDbQueries: 45 });

describe('RouteCostTable', () => {
  it('ordena por p95 desc por padrão', () => {
    render(<RouteCostTable routes={[cpu, db, slow]} />);
    expect(renderedRoutes()).toEqual(['GET /slow', 'GET /db', 'GET /cpu']);
  });

  it('reordena por CPU médio ao clicar no cabeçalho e inverte no segundo clique', async () => {
    const user = userEvent.setup();
    render(<RouteCostTable routes={[cpu, db, slow]} />);

    await user.click(screen.getByRole('button', { name: 'Ordenar por CPU médio' }));
    expect(renderedRoutes()).toEqual(['GET /cpu', 'GET /db', 'GET /slow']);

    await user.click(screen.getByRole('button', { name: 'Ordenar por CPU médio' }));
    expect(renderedRoutes()).toEqual(['GET /slow', 'GET /db', 'GET /cpu']);
  });

  it('reordena por queries médias', async () => {
    const user = userEvent.setup();
    render(<RouteCostTable routes={[cpu, db, slow]} />);

    await user.click(screen.getByRole('button', { name: 'Ordenar por Queries médias' }));
    expect(renderedRoutes()).toEqual(['GET /db', 'GET /slow', 'GET /cpu']);
  });

  it('marca N+1 só na rota acima do threshold de queries', () => {
    render(<RouteCostTable routes={[db, cpu]} />);
    const rows = screen.getAllByRole('row');
    const dbRow = rows.find((r) => r.textContent?.includes('GET /db')) as HTMLElement;
    const cpuRow = rows.find((r) => r.textContent?.includes('GET /cpu')) as HTMLElement;

    expect(within(dbRow).getByText('N+1?')).toBeInTheDocument();
    expect(within(cpuRow).queryByText('N+1?')).not.toBeInTheDocument();
  });

  it('marca lentidão na rota com p95 acima de 1000ms', () => {
    render(<RouteCostTable routes={[slow, cpu]} />);
    const rows = screen.getAllByRole('row');
    const slowRow = rows.find((r) => r.textContent?.includes('GET /slow')) as HTMLElement;
    const cpuRow = rows.find((r) => r.textContent?.includes('GET /cpu')) as HTMLElement;

    expect(within(slowRow).getByText('lento')).toBeInTheDocument();
    expect(within(cpuRow).queryByText('lento')).not.toBeInTheDocument();
  });

  it('destaca a coluna de erros quando há erro', () => {
    render(<RouteCostTable routes={[route({ route: 'GET /erro', errors: 3 })]} />);
    const cells = screen.getAllByRole('cell');
    const errorCell = cells[2];
    expect(errorCell).toHaveTextContent('3');
    expect(errorCell.className).toContain('text-destructive');
  });

  it('renderiza a linha OTHER com o label explicativo', () => {
    render(<RouteCostTable routes={[route({ route: OTHER_ROUTE })]} />);
    expect(screen.getByText(OTHER_ROUTE)).toBeInTheDocument();
    expect(screen.getByText(OTHER_ROUTE_LABEL)).toBeInTheDocument();
  });

  it('não quebra com rota sem amostra de DB (não vira NaN)', () => {
    render(
      <RouteCostTable
        routes={[route({ route: 'GET /sem-db', avgDbMs: undefined as unknown as number })]}
      />,
    );
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('renderiza uma linha por rota', () => {
    render(<RouteCostTable routes={[cpu, db, slow]} />);
    expect(renderedRoutes()).toHaveLength(3);
  });
});
