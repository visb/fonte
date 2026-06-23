import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { BibleCourseClass } from '@fonte/api-client';

const createMutate = vi.fn();
const updateMutate = vi.fn();
let createState = { isPending: false, error: null as unknown };
let updateState = { isPending: false, error: null as unknown };

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({
    data: [
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Casa Mãe', isMotherHouse: true },
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Casa Filial', isMotherHouse: false },
    ],
  }),
}));
vi.mock('../hooks/useBibleCourses', () => ({
  useCreateBibleClass: () => ({ mutate: createMutate, ...createState }),
  useUpdateBibleClass: () => ({ mutate: updateMutate, ...updateState }),
}));

import { BibleClassDialog } from './BibleClassDialog';

function klass(overrides: Partial<BibleCourseClass> = {}): BibleCourseClass {
  return {
    id: 'c1',
    name: 'Turma 2026',
    houseId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    startDate: '2026-01-10',
    endDate: '2026-03-26',
    status: 'PLANNED',
    houseName: 'Casa Filial',
    enrollmentCount: 0,
    ...overrides,
  } as BibleCourseClass;
}

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false, error: null };
  updateState = { isPending: false, error: null };
});
afterEach(() => cleanup());

describe('BibleClassDialog', () => {
  it('nova turma: título e casa mãe pré-selecionada; término calculado do início', () => {
    render(<BibleClassDialog open klass={null} defaultStartDate="2026-02-01" onClose={vi.fn()} />);
    expect(screen.getByText('Nova turma')).toBeInTheDocument();
    expect((screen.getByLabelText('Casa *') as HTMLSelectElement).value).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    // término = início + 75 dias
    expect((screen.getByLabelText('Término *') as HTMLInputElement).value).not.toBe('');
  });

  it('editar turma: título de edição e nome preenchido', () => {
    render(<BibleClassDialog open klass={klass()} onClose={vi.fn()} />);
    expect(screen.getByText('Editar turma')).toBeInTheDocument();
    expect((screen.getByLabelText('Nome *') as HTMLInputElement).value).toBe('Turma 2026');
  });

  it('mudar início recalcula término', () => {
    render(<BibleClassDialog open klass={null} onClose={vi.fn()} />);
    const start = screen.getByLabelText('Início *') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '2026-06-01' } });
    const end = screen.getByLabelText('Término *') as HTMLInputElement;
    // 2026-06-01 + 75 dias = 2026-08-15
    expect(end.value).toBe('2026-08-15');
  });

  it('submit inválido (sem nome) não muta', async () => {
    render(<BibleClassDialog open klass={null} defaultStartDate="2026-02-01" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText(/obrigatório/i)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('submit válido cria com payload (notes null quando vazio)', async () => {
    render(<BibleClassDialog open klass={null} defaultStartDate="2026-02-01" onClose={vi.fn()} />);
    fireEvent.input(screen.getByLabelText('Nome *'), { target: { value: 'Turma X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0];
    expect(arg.name).toBe('Turma X');
    expect(arg.notes).toBeNull();
  });

  it('turma existente: submit chama update com id', async () => {
    render(<BibleClassDialog open klass={klass()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].id).toBe('c1');
  });

  it('mostra erro da mutation', () => {
    createState = { isPending: false, error: new Error('boom') };
    render(<BibleClassDialog open klass={null} defaultStartDate="2026-02-01" onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao salvar turma|boom/)).toBeInTheDocument();
  });
});
