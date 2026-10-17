import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ReceiptType } from '@fonte/types';

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
  missingTemplateType: null as ReceiptType | null,
  dismissError: vi.fn(),
  download: vi.fn(),
};
vi.mock('../hooks/useChargeReceipt', () => ({ useChargeReceipt: () => receiptState }));

import { AssociateDetailDialog } from './AssociateDetailDialog';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

/** Story 212 — o atalho "Cadastrar template" navega: precisa de router. */
function renderDialog(ui: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/associates']}>
      <Routes>
        <Route path="*" element={<>{ui}<LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  receiptState.missingTemplateType = null;
});
afterEach(() => cleanup());

describe('AssociateDetailDialog', () => {
  it('loading mostra título fallback de carregamento', () => {
    state.isLoading = true;
    state.data = undefined;
    renderDialog(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('Detalhe do associado')).toBeInTheDocument();
  });

  it('erro mostra ErrorState', () => {
    state.data = undefined;
    state.error = new Error('boom');
    renderDialog(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao carregar o associado|boom/)).toBeInTheDocument();
  });

  it('mostra dados do associado e empty state de cobranças', () => {
    renderDialog(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('João Associado')).toBeInTheDocument();
    expect(screen.getByText('Dia 10')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma cobrança registrada.')).toBeInTheDocument();
  });

  it('lista cobranças quando há histórico', () => {
    state.data = associate({ charges: [{ id: 'c1' }, { id: 'c2' }] });
    renderDialog(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('charge-c1')).toBeInTheDocument();
    expect(screen.getByText('charge-c2')).toBeInTheDocument();
    expect(screen.getByText('Recibo')).toBeInTheDocument();
  });

  // ─── Recibo (story 178) ─────────────────────────────────────────────────────

  it('liga o botão de recibo da linha ao download do hook', () => {
    state.data = associate({ charges: [{ id: 'c1' }] });
    renderDialog(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'charge-c1' }));
    expect(receiptState.download).toHaveBeenCalledWith('c1');
  });

  it('erro do recibo aparece na tela com a mensagem do backend', () => {
    state.data = associate({ charges: [{ id: 'c1' }] });
    receiptState.error = 'Nenhum template de recibo cadastrado. Cadastre em Configurações → Templates.';
    renderDialog(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText(/Cadastre em Configurações → Templates\./)).toBeInTheDocument();
    // Sem o code do backend, não há atalho.
    expect(screen.queryByRole('button', { name: 'Cadastrar template' })).not.toBeInTheDocument();
  });

  // Story 212, decisão 4.
  it('template ausente ganha "Cadastrar template" com o tipo do associado', () => {
    state.data = associate({ charges: [{ id: 'c1' }] });
    receiptState.error = 'Nenhum template de recibo cadastrado. Cadastre em Configurações → Templates.';
    receiptState.missingTemplateType = ReceiptType.ASSOCIATE_CONTRIBUTION;
    renderDialog(<AssociateDetailDialog associateId="a1" open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar template' }));
    expect(screen.getByTestId('location').textContent).toBe(
      '/settings/templates?newReceipt=ASSOCIATE_CONTRIBUTION',
    );
  });
});
