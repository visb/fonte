import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ADMISSION_HISTORY_MESSAGES, ResidentStatus } from '@fonte/types';
import type { Admission } from '@fonte/api-client';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const createReset = vi.fn();
const updateReset = vi.fn();
let createState = { isPending: false, isError: false, error: null as unknown };
let updateState = { isPending: false, isError: false, error: null as unknown };
let admissionsData: Admission[] = [];

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }, { id: 'h2', name: 'Casa Nazaré' }] }),
}));
vi.mock('../hooks/useResidents', () => ({
  useResidentAdmissions: () => ({ data: admissionsData }),
  useCreateAdmission: () => ({ mutate: createMutate, reset: createReset, ...createState }),
  useUpdateAdmission: () => ({ mutate: updateMutate, reset: updateReset, ...updateState }),
}));

import { AdmissionFormDialog } from './AdmissionFormDialog';

function admission(overrides: Partial<Admission>): Admission {
  return {
    id: 'old',
    residentId: 'r1',
    houseId: 'h1',
    house: { id: 'h1', name: 'Casa Belém' },
    status: ResidentStatus.DISCHARGED,
    entryDate: '2020-01-01',
    exitDate: '2020-06-30',
    ...overrides,
  } as Admission;
}

const current = admission({ id: 'cur', entryDate: '2024-01-10', exitDate: null, status: ResidentStatus.ACTIVE });
const old = admission({});

const entryInput = () => document.getElementById('admission-entry-date') as HTMLInputElement;
const exitInput = () => document.getElementById('admission-exit-date') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false, isError: false, error: null };
  updateState = { isPending: false, isError: false, error: null };
  admissionsData = [current, old];
});
afterEach(() => cleanup());

describe('AdmissionFormDialog — criar', () => {
  it('cria passagem antiga com o payload certo e fecha', async () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_payload, opts) => opts.onSuccess());
    render(<AdmissionFormDialog open onClose={onClose} residentId="r1" />);
    expect(screen.getByText('Adicionar acolhimento')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'h2' } });
    fireEvent.change(entryInput(), { target: { value: '01/03/2021' } });
    fireEvent.change(exitInput(), { target: { value: '01/09/2021' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: ResidentStatus.EVADED } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toEqual({
      houseId: 'h2',
      entryDate: '2021-03-01',
      exitDate: '2021-09-01',
      status: ResidentStatus.EVADED,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('sem saída e sem status mostra as mensagens e não muta', async () => {
    render(<AdmissionFormDialog open onClose={vi.fn()} residentId="r1" />);
    fireEvent.change(entryInput(), { target: { value: '01/03/2021' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(ADMISSION_HISTORY_MESSAGES.exitDateRequired)).toBeInTheDocument();
    expect(screen.getByText(ADMISSION_HISTORY_MESSAGES.exitStatusRequired)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('sobreposição mostra o erro e não muta', async () => {
    render(<AdmissionFormDialog open onClose={vi.fn()} residentId="r1" />);
    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'h1' } });
    fireEvent.change(entryInput(), { target: { value: '01/05/2020' } });
    fireEvent.change(exitInput(), { target: { value: '01/12/2020' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: ResidentStatus.DISCHARGED } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText(ADMISSION_HISTORY_MESSAGES.overlap('2020-01-01', '2020-06-30')),
    ).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('mostra o erro do backend via getErrorMessage', () => {
    createState = { isPending: false, isError: true, error: new Error('boom') };
    render(<AdmissionFormDialog open onClose={vi.fn()} residentId="r1" />);
    expect(screen.getByText(/Erro ao salvar o acolhimento|boom/)).toBeInTheDocument();
  });

  it('cancelar reseta as mutations e fecha', () => {
    const onClose = vi.fn();
    render(<AdmissionFormDialog open onClose={onClose} residentId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(createReset).toHaveBeenCalled();
    expect(updateReset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AdmissionFormDialog — editar', () => {
  it('passagem encerrada: pré-preenche e manda só o que mudou', async () => {
    updateMutate.mockImplementation((_vars, opts) => opts.onSuccess());
    render(<AdmissionFormDialog open onClose={vi.fn()} residentId="r1" admission={old} />);
    expect(screen.getByText('Editar acolhimento')).toBeInTheDocument();
    expect(exitInput().value).toBe('30/06/2020');

    fireEvent.change(exitInput(), { target: { value: '15/06/2020' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toEqual({ admissionId: 'old', payload: { exitDate: '2020-06-15' } });
  });

  it('sem mudança fecha sem chamar a API', async () => {
    const onClose = vi.fn();
    render(<AdmissionFormDialog open onClose={onClose} residentId="r1" admission={old} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('acolhimento atual: só o campo de entrada, com aviso do carnê', async () => {
    render(<AdmissionFormDialog open onClose={vi.fn()} residentId="r1" admission={current} />);
    expect(screen.getByText('Editar acolhimento atual')).toBeInTheDocument();
    expect(screen.getByText(/O carnê não é recalculado/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Casa')).toBeNull();
    expect(screen.queryByLabelText('Status')).toBeNull();
    expect(exitInput()).toBeNull();

    fireEvent.change(entryInput(), { target: { value: '05/01/2024' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toEqual({ admissionId: 'cur', payload: { entryDate: '2024-01-05' } });
  });
});
