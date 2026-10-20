import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SERVICE_PERIOD_MESSAGES, type StaffServicePeriod } from '@fonte/types';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const createReset = vi.fn();
const updateReset = vi.fn();
let createState = { isPending: false, isError: false, error: null as unknown };
let updateState = { isPending: false, isError: false, error: null as unknown };
let periodsData: StaffServicePeriod[] = [];

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }, { id: 'h2', name: 'Casa Nazaré' }] }),
}));
vi.mock('../hooks/useStaff', () => ({
  useStaffServicePeriods: () => ({ data: periodsData }),
  useCreateServicePeriod: () => ({ mutate: createMutate, reset: createReset, ...createState }),
  useUpdateServicePeriod: () => ({ mutate: updateMutate, reset: updateReset, ...updateState }),
}));

import { ServicePeriodFormDialog } from './ServicePeriodFormDialog';

function period(overrides: Partial<StaffServicePeriod>): StaffServicePeriod {
  return {
    id: 'old',
    staffId: 's1',
    houseId: 'h1',
    house: { id: 'h1', name: 'Casa Belém' },
    startDate: '2020-01-01',
    endDate: '2020-06-30',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const open = period({ id: 'open', startDate: '2024-01-10', endDate: null });
const old = period({});

const startInput = () => document.getElementById('service-period-start-date') as HTMLInputElement;
const endInput = () => document.getElementById('service-period-end-date') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false, isError: false, error: null };
  updateState = { isPending: false, isError: false, error: null };
  periodsData = [open, old];
});
afterEach(() => cleanup());

describe('ServicePeriodFormDialog — criar', () => {
  it('cria período antigo com o payload certo e fecha', async () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_payload, opts) => opts.onSuccess());
    render(<ServicePeriodFormDialog open onClose={onClose} staffId="s1" />);
    expect(screen.getByText('Adicionar período de serviço')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: 'h2' } });
    fireEvent.change(startInput(), { target: { value: '01/03/2021' } });
    fireEvent.change(endInput(), { target: { value: '01/09/2021' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0]).toEqual({ houseId: 'h2', startDate: '2021-03-01', endDate: '2021-09-01' });
    expect(onClose).toHaveBeenCalled();
  });

  it('sem fim mostra a mensagem e não muta', async () => {
    render(<ServicePeriodFormDialog open onClose={vi.fn()} staffId="s1" />);
    fireEvent.change(startInput(), { target: { value: '01/03/2021' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(SERVICE_PERIOD_MESSAGES.endDateRequired)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('fim antes do início mostra a mensagem', async () => {
    render(<ServicePeriodFormDialog open onClose={vi.fn()} staffId="s1" />);
    fireEvent.change(startInput(), { target: { value: '01/09/2021' } });
    fireEvent.change(endInput(), { target: { value: '01/03/2021' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(SERVICE_PERIOD_MESSAGES.endBeforeStart('2021-09-01'))).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('sobreposição mostra o erro e não muta', async () => {
    render(<ServicePeriodFormDialog open onClose={vi.fn()} staffId="s1" />);
    fireEvent.change(startInput(), { target: { value: '01/05/2020' } });
    fireEvent.change(endInput(), { target: { value: '01/12/2020' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(
      await screen.findByText(SERVICE_PERIOD_MESSAGES.overlap('2020-01-01', '2020-06-30')),
    ).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('mostra o erro do backend via getErrorMessage', () => {
    createState = { isPending: false, isError: true, error: new Error('boom') };
    render(<ServicePeriodFormDialog open onClose={vi.fn()} staffId="s1" />);
    expect(screen.getByText(/Erro ao salvar o período de serviço|boom/)).toBeInTheDocument();
  });

  it('salvando desabilita os botões', () => {
    createState = { isPending: true, isError: false, error: null };
    render(<ServicePeriodFormDialog open onClose={vi.fn()} staffId="s1" />);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });

  it('cancelar reseta as mutations e fecha', () => {
    const onClose = vi.fn();
    render(<ServicePeriodFormDialog open onClose={onClose} staffId="s1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(createReset).toHaveBeenCalled();
    expect(updateReset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ServicePeriodFormDialog — editar', () => {
  it('período encerrado: pré-preenche e manda só o que mudou', async () => {
    updateMutate.mockImplementation((_vars, opts) => opts.onSuccess());
    render(<ServicePeriodFormDialog open onClose={vi.fn()} staffId="s1" period={old} />);
    expect(screen.getByText('Editar período de serviço')).toBeInTheDocument();
    expect(endInput().value).toBe('30/06/2020');

    fireEvent.change(screen.getByLabelText('Casa'), { target: { value: '' } });
    fireEvent.change(endInput(), { target: { value: '15/06/2020' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toEqual({
      periodId: 'old',
      payload: { houseId: null, endDate: '2020-06-15' },
    });
  });

  it('sem mudança fecha sem chamar a API', async () => {
    const onClose = vi.fn();
    render(<ServicePeriodFormDialog open onClose={onClose} staffId="s1" period={old} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('período aberto: só o início, com aviso do desligamento', async () => {
    render(<ServicePeriodFormDialog open onClose={vi.fn()} staffId="s1" period={open} />);
    expect(screen.getByText('Editar período em andamento')).toBeInTheDocument();
    expect(screen.getByText(/o fim é registrado pelo desligamento/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Casa')).toBeNull();
    expect(endInput()).toBeNull();

    fireEvent.change(startInput(), { target: { value: '05/01/2024' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toEqual({ periodId: 'open', payload: { startDate: '2024-01-05' } });
  });
});
