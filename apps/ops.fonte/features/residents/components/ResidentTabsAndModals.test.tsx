import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FollowUpType, IncidentCategory, IncidentType } from '@fonte/types';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Hooks de dados mockados (caminhos isolados de loading/empty/error/lista).
const mockUseResidentRelatives = jest.fn();
const mockUseResidentFollowUps = jest.fn();
const mockCreateFollowUpMutate = jest.fn();
const mockUseCreateFollowUp = jest.fn(() => ({ mutate: mockCreateFollowUpMutate, isPending: false }));
const mockResetMutate = jest.fn();
const mockUseResetResidentPassword = jest.fn(() => ({ mutate: mockResetMutate, isPending: false }));

jest.mock('../hooks/useResidents', () => ({
  useResidentRelatives: (...a: unknown[]) => mockUseResidentRelatives(...a),
  useResetResidentPassword: (...a: unknown[]) => mockUseResetResidentPassword(...a),
}));
const mockUseResidentIncidents = jest.fn();
jest.mock('@/features/incidents/hooks/useIncidents', () => ({
  useResidentIncidents: (...a: unknown[]) => mockUseResidentIncidents(...a),
}));
jest.mock('../hooks/useResidentFollowUps', () => ({
  useResidentFollowUps: (...a: unknown[]) => mockUseResidentFollowUps(...a),
  useCreateFollowUp: (...a: unknown[]) => mockUseCreateFollowUp(...a),
}));

import { ResidentFamiliesTab } from './ResidentFamiliesTab';
import { ResidentTrackingTab } from './ResidentTrackingTab';
import { AddFollowUpModal } from './AddFollowUpModal';
import { ResetResidentPasswordModal } from './ResetResidentPasswordModal';
import { RelativeCard } from './RelativeCard';
import { ResidentDetailHeader } from './ResidentDetailHeader';
import { ResidentOverviewTab } from './ResidentOverviewTab';
import { Linking } from 'react-native';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseCreateFollowUp.mockReturnValue({ mutate: mockCreateFollowUpMutate, isPending: false });
  mockUseResetResidentPassword.mockReturnValue({ mutate: mockResetMutate, isPending: false });
  mockUseResidentIncidents.mockReturnValue({ data: [], isLoading: false, isError: false });
});

describe('ResidentFamiliesTab', () => {
  it('loading mostra indicador', () => {
    mockUseResidentRelatives.mockReturnValue({ data: undefined, isLoading: true });
    render(<ResidentFamiliesTab residentId="r1" />);
    // ActivityIndicator não tem texto; garante que não renderizou vazio/lista
    expect(screen.queryByText('Nenhum familiar cadastrado.')).toBeNull();
  });

  it('vazio mostra mensagem', () => {
    mockUseResidentRelatives.mockReturnValue({ data: [], isLoading: false });
    render(<ResidentFamiliesTab residentId="r1" />);
    expect(screen.getByText('Nenhum familiar cadastrado.')).toBeTruthy();
  });

  it('lista familiares', () => {
    mockUseResidentRelatives.mockReturnValue({
      data: [{ id: 'rel1', name: 'Maria', relationship: 'Mãe', phone: '+5511999' }],
      isLoading: false,
    });
    render(<ResidentFamiliesTab residentId="r1" />);
    expect(screen.getByText('Maria')).toBeTruthy();
  });
});

