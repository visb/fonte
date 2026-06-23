import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { BibleCourseModule } from '@fonte/api-client';

const createMutate = vi.fn();
const updateMutate = vi.fn();
let createState = { isPending: false, error: null as unknown };
let updateState = { isPending: false, error: null as unknown };

vi.mock('../hooks/useBibleModules', () => ({
  useCreateBibleModule: () => ({ mutate: createMutate, ...createState }),
  useUpdateBibleModule: () => ({ mutate: updateMutate, ...updateState }),
}));

import { BibleModuleDialog } from './BibleModuleDialog';

function mod(overrides: Partial<BibleCourseModule> = {}): BibleCourseModule {
  return { id: 'm1', name: 'Gênesis', sequence: 1, notes: 'intro', ...overrides } as BibleCourseModule;
}

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false, error: null };
  updateState = { isPending: false, error: null };
});
afterEach(() => cleanup());

describe('BibleModuleDialog', () => {
  it('novo módulo: título de criação e ordem sugerida', () => {
    render(<BibleModuleDialog open module={null} nextSequence={3} onClose={vi.fn()} />);
    expect(screen.getByText('Novo módulo')).toBeInTheDocument();
    expect((screen.getByLabelText('Ordem *') as HTMLInputElement).value).toBe('3');
  });

  it('editar módulo: título de edição e nome/notas preenchidos', () => {
    render(<BibleModuleDialog open module={mod()} onClose={vi.fn()} />);
    expect(screen.getByText('Editar módulo')).toBeInTheDocument();
    expect((screen.getByLabelText('Nome *') as HTMLInputElement).value).toBe('Gênesis');
  });

  it('submit inválido (sem nome) não muta', async () => {
    render(<BibleModuleDialog open module={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText(/obrigatório/i)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('submit válido cria com notes null quando vazio', async () => {
    render(<BibleModuleDialog open module={null} nextSequence={2} onClose={vi.fn()} />);
    fireEvent.input(screen.getByLabelText('Nome *'), { target: { value: 'Êxodo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0];
    expect(arg.name).toBe('Êxodo');
    expect(arg.notes).toBeNull();
  });

  it('módulo existente: submit chama update com id', async () => {
    render(<BibleModuleDialog open module={mod()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].id).toBe('m1');
  });

  it('mostra erro da mutation', () => {
    createState = { isPending: false, error: new Error('boom') };
    render(<BibleModuleDialog open module={null} onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao salvar módulo|boom/)).toBeInTheDocument();
  });
});
