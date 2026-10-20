import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RESIDENT_CPF_IN_USE_CODE, ResidentStatus } from '@fonte/types';

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }], isLoading: false }),
}));
vi.mock('@/features/houses/hooks/useHouseMinistries', () => ({
  useHouseMinistriesList: () => ({ data: [], isSuccess: true }),
}));
vi.mock('@/components/AvatarUpload', () => ({ AvatarUpload: () => null }));
vi.mock('@/lib/api', () => ({ api: { photoUrl: () => null } }));

const mutate = vi.fn();
let mutationState: { isPending: boolean; isError: boolean; error: unknown } = {
  isPending: false,
  isError: false,
  error: null,
};
let storedCpf: string | null = '12345678900';
// Objeto estável por teste: a page faz `reset` num effect que depende dele.
let residentQuery: { data: Record<string, unknown>; isLoading: boolean };
const loadResident = () => {
  residentQuery = {
    data: { id: 'r1', name: 'Ana', houseId: 'h1', status: ResidentStatus.ACTIVE, cpf: storedCpf },
    isLoading: false,
  };
};
vi.mock('../hooks/useResidents', () => ({
  useResidentById: () => residentQuery,
  useUpdateResident: () => ({ mutate, ...mutationState }),
}));

import { EditResidentPage } from './EditResidentPage';

function renderPage() {
  loadResident();
  return render(
    <MemoryRouter initialEntries={['/residents/r1/edit']}>
      <Routes>
        <Route path="/residents/:id/edit" element={<EditResidentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cpfInput = () => document.querySelector('input[name="cpf"]') as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

beforeEach(() => {
  vi.clearAllMocks();
  storedCpf = '12345678900';
  mutationState = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe('EditResidentPage — CPF do filho (story 219)', () => {
  it('CPF legado inválido não alterado salva (vai em dígitos)', async () => {
    renderPage();
    await waitFor(() => expect(cpfInput().value).toBe('123.456.789-00'));
    save();
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].data.cpf).toBe('12345678900');
  });

  it('trocar por CPF inválido mostra "CPF inválido." e não salva', async () => {
    renderPage();
    await waitFor(() => expect(cpfInput().value).toBe('123.456.789-00'));
    fireEvent.change(cpfInput(), { target: { value: '11111111111' } });
    save();
    expect(await screen.findByText('CPF inválido.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('409 de CPF em uso → erro no campo com link', async () => {
    storedCpf = null;
    mutate.mockImplementation((_vars, opts) =>
      opts.onError({
        response: {
          status: 409,
          data: { code: RESIDENT_CPF_IN_USE_CODE, message: 'Já existe um filho com este CPF: Bruno (Ativo).', conflictResidentId: 'r9' },
        },
      }),
    );
    renderPage();
    await waitFor(() => expect(cpfInput()).toBeInTheDocument());
    fireEvent.change(cpfInput(), { target: { value: '52998224725' } });
    save();
    expect(await screen.findByText(/Já existe um filho com este CPF: Bruno \(Ativo\)\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver cadastro' })).toHaveAttribute('href', '/residents/r9');
  });

  it('outro erro da gravação aparece acima dos botões', () => {
    mutationState = { isPending: false, isError: true, error: { response: { data: { message: 'falhou geral' } } } };
    renderPage();
    expect(screen.getByText('falhou geral')).toBeInTheDocument();
  });

  it('409 de CPF não é repetido como erro geral', () => {
    mutationState = {
      isPending: false,
      isError: true,
      error: { response: { data: { code: RESIDENT_CPF_IN_USE_CODE, message: 'CPF duplicado X' } } },
    };
    renderPage();
    expect(screen.queryByText('CPF duplicado X')).toBeNull();
  });
});
