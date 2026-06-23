import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const relState = { data: [] as unknown[], isLoading: false };
const deleteMutation = { mutate: vi.fn() };
const setResponsibleMutation = { mutate: vi.fn() };
vi.mock('../../hooks/useResidents', () => ({
  useResidentRelatives: () => relState,
  useDeleteRelative: () => deleteMutation,
  useSetResponsibleRelative: () => setResponsibleMutation,
}));
vi.mock('../AddRelativeDialog', () => ({ AddRelativeDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="add-dialog" /> : null) }));
vi.mock('../GenerateRelativeAccessDialog', () => ({ GenerateRelativeAccessDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="gen-dialog" /> : null) }));
vi.mock('../ResetRelativePasswordDialog', () => ({ ResetRelativePasswordDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="reset-dialog" /> : null) }));
vi.mock('../RelativeCard', () => ({ RelativeCard: ({ relative, onDelete, onSetResponsible, onGenerateAccess }: { relative: { id: string; name: string }; onDelete: () => void; onSetResponsible: () => void; onGenerateAccess: () => void }) => (
  <div>
    <span>{relative.name}</span>
    <button onClick={onDelete}>del-{relative.id}</button>
    <button onClick={onSetResponsible}>resp-{relative.id}</button>
    <button onClick={onGenerateAccess}>gen-{relative.id}</button>
  </div>
) }));

import { RelativesTab } from './RelativesTab';

beforeEach(() => {
  vi.clearAllMocks();
  relState.data = [];
  relState.isLoading = false;
});
afterEach(() => cleanup());

describe('RelativesTab', () => {
  it('loading mostra estado de carregamento', () => {
    relState.isLoading = true;
    render(<RelativesTab residentId="r1" />);
    expect(screen.getByText('Carregando familiares...')).toBeInTheDocument();
  });

  it('vazio mostra empty state', () => {
    render(<RelativesTab residentId="r1" />);
    expect(screen.getByText('Nenhum familiar cadastrado.')).toBeInTheDocument();
  });

  it('adicionar familiar abre o diálogo', () => {
    render(<RelativesTab residentId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar familiar/ }));
    expect(screen.getByTestId('add-dialog')).toBeInTheDocument();
  });

  it('lista familiares e marcar responsável muta', () => {
    relState.data = [{ id: 'rel1', name: 'Maria' }];
    render(<RelativesTab residentId="r1" />);
    expect(screen.getByText('Maria')).toBeInTheDocument();
    fireEvent.click(screen.getByText('resp-rel1'));
    expect(setResponsibleMutation.mutate).toHaveBeenCalledWith('rel1');
  });

  it('excluir abre confirmação e confirma a remoção', () => {
    relState.data = [{ id: 'rel1', name: 'Maria' }];
    render(<RelativesTab residentId="r1" />);
    fireEvent.click(screen.getByText('del-rel1'));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(deleteMutation.mutate).toHaveBeenCalledWith('rel1', expect.any(Object));
  });

  it('gerar acesso abre o diálogo', () => {
    relState.data = [{ id: 'rel1', name: 'Maria' }];
    render(<RelativesTab residentId="r1" />);
    fireEvent.click(screen.getByText('gen-rel1'));
    expect(screen.getByTestId('gen-dialog')).toBeInTheDocument();
  });
});
