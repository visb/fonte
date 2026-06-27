import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let reqState: { data: unknown[]; isLoading: boolean; error: unknown; refetch: () => void } = {
  data: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('../../hooks/useHouses', () => ({
  useCapacityRequestHistory: () => reqState,
}));
vi.mock('./CapacityRequestRow', () => ({
  CapacityRequestRow: ({ request }: { request: { id: string } }) => (
    <div data-testid="cap-row">{request.id}</div>
  ),
}));

import { CapacityRequestsTab } from './CapacityRequestsTab';

beforeEach(() => {
  vi.clearAllMocks();
  reqState = { data: [], isLoading: false, error: null, refetch: vi.fn() };
});
afterEach(() => cleanup());

describe('CapacityRequestsTab', () => {
  it('loading mostra carregamento', () => {
    reqState = { ...reqState, isLoading: true };
    render(<CapacityRequestsTab houseId="h1" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('erro mostra mensagem de erro', () => {
    reqState = { ...reqState, error: new Error('boom') };
    render(<CapacityRequestsTab houseId="h1" />);
    expect(screen.getByText('Erro ao carregar pedidos.')).toBeInTheDocument();
  });

  it('vazio mostra mensagem', () => {
    render(<CapacityRequestsTab houseId="h1" />);
    expect(screen.getByText('Nenhum pedido de alteração de leitos.')).toBeInTheDocument();
  });

  it('lista pedidos via CapacityRequestRow', () => {
    reqState = { ...reqState, data: [{ id: 'q1' }, { id: 'q2' }] };
    render(<CapacityRequestsTab houseId="h1" />);
    expect(screen.getAllByTestId('cap-row')).toHaveLength(2);
  });
});
