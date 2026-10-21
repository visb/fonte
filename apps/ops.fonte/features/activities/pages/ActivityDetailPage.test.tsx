import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

const mockUseActivity = jest.fn();
const mockUpdateMutate = jest.fn();
const mockUpload = jest.fn();
const mockDelete = jest.fn();
let mockRole = 'COORDINATOR';
let mockOnline = true;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ children }: { children: string }) => <Text>{children}</Text> };
});
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'a1' }) }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { houseId: 'h1', userId: 'u1', user: { role: mockRole } } }),
}));
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => mockOnline }));
jest.mock('@/features/activities/hooks/useActivities', () => ({
  useActivity: (...a: unknown[]) => mockUseActivity(...a),
  useUpdateActivity: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useUploadActivityAttachment: () => ({ mutate: mockUpload, isPending: false, error: null }),
  useDeleteAttachment: () => ({ mutate: mockDelete, isPending: false }),
}));
jest.mock('@/features/activities/components/ActivityAttachments', () => {
  const { Text } = require('react-native');
  return {
    ActivityAttachments: ({ onUpload, onDelete }: { onUpload: (a: unknown) => void; onDelete: (id: string) => void }) => (
      <>
        <Text onPress={() => onUpload({ uri: 'x' })}>anexar</Text>
        <Text onPress={() => onDelete('att-1')}>apagar-anexo</Text>
      </>
    ),
  };
});
jest.mock('@/features/activities/components/ActivityComments', () => {
  const { Text } = require('react-native');
  return { ActivityComments: () => <Text>comentarios</Text> };
});
jest.mock('@/features/activities/components/ActivityHistory', () => {
  const { Text } = require('react-native');
  return {
    ActivityHistory: ({ activityId, houseId }: { activityId: string; houseId: string }) => (
      <Text>{`historico:${activityId}:${houseId}`}</Text>
    ),
  };
});
jest.mock('@/features/activities/components/SelectResponsibleModal', () => {
  const { Text } = require('react-native');
  return {
    SelectResponsibleModal: ({ target }: { target: { mode: string; activity: { id: string } } | null }) =>
      target ? <Text>{`modal:${target.mode}:${target.activity.id}`}</Text> : null,
  };
});

import { ActivityDetailPage } from './ActivityDetailPage';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    title: 'Consertar portão',
    description: 'texto',
    status: ActivityStatus.TODO,
    houseId: 'h1',
    house: { id: 'h1', name: 'Casa Teste' },
    responsibleStaffId: 's1',
    responsible: { id: 's1', name: 'Ana', userId: 'u-s1' },
    createdByUserId: 'u9',
    createdBy: { id: 'st9', name: 'Criador', userId: 'u9' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    attachments: [],
    ...overrides,
  };
}

function query(over: Record<string, unknown>) {
  mockUseActivity.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: jest.fn(), ...over });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'COORDINATOR';
  mockOnline = true;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('ActivityDetailPage (story 220)', () => {
  it('loading e erro usam os componentes de estado', () => {
    query({ isLoading: true });
    const { rerender } = render(<ActivityDetailPage />);
    expect(screen.queryByText('Consertar portão')).toBeNull();

    const refetch = jest.fn();
    query({ error: new Error('x'), refetch });
    rerender(<ActivityDetailPage />);
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('mostra as informações da atividade', () => {
    query({ data: makeActivity() });
    render(<ActivityDetailPage />);
    expect(mockUseActivity).toHaveBeenCalledWith('a1');
    expect(screen.getByText('Consertar portão')).toBeTruthy();
    expect(screen.getByText('Casa Teste')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Criador')).toBeTruthy();
  });

  it('coordenador da casa vê "Alterar" e abre o seletor em modo trocar', () => {
    query({ data: makeActivity() });
    render(<ActivityDetailPage />);
    fireEvent.press(screen.getByLabelText('Alterar responsável'));
    expect(screen.getByText('modal:change:a1')).toBeTruthy();
  });

  it('servo não vê "Alterar"', () => {
    mockRole = 'SERVANT';
    query({ data: makeActivity() });
    render(<ActivityDetailPage />);
    expect(screen.queryByLabelText('Alterar responsável')).toBeNull();
  });

  it('em Concluída não há "Alterar"', () => {
    query({ data: makeActivity({ status: ActivityStatus.DONE }) });
    render(<ActivityDetailPage />);
    expect(screen.queryByLabelText('Alterar responsável')).toBeNull();
  });

  it('offline: "Alterar" desabilitado com o aviso', () => {
    mockOnline = false;
    query({ data: makeActivity() });
    render(<ActivityDetailPage />);
    fireEvent.press(screen.getByLabelText('Alterar responsável'));
    expect(screen.queryByText(/modal:/)).toBeNull();
    expect(screen.getByText('Precisa de conexão para trocar o responsável.')).toBeTruthy();
  });

  it('sem responsável e sem casa mostra os fallbacks', () => {
    mockRole = 'SERVANT';
    query({ data: makeActivity({ responsible: null, house: null, createdBy: null, createdAt: 'x' }) });
    render(<ActivityDetailPage />);
    expect(screen.getByText('Não atribuído')).toBeTruthy();
    expect(screen.getByText('Geral (sem casa)')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('x')).toBeTruthy();
  });

  it('aba Histórico renderiza a trilha da atividade', () => {
    query({ data: makeActivity() });
    render(<ActivityDetailPage />);
    expect(screen.getByText('comentarios')).toBeTruthy();
    fireEvent.press(screen.getByText('Histórico'));
    expect(screen.getByText('historico:a1:h1')).toBeTruthy();
    expect(screen.queryByText('Histórico em breve.')).toBeNull();
    fireEvent.press(screen.getByText('Comentários'));
    expect(screen.getByText('comentarios')).toBeTruthy();
  });

  it('anexos repassam upload e exclusão', () => {
    query({ data: makeActivity() });
    render(<ActivityDetailPage />);
    fireEvent.press(screen.getByText('anexar'));
    expect(mockUpload).toHaveBeenCalledWith({ uri: 'x' });
    fireEvent.press(screen.getByText('apagar-anexo'));
    expect(mockDelete).toHaveBeenCalledWith('att-1');
  });

  it('descrição só leitura para quem não pode editar', () => {
    mockRole = 'SERVANT';
    query({ data: makeActivity() });
    render(<ActivityDetailPage />);
    expect(screen.getByText('texto')).toBeTruthy();
    expect(screen.queryByText('Salvar descrição')).toBeNull();
  });

  it('criador edita a descrição e salva (sucesso e erro)', async () => {
    mockRole = 'SERVANT';
    query({ data: makeActivity({ createdByUserId: 'u1' }) });
    render(<ActivityDetailPage />);
    fireEvent.changeText(screen.getByPlaceholderText('Detalhe a atividade...'), '');
    fireEvent.press(screen.getByText('Salvar descrição'));
    await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
    const [vars, opts] = mockUpdateMutate.mock.calls[0];
    expect(vars).toEqual({ id: 'a1', data: { description: null } });
    opts.onSuccess();
    expect(Alert.alert).toHaveBeenCalledWith('Sucesso', 'Descrição atualizada.');
    opts.onError({ response: { data: { message: 'falhou' } } });
    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'falhou');
  });
});