describe('RelativeCard', () => {
  it('mostra nome, parentesco e telefone clicável (tel:)', () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    render(<RelativeCard relative={{ id: 'rel1', name: 'Maria', relationship: 'Mãe', phone: '+5511999' } as never} />);
    expect(screen.getByText('Maria')).toBeTruthy();
    expect(screen.getByText('Mãe')).toBeTruthy();
    fireEvent.press(screen.getByText('+5511999'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+5511999');
  });

  it('sem parentesco/telefone não renderiza esses blocos', () => {
    render(<RelativeCard relative={{ id: 'rel1', name: 'Maria' } as never} />);
    expect(screen.getByText('Maria')).toBeTruthy();
    expect(screen.queryByText('icon:call-outline')).toBeNull();
  });
});

describe('ResidentTrackingTab', () => {
  it('loading não mostra empty/lista', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.queryByText('Nenhum evento registrado.')).toBeNull();
  });

  it('erro mostra ErrorState', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.getByText('Erro ao carregar acompanhamento.')).toBeTruthy();
  });

  it('vazio mostra EmptyState', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.getByText('Nenhum evento registrado.')).toBeTruthy();
  });

  it('lista eventos de acompanhamento', () => {
    mockUseResidentFollowUps.mockReturnValue({
      data: [{ id: 'f1', type: FollowUpType.NOTE, date: '2026-03-10', description: 'X', createdByName: null }],
      isLoading: false,
      isError: false,
    });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.getByText('Observação')).toBeTruthy();
  });

  // Story 228: ocorrências do filho entram na mesma linha do tempo.
  const followUp = {
    id: 'f1',
    type: FollowUpType.NOTE,
    date: '2026-03-10',
    description: 'Nota antiga',
    createdByName: null,
    createdAt: '2026-03-10T10:00:00Z',
  };
  const incident = {
    id: 'i1',
    date: '2026-03-12',
    type: IncidentType.NEGATIVE,
    category: IncidentCategory.AGGRESSION,
    description: 'Briga no refeitório',
    houseId: 'h1',
    responsible: { id: 's1', name: 'Servo' },
    residents: [{ id: 'r1', name: 'João' }],
  };

  it('busca as ocorrências do próprio filho', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(mockUseResidentIncidents).toHaveBeenCalledWith('r1');
  });

  it('mescla follow-ups e ocorrências por data desc', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: [followUp], isLoading: false, isError: false });
    mockUseResidentIncidents.mockReturnValue({ data: [incident], isLoading: false, isError: false });
    render(<ResidentTrackingTab residentId="r1" />);
    const texts = screen.getAllByText(/Briga no refeitório|Nota antiga/).map((n) => n.props.children);
    expect(texts).toEqual(['Briga no refeitório', 'Nota antiga']);
    expect(screen.getByText('Ocorrência')).toBeTruthy();
  });

  it('só ocorrências (sem follow-up) não mostra o vazio', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockUseResidentIncidents.mockReturnValue({ data: [incident], isLoading: false, isError: false });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.queryByText('Nenhum evento registrado.')).toBeNull();
    expect(screen.getByText('Briga no refeitório')).toBeTruthy();
  });

  it('erro só nas ocorrências mantém os follow-ups e mostra aviso', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: [followUp], isLoading: false, isError: false });
    mockUseResidentIncidents.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.getByText('Nota antiga')).toBeTruthy();
    expect(screen.getByText('Não foi possível carregar as ocorrências')).toBeTruthy();
    expect(screen.queryByText('Erro ao carregar acompanhamento.')).toBeNull();
  });

  it('"Registrar" abre o modal de follow-up e "Cancelar" fecha', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.queryByPlaceholderText('Detalhes do evento...')).toBeNull();
    fireEvent.press(screen.getByText('Registrar'));
    expect(screen.getByPlaceholderText('Detalhes do evento...')).toBeTruthy();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByPlaceholderText('Detalhes do evento...')).toBeNull();
  });

  it('ocorrências carregando mostram o indicador', () => {
    mockUseResidentFollowUps.mockReturnValue({ data: [followUp], isLoading: false, isError: false });
    mockUseResidentIncidents.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<ResidentTrackingTab residentId="r1" />);
    expect(screen.queryByText('Nota antiga')).toBeNull();
  });
});

describe('AddFollowUpModal', () => {
  const props = { visible: true, onClose: jest.fn(), residentId: 'r1' };

  it('submete com data, tipo e descrição (trim → undefined quando vazia)', () => {
    render(<AddFollowUpModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Detalhes do evento...'), '  ');
    fireEvent.press(screen.getByText('Salvar'));
    expect(mockCreateFollowUpMutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: FollowUpType.NOTE, description: undefined }),
      expect.any(Object),
    );
  });

  it('submete a descrição preenchida', () => {
    render(<AddFollowUpModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Detalhes do evento...'), 'Conversa importante');
    fireEvent.press(screen.getByText('Salvar'));
    expect(mockCreateFollowUpMutate).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Conversa importante' }),
      expect.any(Object),
    );
  });

  it('seleciona outro tipo pelo picker', () => {
    render(<AddFollowUpModal {...props} />);
    fireEvent.press(screen.getByText('Observação')); // abre picker (label do tipo atual)
    fireEvent.press(screen.getByText('Alta'));
    fireEvent.press(screen.getByText('Salvar'));
    expect(mockCreateFollowUpMutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: FollowUpType.DISCHARGE }),
      expect.any(Object),
    );
  });

  it('pending desabilita e mostra indicador', () => {
    mockUseCreateFollowUp.mockReturnValue({ mutate: mockCreateFollowUpMutate, isPending: true });
    render(<AddFollowUpModal {...props} />);
    expect(screen.queryByText('Salvar')).toBeNull();
  });
});

