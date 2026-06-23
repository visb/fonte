import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MessageStatus } from '@fonte/types';
import type { Message } from '@fonte/api-client';

const { approveMutate, rejectMutate } = vi.hoisted(() => ({ approveMutate: vi.fn(), rejectMutate: vi.fn() }));

vi.mock('../hooks/useMessages', () => ({
  useApproveMessage: () => ({ mutate: approveMutate }),
  useRejectMessage: () => ({ mutate: rejectMutate }),
}));

import { ThreadPanel } from './ThreadPanel';

function msg(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    senderName: 'João',
    senderProfileType: 'RELATIVE',
    content: 'Olá filho',
    attachmentType: null,
    status: MessageStatus.PENDING_APPROVAL,
    approvedByName: null,
    createdAt: '2026-06-20T10:30:00.000Z',
    ...overrides,
  } as Message;
}

function renderPanel(props: Partial<Parameters<typeof ThreadPanel>[0]> = {}) {
  render(
    <MemoryRouter>
      <ThreadPanel title="Conversa" messages={[]} isLoading={false} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe('ThreadPanel', () => {
  it('sem título mostra "Selecione uma conversa"', () => {
    renderPanel({ title: null });
    expect(screen.getByText('Selecione uma conversa')).toBeInTheDocument();
  });

  it('loading mostra estado de carregamento', () => {
    renderPanel({ isLoading: true });
    expect(screen.queryByText('Nenhuma mensagem nesta conversa')).not.toBeInTheDocument();
  });

  it('lista vazia mostra "Nenhuma mensagem nesta conversa"', () => {
    renderPanel();
    expect(screen.getByText('Nenhuma mensagem nesta conversa')).toBeInTheDocument();
  });

  it('modo lista renderiza MessageBubble', () => {
    renderPanel({ messages: [msg()] });
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('Olá filho')).toBeInTheDocument();
  });

  it('mostra link do residente no header (aba servos)', () => {
    renderPanel({ residentLinkId: 'r1', residentLinkName: 'Filho A' });
    expect(screen.getByRole('link', { name: /Filho A/ })).toHaveAttribute('href', '/residents/r1');
  });

  it('modo chat com moderação aprova mensagem pendente', () => {
    renderPanel({ chatMode: true, showModerationActions: true, messages: [msg()] });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(approveMutate).toHaveBeenCalledWith('m1', expect.objectContaining({ onSettled: expect.any(Function) }));
  });

  it('modo chat rejeita mensagem pendente', () => {
    renderPanel({ chatMode: true, showModerationActions: true, messages: [msg()] });
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar' }));
    expect(rejectMutate).toHaveBeenCalledWith('m1', expect.objectContaining({ onSettled: expect.any(Function) }));
  });
});
