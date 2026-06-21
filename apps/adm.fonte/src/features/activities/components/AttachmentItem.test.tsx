import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ActivityAttachment } from '@fonte/api-client';
import { AttachmentItem } from './AttachmentItem';

function attachment(overrides: Partial<ActivityAttachment> = {}): ActivityAttachment {
  return {
    id: 'att-1',
    activityId: 'act-1',
    commentId: null,
    fileUrl: 'https://files.example/plano.pdf',
    fileName: 'plano.pdf',
    fileType: 'document',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    createdByUserId: 'user-1',
    createdAt: '2026-06-19T12:00:00.000Z',
    canDelete: false,
    ...overrides,
  };
}

describe('AttachmentItem', () => {
  it('mostra o nome e um link de download para a fileUrl', () => {
    render(
      <AttachmentItem attachment={attachment()} onDelete={vi.fn()} deleting={false} />,
    );
    const link = screen.getByText('plano.pdf').closest('a');
    expect(link).toHaveAttribute('href', 'https://files.example/plano.pdf');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('não mostra o botão excluir quando canDelete=false', () => {
    render(
      <AttachmentItem
        attachment={attachment({ canDelete: false })}
        onDelete={vi.fn()}
        deleting={false}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('mostra o botão excluir e chama onDelete com o id quando canDelete=true', () => {
    const onDelete = vi.fn();
    render(
      <AttachmentItem
        attachment={attachment({ canDelete: true })}
        onDelete={onDelete}
        deleting={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Excluir anexo/i }));
    expect(onDelete).toHaveBeenCalledWith('att-1');
  });

  it('renderiza o player de áudio (story 74) quando fileType=audio, sem link de download', () => {
    render(
      <AttachmentItem
        attachment={attachment({
          fileType: 'audio',
          mimeType: 'audio/webm',
          fileName: 'gravacao.webm',
          fileUrl: 'https://files.example/gravacao.webm',
          durationSeconds: 42,
        })}
        onDelete={vi.fn()}
        deleting={false}
      />,
    );
    // controle de play do player presente
    expect(
      screen.getByRole('button', { name: /Reproduzir áudio/i }),
    ).toBeInTheDocument();
    // não há link de download para áudio (o player substitui)
    expect(screen.queryByText('gravacao.webm')?.closest('a')).toBeNull();
  });
});
