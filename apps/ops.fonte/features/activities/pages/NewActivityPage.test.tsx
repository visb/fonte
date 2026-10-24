import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockReplace = jest.fn();
const mockSubmit = jest.fn();
let mockParams: Record<string, string | undefined> = {};
let mockRole = 'SERVANT';
const mockMutation = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null };

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    staff: { houseId: 'h1', house: { name: 'Casa Teste' }, user: { role: mockRole } },
  }),
}));
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => true }));
jest.mock('@/features/staff/hooks/useHouseStaff', () => ({
  useHouseStaff: () => ({
    data: [
      { id: 's1', name: 'Ana' },
      { id: 's2', name: 'Bruno' },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/features/activities/hooks/useActivities', () => ({
  useCreateActivity: () => ({ isPending: false }),
  useUpdateActivity: () => mockMutation,
  useChangeActivityStatus: () => mockMutation,
}));
jest.mock('@/lib/offline/fieldSubmit', () => ({
  useFieldSubmit: () => mockSubmit,
}));

import { NewActivityPage } from './NewActivityPage';

type Callbacks = {
  onSent: () => void;
  onQueued: () => void;
  onFailed: (error?: unknown) => void;
};

function typeTitle() {
  fireEvent.changeText(screen.getByPlaceholderText('Ex: Consertar o portão'), 'Trocar lâmpada');
}

async function submitted(): Promise<{ input: Record<string, unknown>; cb: Callbacks }> {
  await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
  return { input: mockSubmit.mock.calls[0][0], cb: mockSubmit.mock.calls[0][1] };
}

function pickResponsible(name: string) {
  fireEvent.press(screen.getByLabelText('Escolher responsável'));
  fireEvent.press(screen.getByLabelText(`Responsável ${name}`));
}

const tab = (status: string) => ({ pathname: '/(app)/activities', params: { tab: status } });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockRole = 'SERVANT';
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('NewActivityPage — servo (stories 220/224)', () => {
  it('sem seletor de coluna; envia DRAFT sem responsável', async () => {
    render(<NewActivityPage />);
    expect(screen.queryByText('Coluna')).toBeNull();
    typeTitle();
    fireEvent.press(screen.getByText('Criar rascunho'));
    const { input } = await submitted();
    expect(input).toEqual({
      title: 'Trocar lâmpada',
      description: null,
      houseId: 'h1',
      status: 'DRAFT',
    });
  });

  it('com responsável escolhido envia DRAFT + responsibleStaffId', async () => {
    render(<NewActivityPage />);
    typeTitle();
    pickResponsible('Bruno');
    expect(screen.getByText('Bruno')).toBeTruthy();
    fireEvent.press(screen.getByText('Criar rascunho'));
    const { input } = await submitted();
    expect(input).toMatchObject({ status: 'DRAFT', responsibleStaffId: 's2' });
  });

  it('?status=TODO não vale para o servo: cai em DRAFT', async () => {
    mockParams = { status: 'TODO' };
    render(<NewActivityPage />);
    expect(screen.getByText('Criar rascunho')).toBeTruthy();
  });

  it('onSent vai para Rascunhos e avisa', async () => {
    render(<NewActivityPage />);
    typeTitle();
    fireEvent.press(screen.getByText('Criar rascunho'));
    const { cb } = await submitted();
    cb.onSent();
    expect(mockReplace).toHaveBeenCalledWith(tab('DRAFT'));
    expect(Alert.alert).toHaveBeenCalledWith('Sucesso', 'Rascunho criado.');
  });

  it('onQueued também vai para Rascunhos e avisa que está no aparelho', async () => {
    render(<NewActivityPage />);
    typeTitle();
    fireEvent.press(screen.getByText('Criar rascunho'));
    const { cb } = await submitted();
    cb.onQueued();
    expect(mockReplace).toHaveBeenCalledWith(tab('DRAFT'));
    expect(Alert.alert).toHaveBeenCalledWith('Salvo no aparelho', expect.any(String));
  });

  it('onFailed não navega e mostra o erro da API (getErrorMessage)', async () => {
    render(<NewActivityPage />);
    typeTitle();
    fireEvent.press(screen.getByText('Criar rascunho'));
    const { cb } = await submitted();
    cb.onFailed({ response: { data: { message: 'Responsible staff is not active' } } });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Responsible staff is not active');
    cb.onFailed();
    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Não foi possível criar a atividade.');
  });

  it('título vazio não envia', async () => {
    render(<NewActivityPage />);
    fireEvent.press(screen.getByText('Criar rascunho'));
    await waitFor(() => expect(screen.getByText('Informe o título')).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe('NewActivityPage — coordenador (story 224)', () => {
  beforeEach(() => {
    mockRole = 'COORDINATOR';
  });

  it('seletor com default vindo de ?status=REQUESTED; cria e vai para Solicitações', async () => {
    mockParams = { status: 'REQUESTED' };
    render(<NewActivityPage />);
    expect(screen.getByLabelText('Criar em Solicitação')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    typeTitle();
    fireEvent.press(screen.getByText('Criar solicitação'));
    const { input, cb } = await submitted();
    expect(input).toMatchObject({ status: 'REQUESTED' });
    cb.onSent();
    expect(mockReplace).toHaveBeenCalledWith(tab('REQUESTED'));
    expect(Alert.alert).toHaveBeenCalledWith('Sucesso', 'Solicitação criada.');
  });

  it('?status= inválido cai em DRAFT', () => {
    mockParams = { status: 'DONE' };
    render(<NewActivityPage />);
    expect(screen.getByText('Criar rascunho')).toBeTruthy();
  });

  it('TODO sem responsável → erro de validação e nada enviado', async () => {
    render(<NewActivityPage />);
    fireEvent.press(screen.getByLabelText('Criar em A fazer'));
    typeTitle();
    fireEvent.press(screen.getByText('Criar atividade'));
    await waitFor(() => expect(screen.getByText('Escolha o responsável')).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('TODO com responsável envia e onQueued vai para A fazer', async () => {
    mockParams = { status: 'TODO' };
    render(<NewActivityPage />);
    typeTitle();
    pickResponsible('Ana');
    // Obrigatório em A fazer: sem "limpar".
    expect(screen.queryByLabelText('Limpar responsável')).toBeNull();
    fireEvent.press(screen.getByText('Criar atividade'));
    const { input, cb } = await submitted();
    expect(input).toMatchObject({ status: 'TODO', responsibleStaffId: 's1' });
    cb.onQueued();
    expect(mockReplace).toHaveBeenCalledWith(tab('TODO'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Salvo no aparelho',
      expect.stringContaining('a atividade será enviada'),
    );
  });
});
