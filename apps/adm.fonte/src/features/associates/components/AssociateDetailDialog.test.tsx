import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const state = { data: undefined as unknown, isLoading: false, error: null as unknown, refetch: vi.fn() };
vi.mock('../hooks/useAssociates', () => ({ useAssociateById: () => state }));
vi.mock('./ChargeRow', () => ({
  ChargeRow: ({ charge, onDownloadReceipt }: { charge: { id: string }; onDownloadReceipt?: (id: string) => void }) => (
    <tr>
      <td>
        <button type="button" onClick={() => onDownloadReceipt?.(charge.id)}>charge-{charge.id}</button>
      </td>
    </tr>
  ),
}));

// Story 178 — o download do recibo é do hook; aqui só a fiação e o erro na tela.
const receiptState = {
  downloadingId: null as string | null,
  error: null as string | null,
  dismissError: vi.fn(),
  download: vi.fn(),
};
vi.mock('../hooks/useChargeReceipt', () => ({ useChargeReceipt: () => receiptState }));

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
  receiptState.downloadingId = null;
  receiptState.error = null;
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
    expect(screen.getByText('Recibo')).toBeInTheDocument();
  });

  // ─── Recibo (story 178) ─────────────────────────────────────────────────────

  it('liga o botão de recibo da linha ao download do hook', () => {
    state.data = associate({ charges: [{ id: 'c1' }] });
    render(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'charge-c1' }));
    expect(receiptState.download).toHaveBeenCalledWith('c1');
  });

  it('erro do recibo aparece na tela com a mensagem do backend', () => {
    state.data = associate({ charges: [{ id: 'c1' }] });
    receiptState.error = 'Nenhum template de recibo cadastrado. Cadastre em Configurações → Templates.';
    render(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText(/Cadastre em Configurações → Templates\./)).toBeInTheDocument();
  });
});
