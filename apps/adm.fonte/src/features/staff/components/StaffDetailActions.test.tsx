import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Role } from '@fonte/types';
import type { Staff } from '@fonte/api-client';

const auth = { role: 'ADMIN' as string | null };
const navigate = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('./ResetPasswordDialog', () => ({
  ResetPasswordDialog: ({ open }: { open: boolean }) => (open ? <div>dialog-reset</div> : null),
}));
vi.mock('./DismissStaffDialog', () => ({
  DismissStaffDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <button onClick={onClose}>dialog-dismiss</button> : null,
}));
vi.mock('./ReinstateStaffDialog', () => ({
  ReinstateStaffDialog: ({ open, houseId }: { open: boolean; houseId?: string | null }) =>
    open ? <div>dialog-reinstate {houseId}</div> : null,
}));
vi.mock('./DeleteStaffDialog', () => ({
  DeleteStaffDialog: ({ staff, onDeleted }: { staff: { name: string } | null; onDeleted: () => void }) =>
    staff ? <button onClick={onDeleted}>dialog-delete {staff.name}</button> : null,
}));

import { StaffDetailActions } from './StaffDetailActions';

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 's1',
    name: 'Pedro Servo',
    houseId: 'h1',
    dismissedAt: null,
    user: { email: 'p@x.com', role: Role.SERVANT },
    ...overrides,
  } as Staff;
}

function renderActions(staff: Staff) {
  render(
    <MemoryRouter>
      <StaffDetailActions staff={staff} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'ADMIN';
});
afterEach(() => cleanup());

describe('StaffDetailActions (story 217)', () => {
  it('ativo + ADMIN: Resetar senha, Editar, Desligar e Excluir cadastro; sem Reintegrar', () => {
    renderActions(makeStaff());
    expect(screen.getByRole('button', { name: /Resetar senha/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Editar/ })).toHaveAttribute('href', '/staff/s1/edit');
    expect(screen.getByRole('button', { name: /Desligar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Excluir cadastro/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintegrar/ })).toBeNull();
  });

  it('desligado + ADMIN: Reintegrar, sem Desligar nem Resetar senha', () => {
    renderActions(makeStaff({ dismissedAt: '2025-01-10' }));
    expect(screen.getByRole('button', { name: /Reintegrar/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Desligar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Resetar senha/ })).toBeNull();
  });

  it('COORDINATOR não vê Desligar, Reintegrar nem Excluir cadastro', () => {
    auth.role = 'COORDINATOR';
    renderActions(makeStaff());
    expect(screen.queryByRole('button', { name: /Desligar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Excluir cadastro/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Resetar senha/ })).toBeInTheDocument();
  });

  it('abre cada dialog; excluir navega para a lista', () => {
    renderActions(makeStaff());
    fireEvent.click(screen.getByRole('button', { name: /Resetar senha/ }));
    expect(screen.getByText('dialog-reset')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Desligar$/ }));
    fireEvent.click(screen.getByText('dialog-dismiss'));
    expect(screen.queryByText('dialog-dismiss')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Excluir cadastro/ }));
    fireEvent.click(screen.getByText('dialog-delete Pedro Servo'));
    expect(navigate).toHaveBeenCalledWith('/staff');
  });

  it('Reintegrar abre o dialog com a última casa', () => {
    renderActions(makeStaff({ dismissedAt: '2025-01-10' }));
    fireEvent.click(screen.getByRole('button', { name: /Reintegrar/ }));
    expect(screen.getByText('dialog-reinstate h1')).toBeInTheDocument();
  });
});
