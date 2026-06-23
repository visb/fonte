import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaff: () => ({ data: [{ id: 's1', name: 'Servo A' }, { id: 's2', name: 'Servo B' }] }),
}));
const mutation = { mutate: vi.fn(), reset: vi.fn(), error: null as unknown, isPending: false };
vi.mock('../hooks/useActivities', () => ({ useChangeActivityStatus: () => mutation }));

import { ApproveActivityDialog } from './ApproveActivityDialog';

const activity = { id: 'a1', title: 'Limpeza', responsibleStaffId: null } as unknown as Activity;

beforeEach(() => {
  vi.clearAllMocks();
  mutation.mutate = vi.fn();
  mutation.error = null;
  mutation.isPending = false;
});
afterEach(() => cleanup());

describe('ApproveActivityDialog', () => {
  it('fechado não renderiza', () => {
    render(<ApproveActivityDialog open={false} activity={activity} onClose={vi.fn()} />);
    expect(screen.queryByText('Aprovar atividade')).not.toBeInTheDocument();
  });

  it('lista os servos e mostra o título da atividade', () => {
    render(<ApproveActivityDialog open activity={activity} onClose={vi.fn()} />);
    expect(screen.getByText('Limpeza')).toBeInTheDocument();
    expect(screen.getByText('Servo A')).toBeInTheDocument();
  });

  it('aprovar desabilitado sem responsável; não muta', () => {
    render(<ApproveActivityDialog open activity={activity} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  });

  it('escolher responsável e aprovar muta com TODO + responsibleStaffId e fecha', () => {
    const onClose = vi.fn();
    mutation.mutate = vi.fn((_v, opts) => opts.onSuccess());
    render(<ApproveActivityDialog open activity={activity} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/Responsável/), { target: { value: 's2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(mutation.mutate).toHaveBeenCalledWith(
      { id: 'a1', data: { status: ActivityStatus.TODO, responsibleStaffId: 's2' } },
      expect.any(Object),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('mostra erro da mutation', () => {
    mutation.error = new Error('boom');
    render(<ApproveActivityDialog open activity={activity} onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao aprovar atividade|boom/)).toBeInTheDocument();
  });

  it('cancelar reseta e fecha', () => {
    const onClose = vi.fn();
    render(<ApproveActivityDialog open activity={activity} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mutation.reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
