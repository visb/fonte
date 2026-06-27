import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Event } from '@fonte/api-client';

const mutate = vi.fn();
const reset = vi.fn();

vi.mock('../hooks/useEvents', () => ({
  useUpdateEvent: () => ({ mutate, reset, isPending: false, error: null }),
}));
vi.mock('../lib/eventSchema', () => ({ toEventInput: (d: unknown) => d }));
vi.mock('./EventBannerUpload', () => ({ EventBannerUpload: () => <div data-testid="banner" /> }));
vi.mock('./EventForm', () => ({
  EventForm: ({ onSubmit, onCancel }: { onSubmit: (d: unknown) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => onSubmit({ title: 'Editado' })}>submit</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import { EditEventDialog } from './EditEventDialog';

const event = { id: 'e1', title: 'Original' } as Event;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('EditEventDialog', () => {
  it('aberto com evento mostra banner e formulário', () => {
    render(<EditEventDialog open event={event} onClose={vi.fn()} />);
    expect(screen.getByText('Editar evento')).toBeInTheDocument();
    expect(screen.getByTestId('banner')).toBeInTheDocument();
  });

  it('sem evento não renderiza o formulário', () => {
    render(<EditEventDialog open event={null} onClose={vi.fn()} />);
    expect(screen.queryByText('submit')).not.toBeInTheDocument();
  });

  it('submit envia id + data e fecha no sucesso', () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<EditEventDialog open event={event} onClose={onClose} />);
    fireEvent.click(screen.getByText('submit'));
    expect(mutate.mock.calls[0][0]).toEqual({ id: 'e1', data: { title: 'Editado' } });
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancel reseta e fecha', () => {
    const onClose = vi.fn();
    render(<EditEventDialog open event={event} onClose={onClose} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
