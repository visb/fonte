import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Gender, INVALID_CPF_MESSAGE, MIN_AGE_MESSAGE, RESIDENT_CPF_IN_USE_CODE } from '@fonte/types';
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
    // DateInput (story 201) exibe dd/mm/aaaa; o payload segue YYYY-MM-DD.
    expect(screen.getByDisplayValue('10/05/1990')).toBeInTheDocument();
  });

  it('nascimento corrigido pelo DateInput vai como YYYY-MM-DD', async () => {
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    fireEvent.change(screen.getByDisplayValue('10/05/1990'), { target: { value: '02/03/1988' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].birthDate).toBe('1988-03-02');
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

  // Story 202 — nascimento só de maiores de 18, julgado apenas quando muda.
  it('alterar o nascimento para menor de 18 mostra a mensagem e não muta', async () => {
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    const minorYear = new Date().getFullYear() - 10;
    fireEvent.change(screen.getByDisplayValue('10/05/1990'), {
      target: { value: `01/01/${minorYear}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(MIN_AGE_MESSAGE)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('ficha legada com nascimento de menor salva quando a data não muda', async () => {
    const minor = `${new Date().getFullYear() - 10}-02-03`;
    render(
      <EditResidentIdentityDialog open onClose={vi.fn()} resident={resident({ birthDate: minor })} />,
    );
    fireEvent.change(screen.getByDisplayValue('Fulano de Tal'), { target: { value: 'Outro Nome' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0].birthDate).toBe(minor);
    expect(screen.queryByText(MIN_AGE_MESSAGE)).toBeNull();
  });

  // Story 219 — o CPF carregado acima (12345678900) é legado com DV inválido.
  it('CPF legado inválido salva sem mudar; mudar para outro inválido mostra a mensagem', async () => {
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    fireEvent.change(screen.getByDisplayValue('123.456.789-00'), { target: { value: '111.111.111-11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(INVALID_CPF_MESSAGE)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('409 de CPF em uso → erro no campo com link "Ver cadastro"', async () => {
    mutate.mockImplementation((_data, opts) =>
      opts.onError({
        response: {
          status: 409,
          data: {
            code: RESIDENT_CPF_IN_USE_CODE,
            message: 'Já existe um filho com este CPF: Bruno (Alta).',
            conflictResidentId: 'r9',
          },
        },
      }),
    );
    render(
      <MemoryRouter>
        <EditResidentIdentityDialog open onClose={vi.fn()} resident={resident({ cpf: null })} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '52998224725' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/Já existe um filho com este CPF: Bruno \(Alta\)\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver cadastro' })).toHaveAttribute('href', '/residents/r9');
    expect(mutate.mock.calls[0][0].cpf).toBe('52998224725');
  });

  it('erro 409 de CPF não se repete no rodapé', () => {
    state = {
      isPending: false,
      isError: true,
      error: { response: { data: { code: RESIDENT_CPF_IN_USE_CODE, message: 'CPF duplicado X' } } },
    };
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.queryByText('CPF duplicado X')).toBeNull();
  });

  it('mostra erro da mutation', () => {
    state = { isPending: false, isError: true, error: new Error('boom') };
    render(<EditResidentIdentityDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.getByText(/Erro ao corrigir os dados|boom/)).toBeInTheDocument();
  });
});
