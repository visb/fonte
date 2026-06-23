import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Conversation, DirectConversation } from '@fonte/api-client';
import { ConversationRow } from './ConversationRow';
import { DirectConversationRow } from './DirectConversationRow';

afterEach(() => cleanup());

function conv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    residentName: 'Filho A',
    relativeName: 'Mãe B',
    lastMessage: 'oi',
    pendingCount: 0,
    ...overrides,
  } as Conversation;
}

describe('ConversationRow', () => {
  it('mostra nomes e última mensagem', () => {
    render(<ConversationRow conversation={conv()} isSelected={false} onClick={vi.fn()} />);
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText('Mãe B')).toBeInTheDocument();
    expect(screen.getByText('oi')).toBeInTheDocument();
  });

  it('mostra badge de pendentes quando > 0', () => {
    render(<ConversationRow conversation={conv({ pendingCount: 3 })} isSelected onClick={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('oculta badge e última mensagem quando vazios', () => {
    render(
      <ConversationRow
        conversation={conv({ pendingCount: 0, lastMessage: null as unknown as string })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.queryByText('oi')).not.toBeInTheDocument();
  });

  it('dispara onClick', () => {
    const onClick = vi.fn();
    render(<ConversationRow conversation={conv()} isSelected={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});

function direct(overrides: Partial<DirectConversation> = {}): DirectConversation {
  return {
    staffName: 'Servo C',
    relativeName: 'Pai D',
    residentName: 'Filho E',
    lastMessage: 'tudo bem?',
    ...overrides,
  } as DirectConversation;
}

describe('DirectConversationRow', () => {
  it('mostra staff, relative, filho e última mensagem', () => {
    render(<DirectConversationRow conversation={direct()} isSelected onClick={vi.fn()} />);
    expect(screen.getByText('Servo C')).toBeInTheDocument();
    expect(screen.getByText('Pai D')).toBeInTheDocument();
    expect(screen.getByText('Filho: Filho E')).toBeInTheDocument();
    expect(screen.getByText('tudo bem?')).toBeInTheDocument();
  });

  it('oculta filho e mensagem quando ausentes', () => {
    render(
      <DirectConversationRow
        conversation={direct({ residentName: null as unknown as string, lastMessage: null as unknown as string })}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Filho:/)).not.toBeInTheDocument();
  });

  it('dispara onClick', () => {
    const onClick = vi.fn();
    render(<DirectConversationRow conversation={direct()} isSelected={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
