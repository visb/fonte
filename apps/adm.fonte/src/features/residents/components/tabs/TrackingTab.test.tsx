import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

let fuState: { data: unknown; isLoading: boolean; isError: boolean } = {
  data: [],
  isLoading: false,
  isError: false,
};

vi.mock('../../hooks/useResidentFollowUps', () => ({
  useResidentFollowUps: () => fuState,
}));
vi.mock('../AddFollowUpDialog', () => ({
  AddFollowUpDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="add-followup" /> : null),
}));
vi.mock('../TrackingEventItem', () => ({
  TrackingEventItem: ({ followUp }: { followUp: { id: string } }) => (
    <div data-testid="event-item">{followUp.id}</div>
  ),
}));

import { TrackingTab } from './TrackingTab';

beforeEach(() => {
  vi.clearAllMocks();
  fuState = { data: [], isLoading: false, isError: false };
});
afterEach(() => cleanup());

describe('TrackingTab', () => {
  it('loading mostra carregamento', () => {
    fuState = { ...fuState, isLoading: true };
    render(<TrackingTab residentId="r1" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('erro mostra mensagem', () => {
    fuState = { ...fuState, isError: true };
    render(<TrackingTab residentId="r1" />);
    expect(screen.getByText('Erro ao carregar acompanhamento.')).toBeInTheDocument();
  });

  it('vazio mostra mensagem', () => {
    render(<TrackingTab residentId="r1" />);
    expect(screen.getByText('Nenhum evento registrado.')).toBeInTheDocument();
  });

  it('lista eventos e abre o dialog de registrar', () => {
    fuState = { ...fuState, data: [{ id: 'fu1' }, { id: 'fu2' }] };
    render(<TrackingTab residentId="r1" />);
    expect(screen.getAllByTestId('event-item')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Registrar evento/ }));
    expect(screen.getByTestId('add-followup')).toBeInTheDocument();
  });
});
