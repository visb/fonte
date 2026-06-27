import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Associate } from '@fonte/api-client';

const updateMutate = vi.fn();
const reset = vi.fn();
let state: { isPending: boolean; error: unknown } = { isPending: false, error: null };

vi.mock('../hooks/useAssociates', () => ({
  useUpdateAssociate: () => ({ mutate: updateMutate, reset, ...state }),
}));

const sample = { name: 'Novo', whatsapp: '62988887777', email: '', contributionAmount: 30, dueDay: 5 };

vi.mock('./AssociateForm', () => ({
  AssociateForm: ({ onSubmit, onCancel }: { onSubmit: (d: typeof sample) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => onSubmit(sample)}>submit</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import { EditAssociateDialog } from './EditAssociateDialog';

const associate = { id: 'a1', name: 'Antigo' } as Associate;

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, error: null };
});
afterEach(() => cleanup());

describe('EditAssociateDialog', () => {
  it('aberto com associado mostra título e formulário', () => {
    render(<EditAssociateDialog open associate={associate} onClose={vi.fn()} />);
    expect(screen.getByText('Editar associado')).toBeInTheDocument();
    expect(screen.getByText('submit')).toBeInTheDocument();
  });

  it('sem associado não renderiza o formulário', () => {
    render(<EditAssociateDialog open associate={null} onClose={vi.fn()} />);
    expect(screen.queryByText('submit')).not.toBeInTheDocument();
  });

  it('submit envia id + data (email vazio→undefined) e fecha no sucesso', () => {
    const onClose = vi.fn();
    updateMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<EditAssociateDialog open associate={associate} onClose={onClose} />);
    fireEvent.click(screen.getByText('submit'));
    const arg = updateMutate.mock.calls[0][0];
    expect(arg.id).toBe('a1');
    expect(arg.data.email).toBeUndefined();
    expect(arg.data.name).toBe('Novo');
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancel reseta e fecha', () => {
    const onClose = vi.fn();
    render(<EditAssociateDialog open associate={associate} onClose={onClose} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
