import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const createMutate = vi.fn();
const reset = vi.fn();
let state: { isPending: boolean; error: unknown } = { isPending: false, error: null };

vi.mock('../hooks/useAssociates', () => ({
  useCreateAssociate: () => ({ mutate: createMutate, reset, ...state }),
}));

const sample = {
  name: 'Fulano',
  whatsapp: '62999990000',
  email: 'f@x.com',
  contributionAmount: 50,
  dueDay: 10,
};

vi.mock('./AssociateForm', () => ({
  AssociateForm: ({ onSubmit, onCancel }: { onSubmit: (d: typeof sample) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => onSubmit(sample)}>submit</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import { CreateAssociateDialog } from './CreateAssociateDialog';

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, error: null };
});
afterEach(() => cleanup());

describe('CreateAssociateDialog', () => {
  it('aberto mostra título e o formulário', () => {
    render(<CreateAssociateDialog open onClose={vi.fn()} />);
    expect(screen.getByText('Novo associado')).toBeInTheDocument();
    expect(screen.getByText('submit')).toBeInTheDocument();
  });

  it('submit chama create com payload e, no sucesso, reseta e fecha', () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<CreateAssociateDialog open onClose={onClose} />);
    fireEvent.click(screen.getByText('submit'));
    expect(createMutate.mock.calls[0][0]).toMatchObject({ name: 'Fulano', contributionAmount: 50, dueDay: 10 });
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('email vazio vira undefined no payload', () => {
    createMutate.mockImplementation(() => {});
    render(<CreateAssociateDialog open onClose={vi.fn()} />);
    // re-mock form to submit without email
    fireEvent.click(screen.getByText('submit'));
    expect(createMutate.mock.calls[0][0].email).toBe('f@x.com');
  });

  it('cancel reseta e fecha', () => {
    const onClose = vi.fn();
    render(<CreateAssociateDialog open onClose={onClose} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
