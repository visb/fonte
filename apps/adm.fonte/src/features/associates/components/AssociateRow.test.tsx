import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AssociateStatus } from '@fonte/types';
import type { AssociateListItem } from '@fonte/api-client';
import { AssociateRow } from './AssociateRow';

function assoc(over: Partial<AssociateListItem> = {}): AssociateListItem {
  return {
    id: 'a1', name: 'João', whatsapp: '+5511999998888', email: 'j@x.com',
    contributionAmount: 5000, dueDay: 10, status: AssociateStatus.ACTIVE,
    ...over,
  } as unknown as AssociateListItem;
}

function renderRow(a: AssociateListItem = assoc()) {
  const fns = { onOpenDetail: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onCancelSubscription: vi.fn() };
  render(<table><tbody><AssociateRow associate={a} {...fns} /></tbody></table>);
  return fns;
}

afterEach(() => cleanup());

describe('AssociateRow', () => {
  it('mostra nome, whatsapp, email e dia de vencimento', () => {
    renderRow();
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('+5511999998888')).toBeInTheDocument();
    expect(screen.getByText('j@x.com')).toBeInTheDocument();
    expect(screen.getByText('Dia 10')).toBeInTheDocument();
  });

  it('email ausente vira travessão', () => {
    renderRow(assoc({ email: null }));
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('clicar na linha abre o detalhe', () => {
    const { onOpenDetail } = renderRow();
    fireEvent.click(screen.getByText('João'));
    expect(onOpenDetail).toHaveBeenCalled();
  });

  it('ACTIVE mostra cancelar recorrência; editar/excluir com stopPropagation', () => {
    const { onEdit, onCancelSubscription, onDelete, onOpenDetail } = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar recorrência' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onEdit).toHaveBeenCalled();
    expect(onCancelSubscription).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it('status CANCELED oculta o botão de cancelar recorrência', () => {
    renderRow(assoc({ status: AssociateStatus.CANCELED }));
    expect(screen.queryByRole('button', { name: 'Cancelar recorrência' })).not.toBeInTheDocument();
  });
});
