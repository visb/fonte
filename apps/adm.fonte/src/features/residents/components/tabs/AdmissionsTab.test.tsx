import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResidentStatus } from '@fonte/types';

const state = { data: [] as unknown[], isLoading: false };
const auth = { role: 'ADMIN' as string | null };
const dialogProps = vi.fn();

vi.mock('../../hooks/useResidents', () => ({ useResidentAdmissions: () => state }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../AdmissionFormDialog', () => ({
  AdmissionFormDialog: (props: { open: boolean; admission: { id: string } | null }) => {
    dialogProps(props);
    return props.open ? <div data-testid="admission-dialog">{props.admission?.id ?? 'novo'}</div> : null;
  },
}));

import { AdmissionsTab } from './AdmissionsTab';

beforeEach(() => {
  vi.clearAllMocks();
  state.data = [];
  state.isLoading = false;
  auth.role = 'ADMIN';
});
afterEach(() => cleanup());

const twoAdmissions = () => [
  { id: 'ad2', status: ResidentStatus.ACTIVE, house: { name: 'Casa Belém' }, entryDate: '2026-01-01', exitDate: null, weight: 80, height: 175 },
  { id: 'ad1', status: ResidentStatus.DISCHARGED, house: { name: 'Casa Nazaré' }, entryDate: '2024-01-01', exitDate: '2024-06-01' },
];

describe('AdmissionsTab', () => {
  it('loading mostra carregamento', () => {
    state.isLoading = true;
    const { container } = render(<AdmissionsTab residentId="r1" />);
    expect(container.textContent).toBeTruthy();
  });

  it('vazio mostra mensagem de nenhum acolhimento', () => {
    render(<AdmissionsTab residentId="r1" />);
    expect(screen.getByText('Nenhum acolhimento registrado.')).toBeInTheDocument();
  });

  it('lista acolhimentos numerados em ordem decrescente com casa, datas e status', () => {
    state.data = twoAdmissions();
    render(<AdmissionsTab residentId="r1" />);
    expect(screen.getByText('Acolhimento 2')).toBeInTheDocument();
    expect(screen.getByText('Acolhimento 1')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    expect(screen.getByText('175 cm')).toBeInTheDocument();
  });

  // Story 164: a ordem vem do backend por entry_date DESC. Numerar pelo índice só
  // fica certo se o mais RECENTE for o primeiro card e receber o maior número.
  it('"Acolhimento 2" é o mais recente e "Acolhimento 1" o mais antigo', () => {
    state.data = [
      { id: 'ad-atual', status: ResidentStatus.ACTIVE, house: { name: 'Casa Belém' }, entryDate: '2026-07-17', exitDate: null },
      { id: 'ad-antigo', status: ResidentStatus.EVADED, house: { name: 'Casa Nazaré' }, entryDate: '2025-08-01', exitDate: '2025-02-10' },
    ];
    render(<AdmissionsTab residentId="r1" />);

    const titulos = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Acolhimento 2', 'Acolhimento 1']);

    const cards = screen.getAllByTestId('admission-card');
    expect(cards[0].textContent).toContain('17/07/2026');
    expect(cards[1].textContent).toContain('01/08/2025');
  });

  // Story 215 — só ADMIN cria e edita passagens.
  it('ADMIN vê "Adicionar acolhimento" e editar em cada card', () => {
    state.data = twoAdmissions();
    render(<AdmissionsTab residentId="r1" />);
    expect(screen.getByRole('button', { name: /Adicionar acolhimento/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Editar acolhimento' })).toHaveLength(2);
  });

  it.each(['COORDINATOR', 'SERVANT'])('%s não vê os botões nem o dialog', (role) => {
    auth.role = role;
    state.data = twoAdmissions();
    render(<AdmissionsTab residentId="r1" />);
    expect(screen.queryByRole('button', { name: /Adicionar acolhimento/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar acolhimento' })).toBeNull();
    expect(dialogProps).not.toHaveBeenCalled();
  });

  it('ADMIN com histórico vazio ainda pode adicionar', () => {
    render(<AdmissionsTab residentId="r1" />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar acolhimento/ }));
    expect(screen.getByTestId('admission-dialog')).toHaveTextContent('novo');
  });

  it('editar abre o dialog com a passagem do card; fechar mantém a passagem', () => {
    state.data = twoAdmissions();
    render(<AdmissionsTab residentId="r1" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar acolhimento' })[1]);
    expect(screen.getByTestId('admission-dialog')).toHaveTextContent('ad1');

    const last = dialogProps.mock.calls.at(-1)![0] as { onClose: () => void };
    act(() => last.onClose());
    const after = dialogProps.mock.calls.at(-1)![0] as { open: boolean; admission: { id: string } };
    expect(after.open).toBe(false);
    expect(after.admission.id).toBe('ad1');
  });
});
