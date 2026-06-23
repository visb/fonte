import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

const auth = { role: 'ADMIN', userId: 'u1' };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

const activityState = {
  data: undefined as Activity | undefined,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
};
const updateMutation = { mutate: vi.fn(), reset: vi.fn(), error: null as unknown, isPending: false };
vi.mock('../hooks/useActivities', () => ({
  useActivity: () => activityState,
  useUpdateActivity: () => updateMutation,
  useUploadActivityAttachment: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useDeleteAttachment: () => ({ mutate: vi.fn(), isPending: false }),
}));

const canEdit = { value: true };
vi.mock('../lib/permissions', () => ({ canEditDescription: () => canEdit.value }));

vi.mock('./ActivityComments', () => ({ ActivityComments: () => <div data-testid="comments" /> }));
vi.mock('./HistoryTimeline', () => ({ HistoryTimeline: () => <div data-testid="history" /> }));
vi.mock('./AttachmentList', () => ({ AttachmentList: () => <div data-testid="attachments" /> }));
vi.mock('./ActivityDescriptionView', () => ({
  ActivityDescriptionView: ({ markdown }: { markdown: string }) => <div data-testid="desc-view">{markdown}</div>,
}));
vi.mock('./ActivityDescriptionEditor', () => ({
  ActivityDescriptionEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="desc-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { ActivityDetailsDialog } from './ActivityDetailsDialog';

function activity(over: Partial<Activity> = {}): Activity {
  return {
    id: 'a1', title: 'Limpeza geral', status: ActivityStatus.TODO,
    house: { name: 'Casa Belém' }, responsible: { name: 'João' }, createdBy: { name: 'Maria' },
    createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-02T10:00:00Z',
    description: 'fazer X', attachments: [],
    ...over,
  } as unknown as Activity;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'ADMIN';
  auth.userId = 'u1';
  canEdit.value = true;
  activityState.data = activity();
  activityState.isLoading = false;
  activityState.error = null;
  updateMutation.error = null;
  updateMutation.isPending = false;
});
afterEach(() => cleanup());

describe('ActivityDetailsDialog', () => {
  it('fechado não renderiza o conteúdo', () => {
    render(<ActivityDetailsDialog activityId="a1" open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Limpeza geral')).not.toBeInTheDocument();
  });

  it('loading mostra o estado de carregamento', () => {
    activityState.isLoading = true;
    activityState.data = undefined;
    render(<ActivityDetailsDialog activityId="a1" open onClose={vi.fn()} />);
    expect(screen.getAllByText('Atividade').length).toBeGreaterThan(0);
  });

  it('erro mostra ErrorState', () => {
    activityState.data = undefined;
    activityState.error = new Error('boom');
    render(<ActivityDetailsDialog activityId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao carregar a atividade|boom/)).toBeInTheDocument();
  });

  it('renderiza título, badge de status e infos da atividade', () => {
    render(<ActivityDetailsDialog activityId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('Limpeza geral')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByTestId('comments')).toBeInTheDocument();
  });

  it('atividade sem casa mostra "Geral (sem casa)"', () => {
    activityState.data = activity({ house: null } as Partial<Activity>);
    render(<ActivityDetailsDialog activityId="a1" open onClose={vi.fn()} />);
    expect(screen.getByText('Geral (sem casa)')).toBeInTheDocument();
  });

  it('alternar para a aba Histórico troca o conteúdo', () => {
    render(<ActivityDetailsDialog activityId="a1" open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Histórico' }));
    expect(screen.getByTestId('history')).toBeInTheDocument();
  });

  it('editável: edita descrição e salva muta com a descrição', async () => {
    render(<ActivityDetailsDialog activityId="a1" open onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('desc-editor'), { target: { value: 'nova desc' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar descrição/ }));
    await waitFor(() => expect(updateMutation.mutate).toHaveBeenCalled());
    expect(updateMutation.mutate.mock.calls[0][0].data.description).toBe('nova desc');
  });

  it('não editável mostra descrição read-only', () => {
    canEdit.value = false;
    render(<ActivityDetailsDialog activityId="a1" open onClose={vi.fn()} />);
    expect(screen.getByTestId('desc-view')).toHaveTextContent('fazer X');
    expect(screen.queryByTestId('desc-editor')).not.toBeInTheDocument();
  });

  it('Fechar (footer) dispara onClose', () => {
    const onClose = vi.fn();
    render(<ActivityDetailsDialog activityId="a1" open onClose={onClose} />);
    const fecharButtons = screen.getAllByRole('button', { name: 'Fechar' });
    // botão do footer do form (o último é o de fechar do form, não o X do dialog)
    fireEvent.click(fecharButtons[fecharButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});
