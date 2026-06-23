import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Relative } from '@fonte/api-client';
import { RelativeCard } from './RelativeCard';

function rel(over: Partial<Relative> = {}): Relative {
  return {
    id: 'rel1', name: 'Maria', relationship: 'Mãe', phone: '11999998888',
    isResponsible: false, userId: null,
    ...over,
  } as unknown as Relative;
}

function renderCard(r: Relative = rel()) {
  const fns = { onGenerateAccess: vi.fn(), onResetPassword: vi.fn(), onSetResponsible: vi.fn(), onDelete: vi.fn() };
  render(<RelativeCard relative={r} {...fns} />);
  return fns;
}

afterEach(() => cleanup());

describe('RelativeCard', () => {
  it('mostra nome, parentesco e telefone mascarado; "Sem acesso" sem userId', () => {
    renderCard();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('Mãe')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-8888')).toBeInTheDocument();
    expect(screen.getByText('Sem acesso')).toBeInTheDocument();
  });

  it('responsável mostra badge e desabilita o botão de estrela', () => {
    renderCard(rel({ isResponsible: true }));
    expect(screen.getByText('Responsável')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Responsável pelo acolhido/ })).toBeDisabled();
  });

  it('com userId mostra "App ativo" e botão de resetar senha', () => {
    const { onResetPassword } = renderCard(rel({ userId: 'u1' }));
    expect(screen.getByText('App ativo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resetar senha' }));
    expect(onResetPassword).toHaveBeenCalled();
  });

  it('sem userId, clicar no ícone de chave gera acesso', () => {
    const { onGenerateAccess } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar acesso ao app' }));
    expect(onGenerateAccess).toHaveBeenCalled();
  });

  it('marcar responsável e excluir disparam callbacks', () => {
    const { onSetResponsible, onDelete } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como responsável' }));
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]); // Trash2
    expect(onSetResponsible).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
