import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MessageStatus } from '@fonte/types';
import type { Message } from '@fonte/api-client';
import { MessageBubble } from './MessageBubble';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    senderName: 'João',
    content: 'Olá filho',
    attachmentType: null,
    status: MessageStatus.PENDING_APPROVAL,
    approvedByName: null,
    createdAt: '2026-06-20T10:30:00.000Z',
    ...overrides,
  } as Message;
}

afterEach(() => cleanup());

describe('MessageBubble', () => {
  it('mostra remetente, conteúdo e badge pendente', () => {
    render(<MessageBubble message={makeMessage()} />);
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('Olá filho')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('mostra preview de anexo quando não há conteúdo', () => {
    const { rerender } = render(
      <MessageBubble message={makeMessage({ content: '', attachmentType: 'image' })} />,
    );
    expect(screen.getByText('Imagem')).toBeInTheDocument();

    rerender(<MessageBubble message={makeMessage({ content: '', attachmentType: 'audio' })} />);
    expect(screen.getByText('Áudio')).toBeInTheDocument();

    rerender(<MessageBubble message={makeMessage({ content: '', attachmentType: 'document' })} />);
    expect(screen.getByText('Documento')).toBeInTheDocument();
  });

  it('mostra quem moderou em mensagem aprovada', () => {
    render(
      <MessageBubble
        message={makeMessage({ status: MessageStatus.APPROVED, approvedByName: 'Ana' })}
      />,
    );
    expect(screen.getByText('Aprovado')).toBeInTheDocument();
    expect(screen.getByText('por Ana')).toBeInTheDocument();
  });

  it('badge de rejeição', () => {
    render(<MessageBubble message={makeMessage({ status: MessageStatus.REJECTED })} />);
    expect(screen.getByText('Rejeitado')).toBeInTheDocument();
  });

  it('botões aprovar/rejeitar só aparecem em pendente com callbacks e disparam', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <MessageBubble message={makeMessage()} onApprove={onApprove} onReject={onReject} />,
    );
    fireEvent.click(screen.getByText('Aprovar'));
    fireEvent.click(screen.getByText('Rejeitar'));
    expect(onApprove).toHaveBeenCalledWith('m1');
    expect(onReject).toHaveBeenCalledWith('m1');
  });

  it('desabilita botões e mostra "..." enquanto processa', () => {
    render(
      <MessageBubble
        message={makeMessage()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        approvingId="m1"
      />,
    );
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '...' })).toBeDisabled();
  });

  it('não mostra botões quando não pendente', () => {
    render(
      <MessageBubble
        message={makeMessage({ status: MessageStatus.APPROVED })}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText('Aprovar')).not.toBeInTheDocument();
  });
});
