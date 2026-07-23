import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Gender } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

const mutate = vi.fn();
const reset = vi.fn();
let state = { isPending: false, isError: false, error: null as unknown };

vi.mock('../hooks/useResidents', () => ({
  useUpdateResidentIdentity: () => ({ mutate, reset, ...state }),
}));

import { EditResidentIdentityDialog } from './EditResidentIdentityDialog';

function resident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'r1',
    name: 'Fulano de Tal',
    cpf: '12345678900',
    rg: '123456',
    birthDate: '1990-05-10',
    gender: Gender.MALE,
    ...overrides,
  } as Resident;
}

beforeEach(() => {
  vi.clearAllMocks();
  state = { isPending: false, isError: false, error: null };
});
afterEach(() => cleanup());

describe('EditResidentIdentityDialog', () => {
  it('pré-preenche os campos com os valores atuais (CPF/RG completos)', () => {
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.getByDisplayValue('Fulano de Tal')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123.456.789-00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12.345.6')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1990-05-10')).toBeInTheDocument();
  });

  it('valida nome obrigatório e não muta', async () => {
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    fireEvent.change(screen.getByDisplayValue('Fulano de Tal'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submit dispara a mutation com payload normalizado (CPF/RG só dígitos)', async () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(<EditResidentIdentityDialog open onClose={onClose} resident={resident()} />);
    fireEvent.change(screen.getByDisplayValue('Fulano de Tal'), { target: { value: 'Beltrano' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const arg = mutate.mock.calls[0][0];
    expect(arg).toEqual({
      name: 'Beltrano',
      cpf: '12345678900',
      rg: '123456',
      birthDate: '1990-05-10',
      gender: Gender.MALE,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('envia null quando CPF/RG são apagados', async () => {
    mutate.mockImplementation((_data, opts) => opts.onSuccess());
    render(
      <EditResidentIdentityDialog
        open
        onClose={vi.fn()}
        resident={resident({ cpf: null, rg: null, gender: null, birthDate: null })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const arg = mutate.mock.calls[0][0];
    expect(arg.cpf).toBeNull();
    expect(arg.rg).toBeNull();
    expect(arg.birthDate).toBeNull();
    expect(arg.gender).toBeNull();
  });

  it('mostra erro da mutation', () => {
    state = { isPending: false, isError: true, error: new Error('boom') };
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.getByText(/Erro ao corrigir os dados|boom/)).toBeInTheDocument();
  });
});
