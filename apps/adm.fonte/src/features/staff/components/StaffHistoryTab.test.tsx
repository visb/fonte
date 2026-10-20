import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

const periods = { data: [] as unknown[], isLoading: false };
const admissions = { data: [] as unknown[], isLoading: false };
const admissionsArgs = vi.fn();
const auth = { role: 'ADMIN' as string | null };
const serviceDialog = vi.fn();
const admissionDialog = vi.fn();

vi.mock('../hooks/useStaff', () => ({ useStaffServicePeriods: () => periods }));
vi.mock('@/features/residents/hooks/useResidents', () => ({
  useResidentAdmissions: (id: string, options: unknown) => {
    admissionsArgs(id, options);
    return admissions;
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('./ServicePeriodFormDialog', () => ({
  ServicePeriodFormDialog: (props: { open: boolean; period: { id: string } | null }) => {
    serviceDialog(props);
    return props.open ? <div data-testid="service-dialog">{props.period?.id ?? 'novo'}</div> : null;
  },
}));
vi.mock('@/features/residents/components/AdmissionFormDialog', () => ({
  AdmissionFormDialog: (props: { open: boolean; admission: { id: string } | null }) => {
    admissionDialog(props);
    return props.open ? <div data-testid="admission-dialog">{props.admission?.id ?? 'novo'}</div> : null;
  },
}));

import { StaffHistoryTab } from './StaffHistoryTab';

const servicePeriod = (id: string, startDate: string, endDate: string | null) => ({
  id,
  staffId: 's1',
  houseId: 'h1',
  house: { id: 'h1', name: 'Casa Belém' },
  startDate,
  endDate,
});

beforeEach(() => {
  vi.clearAllMocks();
  periods.data = [];
  periods.isLoading = false;
  admissions.data = [];
  admissions.isLoading = false;
  auth.role = 'ADMIN';
});
afterEach(() => cleanup());

describe('StaffHistoryTab', () => {
  it('loading mostra carregamento', () => {
    periods.isLoading = true;
    const { container } = render(<StaffHistoryTab staffId="s1" />);
    expect(container.textContent).toBeTruthy();
    expect(screen.queryByTestId('service-period-card')).toBeNull();
  });

  it('vazio mostra o estado vazio', () => {
    render(<StaffHistoryTab staffId="s1" />);
    expect(screen.getByText('Nenhum registro no histórico.')).toBeInTheDocument();
  });

  it('servo direto: só períodos, sem buscar acolhimentos; aberto mostra "Em andamento"', () => {
    periods.data = [servicePeriod('p1', '2025-03-01', null)];
    render(<StaffHistoryTab staffId="s1" />);
    expect(admissionsArgs).toHaveBeenCalledWith('', { enabled: false });
    expect(screen.getAllByTestId('service-period-card')).toHaveLength(1);
    expect(screen.queryByTestId('admission-card')).toBeNull();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar acolhimento/ })).toBeNull();
  });

  it('ex-filho: ordena acolhimentos e períodos juntos por início desc', () => {
    periods.data = [servicePeriod('p1', '2025-03-01', null)];
    admissions.data = [
      { id: 'a1', status: ResidentStatus.DISCHARGED, house: { name: 'Casa Nazaré' }, entryDate: '2024-01-10', exitDate: '2025-03-01' },
    ];
    render(<StaffHistoryTab staffId="s1" formerResidentId="r1" />);
    expect(admissionsArgs).toHaveBeenCalledWith('r1', { enabled: true });
    const titles = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(titles).toEqual(['Período de serviço', 'Acolhimento 1']);
  });

  it('ADMIN abre o dialog de novo período e de edição; fechar mantém o período', () => {
    periods.data = [servicePeriod('p1', '2025-03-01', null)];
    render(<StaffHistoryTab staffId="s1" />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar período de serviço/ }));
    expect(screen.getByTestId('service-dialog')).toHaveTextContent('novo');

    fireEvent.click(screen.getByRole('button', { name: 'Editar período de serviço' }));
    expect(screen.getByTestId('service-dialog')).toHaveTextContent('p1');
    const last = serviceDialog.mock.calls.at(-1)![0] as { onClose: () => void };
    act(() => last.onClose());
    const after = serviceDialog.mock.calls.at(-1)![0] as { open: boolean; period: { id: string } };
    expect(after.open).toBe(false);
    expect(after.period.id).toBe('p1');
  });

  it('ADMIN de ex-filho também adiciona e edita acolhimento', () => {
    admissions.data = [
      { id: 'a1', status: ResidentStatus.DISCHARGED, house: { name: 'Casa Nazaré' }, entryDate: '2024-01-10', exitDate: '2025-03-01' },
    ];
    render(<StaffHistoryTab staffId="s1" formerResidentId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar acolhimento/ }));
    expect(screen.getByTestId('admission-dialog')).toHaveTextContent('novo');
    fireEvent.click(screen.getByRole('button', { name: 'Editar acolhimento' }));
    expect(screen.getByTestId('admission-dialog')).toHaveTextContent('a1');
    const last = admissionDialog.mock.calls.at(-1)![0] as { onClose: () => void };
    act(() => last.onClose());
    expect((admissionDialog.mock.calls.at(-1)![0] as { open: boolean }).open).toBe(false);
  });

  it.each(['COORDINATOR', 'SERVANT'])('%s não vê botões nem dialogs', (role) => {
    auth.role = role;
    periods.data = [servicePeriod('p1', '2025-03-01', null)];
    admissions.data = [
      { id: 'a1', status: ResidentStatus.DISCHARGED, house: { name: 'Casa Nazaré' }, entryDate: '2024-01-10', exitDate: '2025-03-01' },
    ];
    render(<StaffHistoryTab staffId="s1" formerResidentId="r1" />);
    expect(screen.queryByRole('button', { name: /Adicionar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(serviceDialog).not.toHaveBeenCalled();
    expect(admissionDialog).not.toHaveBeenCalled();
  });
});
