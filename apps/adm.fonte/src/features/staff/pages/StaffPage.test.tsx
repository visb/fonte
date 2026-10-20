import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const staffQuery = { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() };
const useStaffArgs = vi.fn();

vi.mock('../hooks/useStaff', () => ({
  useStaff: (options: unknown) => {
    useStaffArgs(options);
    return staffQuery;
  },
}));
vi.mock('../components/ResetPasswordDialog', () => ({ ResetPasswordDialog: () => null }));
vi.mock('../components/DeleteStaffDialog', () => ({
  DeleteStaffDialog: ({ staff }: { staff: { name: string } | null }) =>
    staff ? <div>delete {staff.name}</div> : null,
}));
vi.mock('../components/StaffCard', () => ({
  StaffCard: ({ staff, onDelete }: { staff: { name: string }; onDelete: () => void }) => (
    <button onClick={onDelete}>{staff.name}</button>
  ),
}));

import { StaffPage } from './StaffPage';

function renderPage(url = '/staff') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <StaffPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  staffQuery.data = [];
  staffQuery.isLoading = false;
  staffQuery.isError = false;
});
afterEach(() => cleanup());

describe('StaffPage — filtro Ativos | Desligados (story 217)', () => {
  it('default lista ativos; trocar o filtro busca os desligados', () => {
    renderPage();
    expect(useStaffArgs).toHaveBeenLastCalledWith({ status: 'active' });
    expect(screen.getByText('Nenhum servo cadastrado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desligados' }));
    expect(useStaffArgs).toHaveBeenLastCalledWith({ status: 'dismissed' });
    expect(screen.getByText('Nenhum servo desligado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ativos' }));
    expect(useStaffArgs).toHaveBeenLastCalledWith({ status: 'active' });
  });

  it('?status=dismissed na URL abre no filtro de desligados', () => {
    renderPage('/staff?status=dismissed');
    expect(useStaffArgs).toHaveBeenLastCalledWith({ status: 'dismissed' });
    expect(screen.getByRole('button', { name: 'Desligados' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lista os cards e abre a exclusão de cadastro', () => {
    staffQuery.data = [{ id: 's1', name: 'Pedro Servo' }];
    renderPage();
    fireEvent.click(screen.getByText('Pedro Servo'));
    expect(screen.getByText('delete Pedro Servo')).toBeInTheDocument();
  });

  it('estados de carregando e erro', () => {
    staffQuery.isLoading = true;
    renderPage();
    expect(screen.queryByText('Nenhum servo cadastrado.')).toBeNull();
    cleanup();

    staffQuery.isLoading = false;
    staffQuery.isError = true;
    renderPage();
    expect(screen.queryByText('Nenhum servo cadastrado.')).toBeNull();
  });
});
