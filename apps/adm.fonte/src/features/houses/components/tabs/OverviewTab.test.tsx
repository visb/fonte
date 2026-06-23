import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { House } from '@fonte/api-client';

const state = { house: undefined as unknown };
const uploadMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock('../../hooks/useHouses', () => ({
  useHouseById: () => ({ data: state.house }),
  useUploadHousePhoto: () => ({ mutate: uploadMutate, isPending: false }),
  useDeleteHousePhoto: () => ({ mutate: deleteMutate }),
}));
vi.mock('../HouseDialog', () => ({
  HouseDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="house-dialog" /> : null),
}));
vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string) => `cdn/${u}` } }));

import { OverviewTab } from './OverviewTab';

function house(over: Partial<House> = {}): House {
  return {
    id: 'h1', name: 'Casa Belém', address: 'Rua A', city: 'SP', state: 'SP', phone: '11999',
    coordinator: { name: 'Coord' }, generalCapacity: 10, staffCapacity: 3,
    activeResidentsCount: 4, staffCount: 2, photos: [],
    ...over,
  } as unknown as House;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.house = house();
});
afterEach(() => cleanup());

describe('houses OverviewTab', () => {
  it('não renderiza nada enquanto a casa não carregou', () => {
    state.house = undefined;
    const { container } = render(<OverviewTab houseId="h1" />);
    expect(container.firstChild).toBeNull();
  });

  it('mostra informações da casa e o bloco de ocupação quando há capacidade', () => {
    render(<OverviewTab houseId="h1" />);
    expect(screen.getByText('Rua A')).toBeInTheDocument();
    expect(screen.getByText('SP — SP')).toBeInTheDocument();
    expect(screen.getByText('Coord')).toBeInTheDocument();
    expect(screen.getByText('vagas')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // filhos
  });

  it('sem capacidade oculta o bloco de ocupação', () => {
    state.house = house({ generalCapacity: null, staffCapacity: null });
    render(<OverviewTab houseId="h1" />);
    expect(screen.queryByText('vagas')).not.toBeInTheDocument();
  });

  it('galeria vazia mostra empty state', () => {
    render(<OverviewTab houseId="h1" />);
    expect(screen.getByText('Nenhuma foto cadastrada.')).toBeInTheDocument();
  });

  it('lista fotos e abre o diálogo de remoção', () => {
    state.house = house({ photos: [{ id: 'p1', url: 'u1', filename: 'foto.jpg' }] as House['photos'] });
    render(<OverviewTab houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover foto' }));
    expect(screen.getByRole('button', { name: 'Remover' })).toBeInTheDocument();
  });

  it('confirmar remoção chama a mutation com o id da foto', () => {
    state.house = house({ photos: [{ id: 'p1', url: 'u1', filename: 'foto.jpg' }] as House['photos'] });
    render(<OverviewTab houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover foto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(deleteMutate).toHaveBeenCalledWith('p1', expect.any(Object));
  });

  it('upload de foto chama a mutation', () => {
    const { container } = render(<OverviewTab houseId="h1" />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'nova.jpg', { type: 'image/jpeg' })] } });
    expect(uploadMutate).toHaveBeenCalled();
  });

  it('editar abre o HouseDialog', () => {
    render(<OverviewTab houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(screen.getByTestId('house-dialog')).toBeInTheDocument();
  });
});
