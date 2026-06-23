import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FollowUpAccessLevel, FollowUpType } from '@fonte/types';

const mutate = vi.fn();
let state = { isPending: false };

vi.mock('../hooks/useResidentFollowUps', () => ({
  useCreateFollowUp: () => ({ mutate, ...state }),
}));

import { AddFollowUpDialog } from './AddFollowUpDialog';

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false };
});
afterEach(() => cleanup());

describe('AddFollowUpDialog', () => {
  it('renderiza título e campos com defaults', () => {
    render(<AddFollowUpDialog open residentId="res1" onClose={vi.fn()} />);
    expect(screen.getByText('Registrar evento')).toBeInTheDocument();
    expect(screen.getByLabelText('Data *')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo *')).toBeInTheDocument();
    expect(screen.getByLabelText('Visibilidade *')).toBeInTheDocument();
  });

  it('não oferece o tipo MONTHLY_CONTRIBUTION', () => {
    render(<AddFollowUpDialog open residentId="res1" onClose={vi.fn()} />);
    const typeSelect = screen.getByLabelText('Tipo *') as HTMLSelectElement;
    const values = Array.from(typeSelect.options).map((o) => o.value);
    expect(values).not.toContain(FollowUpType.MONTHLY_CONTRIBUTION);
  });

  it('submit muta com defaults e descrição undefined quando vazia; fecha no sucesso', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<AddFollowUpDialog open residentId="res1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const arg = mutate.mock.calls[0][0];
    expect(arg.type).toBe(FollowUpType.NOTE);
    expect(arg.accessLevel).toBe(FollowUpAccessLevel.ALL);
    expect(arg.description).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelar dispara onClose', () => {
    const onClose = vi.fn();
    render(<AddFollowUpDialog open residentId="res1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });
});
