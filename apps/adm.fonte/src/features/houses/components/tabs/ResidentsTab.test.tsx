import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

// ResidentsFilters (real) busca as casas — não relevante aqui, casa é fixa.
vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [] }),
}));

const fetchNextPage = vi.fn();
const refetch = vi.fn();
const infiniteMock = vi.fn();
let infiniteResult: Record<string, unknown>;
let detailResult: { data: unknown } = { data: null };

vi.mock('@/features/residents/hooks/useResidents', () => ({
  useInfiniteResidents: (params: unknown) => {
    infiniteMock(params);
    return infiniteResult;
  },
  useResidentById: () => detailResult,
}));

// IntersectionObserver controlável — guarda o callback p/ disparar manualmente.
let ioCallback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();
class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    ioCallback = cb;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

import { ResidentsTab } from './ResidentsTab';

const resident = (id: string, name: string) => ({
  id,
  name,
  entryDate: '2026-01-10',
  status: ResidentStatus.ACTIVE,
});

function makeResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [{ data: [], total: 0 }] },
    isLoading: false,
    isError: false,
    refetch,
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  infiniteResult = makeResult();
  detailResult = { data: null };
});
afterEach(() => cleanup());

describe('ResidentsTab', () => {
  it('lista os filhos da casa via useInfiniteResidents com o houseId da casa', () => {
    infiniteResult = makeResult({
      data: { pages: [{ data: [resident('r1', 'Filho A'), resident('r2', 'Filho B')], total: 2 }] },
    });
    render(<ResidentsTab houseId="h1" />);

    expect(infiniteMock).toHaveBeenCalledWith(expect.objectContaining({ houseId: 'h1' }));
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText('Filho B')).toBeInTheDocument();
    expect(screen.getByText('Filhos (2)')).toBeInTheDocument();
  });

  it('a busca filtra (após debounce dispara nova query com search)', () => {
    vi.useFakeTimers();
    try {
      render(<ResidentsTab houseId="h1" />);
      fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
        target: { value: 'ana' },
      });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      const lastCall = infiniteMock.mock.calls.at(-1)?.[0] as { search?: string };
      expect(lastCall.search).toBe('ana');
    } finally {
      vi.useRealTimers();
    }
  });

  it('o filtro de status aplica e o seletor de Casa não aparece', () => {
    render(<ResidentsTab houseId="h1" />);

    // combobox[0] = status, combobox[1] = ordenação (sem o de Casa).
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    expect(screen.queryByText('Todas as casas')).not.toBeInTheDocument();

    fireEvent.change(selects[0], { target: { value: ResidentStatus.DISCIPLINE } });
    const lastCall = infiniteMock.mock.calls.at(-1)?.[0] as { status?: string };
    expect(lastCall.status).toBe(ResidentStatus.DISCIPLINE);
  });

  it('o sentinela dispara fetchNextPage quando há próxima página', () => {
    infiniteResult = makeResult({
      data: { pages: [{ data: [resident('r1', 'Filho A')], total: 40 }] },
      hasNextPage: true,
    });
    render(<ResidentsTab houseId="h1" />);

    act(() => {
      ioCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it('lista vazia mostra EmptyState', () => {
    render(<ResidentsTab houseId="h1" />);
    expect(screen.getByText('Nenhum filho encontrado.')).toBeInTheDocument();
  });

  it('erro mostra ErrorState', () => {
    infiniteResult = makeResult({ isError: true });
    render(<ResidentsTab houseId="h1" />);
    expect(screen.getByText('Erro ao carregar dados.')).toBeInTheDocument();
  });

  it('clicar num item abre o dialog de detalhes e "Ver página completa" navega', () => {
    infiniteResult = makeResult({
      data: { pages: [{ data: [resident('r1', 'Filho A')], total: 1 }] },
    });
    detailResult = {
      data: {
        id: 'r1',
        name: 'Filho A',
        status: ResidentStatus.ACTIVE,
        entryDate: '2026-01-10',
        birthDate: '2000-01-01',
        cpf: '12345678901',
        rg: null,
        contactPhone: null,
        occupation: null,
        addiction: null,
        healthIssues: null,
        photoUrl: null,
        photoThumbUrl: null,
      },
    };
    render(<ResidentsTab houseId="h1" />);

    fireEvent.click(screen.getByText('Filho A'));
    expect(screen.getByText('Detalhes do Filho')).toBeInTheDocument();
    expect(screen.getByText(/anos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver página completa' }));
    expect(navigate).toHaveBeenCalledWith('/residents/r1');
  });
});
