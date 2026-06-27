import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Activity } from '@fonte/api-client';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const createReset = vi.fn();
const updateReset = vi.fn();

vi.mock('../hooks/useActivities', () => ({
  useCreateActivity: () => ({ mutate: createMutate, reset: createReset, isPending: false, error: null }),
  useUpdateActivity: () => ({ mutate: updateMutate, reset: updateReset, isPending: false, error: null }),
}));

const sample = { title: 'Limpeza', description: '', houseId: '' };

vi.mock('./ActivityForm', () => ({
  ActivityForm: ({ onSubmit, onCancel }: { onSubmit: (d: typeof sample) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => onSubmit(sample)}>submit</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import { ActivityDialog } from './ActivityDialog';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ActivityDialog', () => {
  it('modo criação: título e cria com payload sanitizado (vazios→null)', () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<ActivityDialog open onClose={onClose} />);
    expect(screen.getByText('Nova atividade')).toBeInTheDocument();
    fireEvent.click(screen.getByText('submit'));
    const arg = createMutate.mock.calls[0][0];
    expect(arg).toEqual({ title: 'Limpeza', description: null, houseId: null });
    expect(createReset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('modo edição: título e update com id', () => {
    const onClose = vi.fn();
    updateMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<ActivityDialog open activity={{ id: 'a1' } as Activity} onClose={onClose} />);
    expect(screen.getByText('Editar atividade')).toBeInTheDocument();
    fireEvent.click(screen.getByText('submit'));
    expect(updateMutate.mock.calls[0][0]).toMatchObject({ id: 'a1' });
    expect(createMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancel reseta e fecha', () => {
    const onClose = vi.fn();
    render(<ActivityDialog open onClose={onClose} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(createReset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
