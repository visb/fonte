import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const mutate = vi.fn();
const reset = vi.fn();

vi.mock('../hooks/useEvents', () => ({
  useCreateEvent: () => ({ mutate, reset, isPending: false, error: null }),
}));
vi.mock('../lib/eventSchema', () => ({ toEventInput: (d: unknown) => d }));
vi.mock('./EventForm', () => ({
  EventForm: ({ onSubmit, onCancel }: { onSubmit: (d: unknown) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => onSubmit({ title: 'Festa' })}>submit</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import { CreateEventDialog } from './CreateEventDialog';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('CreateEventDialog', () => {
  it('aberto mostra título e formulário', () => {
    render(<CreateEventDialog open onClose={vi.fn()} />);
    expect(screen.getByText('Novo evento')).toBeInTheDocument();
    expect(screen.getByText('submit')).toBeInTheDocument();
  });

  it('submit cria e fecha no sucesso', () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<CreateEventDialog open onClose={onClose} />);
    fireEvent.click(screen.getByText('submit'));
    expect(mutate.mock.calls[0][0]).toEqual({ title: 'Festa' });
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancel reseta e fecha', () => {
    const onClose = vi.fn();
    render(<CreateEventDialog open onClose={onClose} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
