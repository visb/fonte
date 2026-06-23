import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { SupportGroup } from '@fonte/api-client';

const createMutate = vi.fn();
const updateMutate = vi.fn();
let createState = { isPending: false };
let updateState = { isPending: false };

vi.mock('../hooks/useSupportGroups', () => ({
  useCreateSupportGroup: () => ({ mutate: createMutate, ...createState }),
  useUpdateSupportGroup: () => ({ mutate: updateMutate, ...updateState }),
}));
vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaff: () => ({ data: [{ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Servo C' }] }),
}));

import { SupportGroupDialog } from './SupportGroupDialog';

function group(overrides: Partial<SupportGroup> = {}): SupportGroup {
  return {
    id: 'g1',
    name: 'Grupo Recomeço',
    churchName: 'Igreja Central',
    address: 'Rua 1',
    coordinatorId: null,
    dayOfWeek: 2,
    ...overrides,
  } as SupportGroup;
}

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false };
  updateState = { isPending: false };
});
afterEach(() => cleanup());

describe('SupportGroupDialog', () => {
  it('novo grupo: título de criação e botão "Criar"', () => {
    render(<SupportGroupDialog open group={null} onClose={vi.fn()} />);
    expect(screen.getByText('Novo grupo de apoio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });

  it('editar grupo: preenche campos e título de edição', () => {
    render(<SupportGroupDialog open group={group()} onClose={vi.fn()} />);
    expect(screen.getByText('Editar grupo de apoio')).toBeInTheDocument();
    expect((screen.getByLabelText('Nome *') as HTMLInputElement).value).toBe('Grupo Recomeço');
  });

  it('submit inválido não muta', async () => {
    render(<SupportGroupDialog open group={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('submit válido cria com payload completo', async () => {
    render(<SupportGroupDialog open group={null} onClose={vi.fn()} />);
    fireEvent.input(screen.getByLabelText('Nome *'), { target: { value: 'Novo Grupo' } });
    fireEvent.input(screen.getByLabelText('Nome da Igreja *'), { target: { value: 'Igreja X' } });
    fireEvent.input(screen.getByLabelText('Endereço *'), { target: { value: 'Rua Y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0];
    expect(arg.name).toBe('Novo Grupo');
    expect(arg.coordinatorId).toBeNull();
  });

  it('grupo existente: submit chama update com id', async () => {
    render(<SupportGroupDialog open group={group()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].id).toBe('g1');
  });

  it('pending desabilita o submit', () => {
    createState = { isPending: true };
    render(<SupportGroupDialog open group={null} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
