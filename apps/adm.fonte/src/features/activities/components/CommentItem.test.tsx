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

function renderItem(props: Partial<React.ComponentProps<typeof CommentItem>> = {}) {
  return render(
    <CommentItem
      comment={comment}
      canDelete={false}
      onDelete={vi.fn()}
      deleting={false}
      onUploadAttachment={vi.fn()}
      onDeleteAttachment={vi.fn()}
      uploadingAttachment={false}
      deletingAttachment={false}
      {...props}
    />,
  );
}

describe('CommentItem', () => {
  it('mostra autor e corpo do comentário', () => {
    renderItem();
    expect(screen.getByText('Maria da Silva')).toBeInTheDocument();
    expect(screen.getByText('Comentário de teste')).toBeInTheDocument();
  });

  it('mostra "Desconhecido" quando não há autor resolvido', () => {
    renderItem({ comment: { ...comment, author: null } });
    expect(screen.getByText('Desconhecido')).toBeInTheDocument();
  });

  it('não mostra o botão excluir quando não permitido', () => {
    renderItem({ canDelete: false });
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('chama onDelete com o id ao clicar em excluir quando permitido', () => {
    const onDelete = vi.fn();
    renderItem({ canDelete: true, onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onDelete).toHaveBeenCalledWith('comment-1');
  });

  it('lista os anexos do comentário (story 73) com link de download', () => {
    renderItem({
      comment: {
        ...comment,
        attachments: [
          {
            id: 'att-1',
            activityId: 'act-1',
            commentId: 'comment-1',
            fileUrl: 'https://files.example/doc.pdf',
            fileName: 'doc.pdf',
            fileType: 'document',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            createdByUserId: 'user-1',
            createdAt: '2026-06-19T12:01:00.000Z',
            canDelete: false,
          },
        ],
      },
    });
    const link = screen.getByText('doc.pdf').closest('a');
    expect(link).toHaveAttribute('href', 'https://files.example/doc.pdf');
  });

  it('mostra "Anexar ao comentário" para enviar anexo do comentário', () => {
    renderItem();
    expect(
      screen.getByRole('button', { name: 'Anexar ao comentário' }),
    ).toBeInTheDocument();
  });
});
