import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const staffQuery = { data: [] as unknown[], isLoading: false, isError: false, refetch: vi.fn() };
const useStaffArgs = vi.fn();
const auth = { role: 'ADMIN' as string | null };

vi.mock('../hooks/useStaff', () => ({
  useStaff: (options: unknown) => {
    useStaffArgs(options);
    return staffQuery;
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }] }),
}));
const { setPreferenceValue } = vi.hoisted(() => ({ setPreferenceValue: vi.fn() }));
vi.mock('@/features/preferences/hooks/usePreference', () => ({
  usePreference: () => [null, setPreferenceValue],
}));
vi.mock('../components/ResetPasswordDialog', () => ({ ResetPasswordDialog: () => null }));
vi.mock('../components/DeleteStaffDialog', () => ({
  DeleteStaffDialog: ({ staff }: { staff: { name: string } | null }) =>
    staff ? <div>delete {staff.name}</div> : null,
}));
vi.mock('../components/StaffCard', () => ({
  StaffCard: ({ staff, href, onDelete }: { staff: { name: string }; href: string; onDelete: () => void }) => (
    <button data-href={href} onClick={onDelete}>
      {staff.name}
    </button>
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

const ACTIVE = { status: 'active', search: '', houseId: '' };

beforeEach(() => {
  vi.clearAllMocks();
  auth.role = 'ADMIN';
  staffQuery.data = [];
  staffQuery.isLoading = false;
  staffQuery.isError = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StaffPage — filtro Ativos | Desligados (story 217)', () => {
  it('default lista ativos; trocar o filtro busca os desligados', () => {
    renderPage();
    expect(useStaffArgs).toHaveBeenLastCalledWith(ACTIVE);
    expect(screen.getByText('Nenhum servo cadastrado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desligados' }));
    expect(useStaffArgs).toHaveBeenLastCalledWith({ ...ACTIVE, status: 'dismissed' });
    expect(screen.getByText('Nenhum servo desligado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ativos' }));
    expect(useStaffArgs).toHaveBeenLastCalledWith(ACTIVE);
  });

  it('?status=dismissed na URL abre no filtro de desligados', () => {
    renderPage('/staff?status=dismissed');
    expect(useStaffArgs).toHaveBeenLastCalledWith({ ...ACTIVE, status: 'dismissed' });
    expect(screen.getByRole('button', { name: 'Desligados' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lista os cards com link para o detalhe, contagem no título e abre a exclusão', () => {
    staffQuery.data = [
      { id: 's1', name: 'Pedro Servo' },
      { id: 's2', name: 'Ana Serva' },
    ];
    renderPage();
    expect(screen.getByRole('heading', { name: 'Servos (2)' })).toBeInTheDocument();
    expect(screen.getByText('Pedro Servo')).toHaveAttribute('data-href', '/staff/s1');
    fireEvent.click(screen.getByText('Pedro Servo'));
    expect(screen.getByText('delete Pedro Servo')).toBeInTheDocument();
  });

  it('estados de carregando e erro (título sem contagem)', () => {
    staffQuery.isLoading = true;
    renderPage();
    expect(screen.queryByText('Nenhum servo cadastrado.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Servos' })).toBeInTheDocument();
    cleanup();

    staffQuery.isLoading = false;
    staffQuery.isError = true;
    renderPage();
    expect(screen.queryByText('Nenhum servo cadastrado.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Servos' })).toBeInTheDocument();
  });
});

describe('StaffPage — busca e casa (story 223)', () => {
  it('filtros da URL vão ao useStaff e o vazio vira "Nenhum servo encontrado."', () => {
    renderPage('/staff?q=ana&house=h1&status=dismissed');
    expect(useStaffArgs).toHaveBeenLastCalledWith({ status: 'dismissed', search: 'ana', houseId: 'h1' });
    expect(screen.getByText('Nenhum servo encontrado.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Casa' })).toHaveValue('h1');
  });

  it('digitar busca dispara o useStaff após o debounce', () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar servos' }), { target: { value: 'joão' } });
    expect(useStaffArgs).toHaveBeenLastCalledWith(ACTIVE);
    act(() => vi.advanceTimersByTime(400));
    expect(useStaffArgs).toHaveBeenLastCalledWith({ ...ACTIVE, search: 'joão' });
  });

  it('ADMIN escolhe casa: useStaff recebe o houseId e a preferência é gravada', () => {
    renderPage();
    fireEvent.change(screen.getByRole('combobox', { name: 'Casa' }), { target: { value: 'h1' } });
    expect(useStaffArgs).toHaveBeenLastCalledWith({ ...ACTIVE, houseId: 'h1' });
    expect(setPreferenceValue).toHaveBeenLastCalledWith({ status: 'active', house: 'h1' });
  });

  it('COORDINATOR não vê o seletor de casa e house da URL é ignorado', () => {
    auth.role = 'COORDINATOR';
    renderPage('/staff?house=h1');
    expect(screen.queryByRole('combobox', { name: 'Casa' })).toBeNull();
    expect(useStaffArgs).toHaveBeenLastCalledWith(ACTIVE);
  });
});
