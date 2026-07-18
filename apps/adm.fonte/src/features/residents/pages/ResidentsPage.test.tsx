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
