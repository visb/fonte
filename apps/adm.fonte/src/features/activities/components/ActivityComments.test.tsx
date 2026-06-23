import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const { addMutate, deleteMutate } = vi.hoisted(() => ({ addMutate: vi.fn(), deleteMutate: vi.fn() }));
let commentsResult: { data: unknown; isLoading: boolean; error: unknown; refetch: () => void } = {
  data: [],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ role: 'ADMIN', userId: 'u1' }) }));
vi.mock('../hooks/useActivities', () => ({
  useActivityComments: () => commentsResult,
  useAddComment: () => ({ mutate: addMutate, isPending: false, error: null }),
  useDeleteComment: () => ({ mutate: deleteMutate, isPending: false }),
  useUploadCommentAttachment: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useDeleteAttachment: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('./AudioRecorder', () => ({ AudioRecorder: () => <div data-testid="audio-recorder" /> }));
vi.mock('./CommentItem', () => ({
  CommentItem: ({ comment }: { comment: { body: string } }) => <div data-testid="comment-item">{comment.body}</div>,
}));

import { ActivityComments } from './ActivityComments';

beforeEach(() => {
  vi.clearAllMocks();
  commentsResult = { data: [], isLoading: false, error: null, refetch: vi.fn() };
});
afterEach(() => cleanup());

describe('ActivityComments', () => {
  it('estado vazio mostra "Nenhum comentário ainda."', () => {
    render(<ActivityComments activityId="act1" />);
    expect(screen.getByText('Nenhum comentário ainda.')).toBeInTheDocument();
  });

  it('lista comentários existentes', () => {
    commentsResult = {
      data: [{ id: 'c1', body: 'Bom trabalho' }, { id: 'c2', body: 'Concluído' }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    render(<ActivityComments activityId="act1" />);
    expect(screen.getAllByTestId('comment-item').length).toBe(2);
    expect(screen.getByText('Bom trabalho')).toBeInTheDocument();
  });

  it('estado de erro mostra mensagem', () => {
    commentsResult = { data: undefined, isLoading: false, error: new Error('x'), refetch: vi.fn() };
    render(<ActivityComments activityId="act1" />);
    expect(screen.getByText(/Erro ao carregar os comentários|x/)).toBeInTheDocument();
  });

  it('submit vazio mostra erro e não muta', async () => {
    render(<ActivityComments activityId="act1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    expect(await screen.findByText('Escreva um comentário.')).toBeInTheDocument();
    expect(addMutate).not.toHaveBeenCalled();
  });

  it('submit válido muta com o corpo do comentário', async () => {
    render(<ActivityComments activityId="act1" />);
    fireEvent.input(screen.getByLabelText('Novo comentário'), { target: { value: 'Ótimo!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    await waitFor(() => expect(addMutate).toHaveBeenCalled());
    expect(addMutate.mock.calls[0][0]).toEqual({ body: 'Ótimo!' });
  });
});
