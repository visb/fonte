import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Payable } from '@fonte/api-client';

const createMutation = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown };
const updateMutation = { mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown };
const uploadAttachment = { mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown };
const deleteAttachment = { mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, error: null as unknown };

vi.mock('../hooks/usePayables', () => ({
  useCreatePayable: () => createMutation,
  useUpdatePayable: () => updateMutation,
  useUploadPayableAttachment: () => uploadAttachment,
  useDeletePayableAttachment: () => deleteAttachment,
}));
vi.mock('./PayableForm', () => ({
  PayableForm: ({ onSubmit, onCancel }: { onSubmit: (s: unknown) => void; onCancel: () => void }) => (
    <div>
      <button onClick={() => onSubmit({ data: { description: 'Luz', amount: '150', dueDate: '2026-02-01', category: 'UTILITIES', supplier: '', notes: '' }, file: null, removeAttachment: false })}>submit</button>
      <button onClick={() => onSubmit({ data: { description: 'Luz', amount: '150', dueDate: '2026-02-01', category: 'UTILITIES', supplier: '', notes: '' }, file: new File(['x'], 'c.pdf'), removeAttachment: false })}>submit-file</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

import { PayableDialog } from './PayableDialog';

beforeEach(() => {
  vi.clearAllMocks();
  createMutation.mutate = vi.fn();
  updateMutation.mutate = vi.fn();
  uploadAttachment.mutateAsync = vi.fn().mockResolvedValue({});
  deleteAttachment.mutateAsync = vi.fn().mockResolvedValue({});
});
afterEach(() => cleanup());

describe('PayableDialog', () => {
  it('fechado não renderiza o form', () => {
    render(<PayableDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('submit')).not.toBeInTheDocument();
  });

  it('criar: título "Nova conta a pagar" e submit cria com valor em centavos', async () => {
    const onClose = vi.fn();
    createMutation.mutate = vi.fn((_p, opts) => opts.onSuccess({ id: 'new1' }));
    render(<PayableDialog open onClose={onClose} />);
    expect(screen.getByText('Nova conta a pagar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('submit'));
    expect(createMutation.mutate).toHaveBeenCalled();
    expect(createMutation.mutate.mock.calls[0][0].amount).toBe(15000);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('editar: título "Editar conta" e submit atualiza pelo id', async () => {
    const payable = { id: 'p1', description: 'Luz' } as unknown as Payable;
    updateMutation.mutate = vi.fn((_p, opts) => opts.onSuccess());
    render(<PayableDialog open payable={payable} onClose={vi.fn()} />);
    expect(screen.getByText('Editar conta')).toBeInTheDocument();
    fireEvent.click(screen.getByText('submit'));
    expect(updateMutation.mutate).toHaveBeenCalledWith({ id: 'p1', data: expect.any(Object) }, expect.any(Object));
  });

  it('submit com arquivo sobe o anexo após criar', async () => {
    createMutation.mutate = vi.fn((_p, opts) => opts.onSuccess({ id: 'new1' }));
    render(<PayableDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('submit-file'));
    await waitFor(() => expect(uploadAttachment.mutateAsync).toHaveBeenCalledWith({ id: 'new1', file: expect.any(File) }));
  });

  it('cancelar reseta e fecha', () => {
    const onClose = vi.fn();
    render(<PayableDialog open onClose={onClose} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(createMutation.reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