describe('ResetResidentPasswordModal', () => {
  const props = { visible: true, onClose: jest.fn(), residentId: 'r1', residentName: 'João' };

  it('mostra senha mascarada e alterna visibilidade', () => {
    render(<ResetResidentPasswordModal {...props} />);
    expect(screen.getByText('João')).toBeTruthy();
    // senha mascarada por bullets
    expect(screen.getByText(/•/)).toBeTruthy();
    fireEvent.press(screen.getByText('icon:eye-outline'));
    expect(screen.getByText('icon:eye-off-outline')).toBeTruthy();
  });

  it('confirmar muta a senha gerada (12 chars)', () => {
    render(<ResetResidentPasswordModal {...props} />);
    fireEvent.press(screen.getByText('Confirmar'));
    expect(mockResetMutate).toHaveBeenCalledTimes(1);
    const [pwd] = mockResetMutate.mock.calls[0];
    expect(typeof pwd).toBe('string');
    expect(pwd).toHaveLength(12);
  });

  it('pending mostra Salvando...', () => {
    mockUseResetResidentPassword.mockReturnValue({ mutate: mockResetMutate, isPending: true });
    render(<ResetResidentPasswordModal {...props} />);
    expect(screen.getByText('Salvando...')).toBeTruthy();
  });
});

describe('ResidentDetailHeader', () => {
  it('mostra nome, nascimento e tempo de acolhimento', () => {
    render(
      <ResidentDetailHeader
        name="João Silva"
        birthDate="1990-05-10"
        entryDate="2025-01-01"
        photoUrl={null}
        photoThumbUrl={null}
      />,
    );
    expect(screen.getByText('João Silva')).toBeTruthy();
    expect(screen.getByText(/Nasc\. 10\/05\/1990/)).toBeTruthy();
  });

  it('voltar dispara router.back', () => {
    render(<ResidentDetailHeader name="João" birthDate={null} entryDate={null} />);
    fireEvent.press(screen.getByText('icon:arrow-back'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('ResidentOverviewTab', () => {
  function makeResident(overrides = {}) {
    return {
      id: 'r1',
      name: 'João',
      cpf: '111.222.333-44',
      birthDate: '1990-05-10',
      gender: 'MALE',
      entryDate: '2025-01-01',
      contactPhone: '+5511999',
      healthIssues: null,
      continuousMedication: null,
      house: { name: 'Casa Bethel' },
      houseId: 'h1',
      status: 'ACTIVE',
      ministry: null,
      userId: 'user-1',
      ...overrides,
    } as never;
  }

  function renderTab(overrides = {}, handlers: Record<string, jest.Mock> = {}) {
    return render(
      <ResidentOverviewTab
        resident={makeResident(overrides)}
        onChangeMinistry={handlers.onChangeMinistry ?? jest.fn()}
        onResetPassword={handlers.onResetPassword ?? jest.fn()}
        onDeclareProducts={jest.fn()}
      />,
    );
  }

  it('mostra identificação e botão de resetar senha quando há acesso', () => {
    const onResetPassword = jest.fn();
    renderTab({}, { onResetPassword });
    expect(screen.getByText('Masculino')).toBeTruthy();
    fireEvent.press(screen.getByText('Resetar senha'));
    expect(onResetPassword).toHaveBeenCalled();
  });

  // Story 205: a seção "Ministério" volta com o botão de troca.
  it('mostra o ministério atual e "Alterar" para filho em acolhimento', () => {
    const onChangeMinistry = jest.fn();
    renderTab({ ministry: { id: 'm1', name: 'Cozinha' } }, { onChangeMinistry });
    expect(screen.getByText('Ministério')).toBeTruthy();
    expect(screen.getByText('Cozinha')).toBeTruthy();
    fireEvent.press(screen.getByText('Alterar'));
    expect(onChangeMinistry).toHaveBeenCalled();
  });

  it.each(['DISCHARGED', 'EVADED', 'PRE_ADMISSION'])('filho %s não tem o botão Alterar', (status) => {
    renderTab({ status });
    expect(screen.getByText('Ministério')).toBeTruthy();
    expect(screen.queryByText('Alterar')).toBeNull();
  });

  it('filho sem casa não tem o botão Alterar', () => {
    renderTab({ houseId: null });
    expect(screen.queryByText('Alterar')).toBeNull();
  });

  it('sem acesso digital mostra aviso (usa o adm)', () => {
    renderTab({ userId: null });
    expect(screen.getByText('Sem acesso gerado (use o adm)')).toBeTruthy();
  });

  it('gênero feminino', () => {
    renderTab({ gender: 'FEMALE' });
    expect(screen.getByText('Feminino')).toBeTruthy();
  });
});
