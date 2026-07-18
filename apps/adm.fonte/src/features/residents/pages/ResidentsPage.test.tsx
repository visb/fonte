import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useResidents', () => ({
  useInfiniteResidents: vi.fn(),
  useDeleteResident: vi.fn(),
}));

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [] }),
}));

// Preferência mockada (story 130): controlamos o valor salvo e espionamos a
// gravação, sem tocar localStorage nem rede.
const { setPreferenceValue, prefState } = vi.hoisted(() => ({
  setPreferenceValue: vi.fn(),
  prefState: { saved: null as unknown },
}));
vi.mock('@/features/preferences/hooks/usePreference', () => ({
  usePreference: () => [prefState.saved, setPreferenceValue],
}));

import { useInfiniteResidents, useDeleteResident } from '../hooks/useResidents';
import { ResidentsPage } from './ResidentsPage';

// O infinite scroll observa um sentinel; jsdom não tem IntersectionObserver.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const infinite = vi.mocked(useInfiniteResidents);
const del = vi.mocked(useDeleteResident);

beforeEach(() => {
  vi.clearAllMocks();
  prefState.saved = null;
  infinite.mockReturnValue({
    data: { pages: [{ data: [], total: 0 }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  } as unknown as ReturnType<typeof useInfiniteResidents>);
  del.mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useDeleteResident>);
});

afterEach(() => cleanup());

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ResidentsPage />
    </MemoryRouter>,
  );
}

describe('ResidentsPage — ordenação (story 129)', () => {
  it('sem sort na URL usa o default da tela (entryDate/desc)', () => {
    renderAt('/residents');
    expect(infinite).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'entryDate', order: 'desc' }),
    );
  });

  it('?sort=name_asc chama o hook com name/asc', () => {
    renderAt('/residents?sort=name_asc');
    expect(infinite).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'name', order: 'asc' }),
    );
  });

  it('sort inválido na URL cai no default da tela', () => {
    renderAt('/residents?sort=lixo');
    expect(infinite).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'entryDate', order: 'desc' }),
    );
  });

  it('trocar o select escreve na URL e re-chama o hook com a nova ordenação', () => {
    renderAt('/residents');
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), {
      target: { value: 'name_desc' },
    });
    expect(infinite).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'name', order: 'desc' }),
    );
  });
});

describe('ResidentsPage — filtros persistidos (story 130)', () => {
  it('URL vazia + preferência salva → hidrata a URL com os filtros salvos (decisão 4)', () => {
    prefState.saved = { status: 'DISCIPLINE', house: 'h2', overdue: true, sort: 'name_asc' };
    renderAt('/residents');
    expect(infinite).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'DISCIPLINE',
        houseId: 'h2',
        overdueContribution: true,
        sort: 'name',
        order: 'asc',
      }),
    );
  });

  it('URL com um filtro → preferência ignorada por inteiro; URL intacta (decisão 5)', () => {
    prefState.saved = { status: 'DISCIPLINE', house: 'h2', overdue: true, sort: 'name_asc' };
    renderAt('/residents?house=h1');
    // Só o filtro da URL vale; status volta ao default (ACTIVE), sem os demais salvos.
    expect(infinite).toHaveBeenLastCalledWith(
      expect.objectContaining({
        houseId: 'h1',
        status: 'ACTIVE',
        overdueContribution: false,
        sort: 'entryDate',
        order: 'desc',
      }),
    );
  });

  it("status='' salvo → hidrata como presente-e-vazio (Todos), não como ausente (Ativo)", () => {
    prefState.saved = { status: '', house: '', overdue: false, sort: 'entry_desc' };
    renderAt('/residents');
    expect(infinite).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: '' }),
    );
  });

  it('trocar filtro grava a preferência (sem q — decisão 6)', () => {
    renderAt('/residents?q=fulano');
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), {
      target: { value: 'name_desc' },
    });
    expect(setPreferenceValue).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'name_desc' }),
    );
    const savedArg = setPreferenceValue.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(savedArg).not.toHaveProperty('q');
  });

  it('sem preferência salva não hidrata nem altera a URL', () => {
    prefState.saved = null;
    renderAt('/residents');
    expect(infinite).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ACTIVE', houseId: '', sort: 'entryDate' }),
    );
  });
});
