import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

const mockUseHouseStaff = jest.fn();
const mockUpdate = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null as unknown };
const mockChange = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null as unknown };
let mockOnline = true;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => mockOnline }));
jest.mock('@/features/staff/hooks/useHouseStaff', () => ({
  useHouseStaff: (...a: unknown[]) => mockUseHouseStaff(...a),
}));
jest.mock('@/features/activities/hooks/useActivities', () => ({
  useUpdateActivity: () => mockUpdate,
  useChangeActivityStatus: () => mockChange,
}));

import { SelectResponsibleModal } from './SelectResponsibleModal';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    title: 'Varrer',
    description: null,
    status: ActivityStatus.TODO,
    houseId: 'h1',
    house: null,
    responsibleStaffId: 's1',
    responsible: { id: 's1', name: 'Ana', userId: 'u1' },
    createdByUserId: 'u9',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const staff = [
  { id: 's1', name: 'Ana' },
  { id: 's2', name: 'Bruno' },
];

function staffQuery(over: Record<string, unknown> = {}) {
  mockUseHouseStaff.mockReturnValue({
    data: staff,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...over,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  mockUpdate.error = null;
  mockChange.error = null;
  mockUpdate.isPending = false;
  staffQuery();
});

describe('SelectResponsibleModal (story 220)', () => {
  it('fechado (sem alvo) não mostra nada', () => {
    render(<SelectResponsibleModal target={null} onClose={jest.fn()} />);
    expect(screen.queryByTestId('select-responsible-modal')).toBeNull();
  });

  it('lista os servos da casa da atividade e marca o atual', () => {
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={jest.fn()} />);
    expect(mockUseHouseStaff).toHaveBeenCalledWith('h1');
    expect(screen.getByText('Selecionar responsável')).toBeTruthy();
    expect(screen.getByLabelText('Responsável Ana')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByLabelText('Responsável Bruno')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: false }),
    );
    expect(screen.queryByText(/Sem responsável/)).toBeNull();
  });

  it('modo trocar: selecionar outro chama update com responsibleStaffId e fecha no sucesso', () => {
    const onClose = jest.fn();
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Responsável Bruno'));
    expect(mockUpdate.mutate).toHaveBeenCalledWith(
      { id: 'a1', data: { responsibleStaffId: 's2' } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    mockUpdate.mutate.mock.calls[0][1].onSuccess();
    expect(onClose).toHaveBeenCalled();
    expect(mockChange.mutate).not.toHaveBeenCalled();
  });

  it('modo trocar: escolher o atual só fecha', () => {
    const onClose = jest.fn();
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Responsável Ana'));
    expect(mockUpdate.mutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('modo aprovar: selecionar chama changeStatus com TODO + responsável', () => {
    const activity = makeActivity({
      status: ActivityStatus.REQUESTED,
      responsibleStaffId: null,
      responsible: null,
    });
    render(<SelectResponsibleModal target={{ activity, mode: 'approve' }} onClose={jest.fn()} />);
    expect(screen.getByText('Aprovar solicitação')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Responsável Bruno'));
    expect(mockChange.mutate).toHaveBeenCalledWith(
      { id: 'a1', data: { status: ActivityStatus.TODO, responsibleStaffId: 's2' } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockUpdate.mutate).not.toHaveBeenCalled();
  });

  it('erro de API aparece via getErrorMessage', () => {
    mockUpdate.error = { response: { data: { message: 'Responsible staff must belong to the activity house' } } };
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={jest.fn()} />);
    expect(screen.getByText('Responsible staff must belong to the activity house')).toBeTruthy();
  });

  it('erro sem mensagem cai no fallback do modo', () => {
    mockChange.error = {};
    render(
      <SelectResponsibleModal
        target={{ activity: makeActivity({ status: ActivityStatus.REQUESTED }), mode: 'approve' }}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Não foi possível aprovar a solicitação.')).toBeTruthy();
  });

  it('offline: aviso e lista desabilitada', () => {
    mockOnline = false;
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={jest.fn()} />);
    expect(screen.getByText('Precisa de conexão para trocar o responsável.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Responsável Bruno'));
    expect(mockUpdate.mutate).not.toHaveBeenCalled();
  });

  it('loading da lista usa LoadingState', () => {
    staffQuery({ data: undefined, isLoading: true });
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Responsável Ana')).toBeNull();
  });

  it('erro da lista usa ErrorState com tentar de novo', () => {
    const refetch = jest.fn();
    staffQuery({ data: undefined, error: new Error('x'), refetch });
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={jest.fn()} />);
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('casa sem servos usa EmptyState', () => {
    staffQuery({ data: [] });
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={jest.fn()} />);
    expect(screen.getByText('Nenhum servo na casa.')).toBeTruthy();
  });

  it('fechar limpa os erros das mutations e chama onClose', () => {
    const onClose = jest.fn();
    render(<SelectResponsibleModal target={{ activity: makeActivity(), mode: 'change' }} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Fechar'));
    expect(mockUpdate.reset).toHaveBeenCalled();
    expect(mockChange.reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
