import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ActivityComment } from '@fonte/api-client';
import { CommentItem } from './CommentItem';

const comment: ActivityComment = {
  id: 'comment-1',
  activityId: 'act-1',
  body: 'Comentário de teste',
  author: { id: 'staff-1', name: 'Maria da Silva', userId: 'user-1' },
  createdByUserId: 'user-1',
  createdAt: '2026-06-19T12:00:00.000Z',
};

describe('CommentItem', () => {
  it('mostra autor e corpo do comentário', () => {
    render(
      <CommentItem comment={comment} canDelete={false} onDelete={vi.fn()} deleting={false} />,
    );
    expect(screen.getByText('Maria da Silva')).toBeInTheDocument();
    expect(screen.getByText('Comentário de teste')).toBeInTheDocument();
  });

  it('mostra "Desconhecido" quando não há autor resolvido', () => {
    render(
      <CommentItem
        comment={{ ...comment, author: null }}
        canDelete={false}
        onDelete={vi.fn()}
        deleting={false}
      />,
    );
    expect(screen.getByText('Desconhecido')).toBeInTheDocument();
  });

  it('não mostra o botão excluir quando não permitido', () => {
    render(
      <CommentItem comment={comment} canDelete={false} onDelete={vi.fn()} deleting={false} />,
    );
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('chama onDelete com o id ao clicar em excluir quando permitido', () => {
    const onDelete = vi.fn();
    render(
      <CommentItem comment={comment} canDelete onDelete={onDelete} deleting={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onDelete).toHaveBeenCalledWith('comment-1');
  });
});
