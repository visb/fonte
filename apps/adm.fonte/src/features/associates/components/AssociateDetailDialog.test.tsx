import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const state = { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() };
vi.mock('../hooks/useAssociates', () => ({ useAssociateById: () => state }));
vi.mock('./ChargeRow', () => ({ ChargeRow: ({ charge }: { charge: { id: string } }) => <tr><td>charge-{charge.id}</td></tr> }));

import { AssociateDetailDialog } from './AssociateDetailDialog';

function associate(over: Record<string, unknown> = {}) {
  return {
    id: 'a1', name: 'João Associado', createdAt: '2026-01-01', status: 'ACTIVE',
    contributionAmount: 5000, dueDay: 10, charges: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.data = associate();
  state.isLoading = false;
  state.error = null;
});
afterEach(() => cleanup());

describe('AssociateDetailDialog', () => {
  it('loading mostra título fallback de carregamento', () => {
    state.isLoading = true;
    state.data = undefined;
    render(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('Detalhe do associado')).toBeInTheDocument();
  });

  it('erro mostra ErrorState', () => {
    state.data = undefined;
    state.error = new Error('boom');
    render(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao carregar o associado|boom/)).toBeInTheDocument();
  });

  it('mostra dados do associado e empty state de cobranças', () => {
    render(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('João Associado')).toBeInTheDocument();
    expect(screen.getByText('Dia 10')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma cobrança registrada.')).toBeInTheDocument();
  });

  it('lista cobranças quando há histórico', () => {
    state.data = associate({ charges: [{ id: 'c1' }, { id: 'c2' }] });
    render(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('charge-c1')).toBeInTheDocument();
    expect(screen.getByText('charge-c2')).toBeInTheDocument();
  });
});
