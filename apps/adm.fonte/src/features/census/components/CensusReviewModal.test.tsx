import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

let pendingState: { data: { id: string; name: string }[]; isLoading: boolean; error: unknown } = {
  data: [],
  isLoading: false,
  error: null,
};
const approveAsync = vi.fn();
const rejectAsync = vi.fn();
let approveState = { isPending: false };
let rejectState = { isPending: false };

vi.mock('../hooks/useCensus', () => ({
  useCensusPending: () => pendingState,
  useApproveAllCensus: () => ({ mutateAsync: approveAsync, ...approveState }),
  useRejectCensusResident: () => ({ mutateAsync: rejectAsync, ...rejectState }),
}));
vi.mock('./CensusReviewRow', () => ({
  CensusReviewRow: ({ resident, onReject, disabled }: { resident: { id: string; name: string }; onReject: (id: string) => void; disabled: boolean }) => (
    <button disabled={disabled} onClick={() => onReject(resident.id)}>
      reject-{resident.name}
    </button>
  ),
}));

import { CensusReviewModal } from './CensusReviewModal';

beforeEach(() => {
  vi.clearAllMocks();
  pendingState = { data: [{ id: 'r1', name: 'Ana' }, { id: 'r2', name: 'Bruno' }], isLoading: false, error: null };
  approveState = { isPending: false };
  rejectState = { isPending: false };
  approveAsync.mockResolvedValue(undefined);
  rejectAsync.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe('CensusReviewModal', () => {
  it('mostra título com nome da casa e a lista de pendentes', () => {
    render(<CensusReviewModal houseId="h1" houseName="Casa Um" open onClose={vi.fn()} />);
    expect(screen.getByText('Revisar contagem — Casa Um')).toBeInTheDocument();
    expect(screen.getByText('reject-Ana')).toBeInTheDocument();
    expect(screen.getByText('reject-Bruno')).toBeInTheDocument();
  });

  it('aprovar todos chama mutateAsync', async () => {
    render(<CensusReviewModal houseId="h1" open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Aprovar todos/ }));
    await waitFor(() => expect(approveAsync).toHaveBeenCalled());
  });

  it('erro ao aprovar é exibido', async () => {
    approveAsync.mockRejectedValue(new Error('boom'));
    render(<CensusReviewModal houseId="h1" open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Aprovar todos/ }));
    // getErrorMessage devolve o fallback p/ Error sem `.response.data.message`.
    await waitFor(() => expect(screen.getByText('Erro ao aprovar.')).toBeInTheDocument());
  });

  it('rejeitar um filho chama mutateAsync com id', async () => {
    render(<CensusReviewModal houseId="h1" open onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('reject-Ana'));
    await waitFor(() => expect(rejectAsync).toHaveBeenCalledWith('r1'));
  });

  it('loading, erro e vazio', () => {
    pendingState = { data: [], isLoading: true, error: null };
    const { rerender } = render(<CensusReviewModal houseId="h1" open onClose={vi.fn()} />);
    expect(screen.queryByText('reject-Ana')).not.toBeInTheDocument();
    pendingState = { data: [], isLoading: false, error: new Error('x') };
    rerender(<CensusReviewModal houseId="h1" open onClose={vi.fn()} />);
    pendingState = { data: [], isLoading: false, error: null };
    rerender(<CensusReviewModal houseId="h1" open onClose={vi.fn()} />);
    expect(screen.getByText('Nenhum filho pendente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aprovar todos/ })).toBeDisabled();
  });

  it('fechar dispara onClose', () => {
    const onClose = vi.fn();
    render(<CensusReviewModal houseId="h1" open onClose={onClose} />);
    // dois botões "Fechar": o X do DialogContent (sr-only) e o do footer.
    const fechar = screen.getAllByRole('button', { name: 'Fechar' });
    fireEvent.click(fechar[fechar.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});
