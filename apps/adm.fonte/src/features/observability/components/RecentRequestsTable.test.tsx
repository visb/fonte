import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ObservabilityRecentRequest } from '@fonte/api-client';
import { RecentRequestsTable } from './RecentRequestsTable';

function request(
  overrides: Partial<ObservabilityRecentRequest> = {},
): ObservabilityRecentRequest {
  return {
    requestId: 'req-1',
    method: 'GET',
    route: 'GET /api/v1/residents',
    status: 200,
    durationMs: 42.4,
    cpuMs: 8.1,
    dbQueries: 3,
    dbMs: 12,
    heapDeltaKb: 40,
    at: '2026-08-30T12:00:00.000Z',
    ...overrides,
  };
}

describe('RecentRequestsTable', () => {
  it('renderiza uma linha por requisição na ordem recebida', () => {
    render(
      <RecentRequestsTable
        requests={[
          request({ requestId: 'a', route: 'GET /a' }),
          request({ requestId: 'b', route: 'GET /b' }),
        ]}
      />,
    );
    const body = document.querySelector('tbody') as HTMLElement;
    const rows = within(body).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('GET /a');
    expect(rows[1]).toHaveTextContent('GET /b');
  });

  it('formata duração, CPU e queries', () => {
    render(<RecentRequestsTable requests={[request()]} />);
    expect(screen.getByText('42.4 ms')).toBeInTheDocument();
    expect(screen.getByText('8.1 ms')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('destaca status >= 400 e não destaca 2xx', () => {
    render(
      <RecentRequestsTable
        requests={[
          request({ requestId: 'ok', status: 200 }),
          request({ requestId: 'erro', status: 500 }),
        ]}
      />,
    );
    expect(screen.getByText('500').className).toContain('text-destructive');
    expect(screen.getByText('200').className).not.toContain('text-destructive');
  });

  it('renderiza os cabeçalhos esperados', () => {
    render(<RecentRequestsTable requests={[]} />);
    expect(screen.getByRole('columnheader', { name: 'Horário' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Queries' })).toBeInTheDocument();
  });
});
