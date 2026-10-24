import { fireEvent, render, screen } from '@testing-library/react-native';
import { ResidentStatus, Role } from '@fonte/types';

// Story 196: a lista de filhos passa a hospedar o menu de linha e o modal de
// baixa — um por página, não um por item.

const mockAuth = jest.fn();
const mockResidentsByHouse = jest.fn();
const mockRemoveModal = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/lib/api', () => ({ api: {}, resolveAssetUrl: (u: string | null) => u }));
jest.mock('@/features/residents/hooks/useResidents', () => ({
  useResidentsByHouse: (...args: unknown[]) => mockResidentsByHouse(...args),
}));
jest.mock('@/lib/offline/store/useLastSyncedAt', () => ({ useLastSyncedAt: () => null }));
jest.mock('@/components/shared/LastSyncedAt', () => ({ LastSyncedAt: () => null }));
jest.mock('@/features/residents/components/RemoveResidentModal', () => {
  const { Text } = require('react-native');
  return {
    RemoveResidentModal: (props: {
      visible: boolean;
      resident: { name: string } | null;
      mode?: string;
    }) => {
      mockRemoveModal(props);
      return props.visible ? <Text>{`remover:${props.resident?.name}:${props.mode}`}</Text> : null;
    },
  };
});

import { ResidentsPage } from './ResidentsPage';

const RESIDENTS = [
  { id: 'r1', name: 'João Silva', status: ResidentStatus.ACTIVE },
  { id: 'r2', name: 'Pedro Alves', status: ResidentStatus.ACTIVE, entryDate: '2026-02-10' },
];

function setup(role: Role = Role.COORDINATOR) {
  mockAuth.mockReturnValue({ staff: { id: 's1', houseId: 'h1', user: { role } } });
  mockResidentsByHouse.mockReturnValue({
    data: RESIDENTS,
    isLoading: false,
    refetch: jest.fn(),
  });
  return render(<ResidentsPage />);
}

beforeEach(() => jest.clearAllMocks());

describe('ResidentsPage — saída da comunidade e transferência', () => {
  it('menu → Declarar saída da comunidade abre o modal com o filho e mode exit', () => {
    setup();
    fireEvent.press(screen.getByLabelText('Ações de Pedro Alves'));
    fireEvent.press(screen.getByText('Declarar saída da comunidade'));
    expect(screen.getByText('remover:Pedro Alves:exit')).toBeTruthy();
    expect(mockRemoveModal).toHaveBeenLastCalledWith(
      // Story 203: a entrada vai junto (do cache da lista) para limitar a saída.
      expect.objectContaining({
        visible: true,
        resident: { id: 'r2', name: 'Pedro Alves', entryDate: '2026-02-10' },
        mode: 'exit',
      }),
    );
  });

  it('filho sem entrada registrada vai ao modal com entryDate null', () => {
    setup();
    fireEvent.press(screen.getByLabelText('Ações de João Silva'));
    fireEvent.press(screen.getByText('Declarar saída da comunidade'));
    expect(mockRemoveModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ resident: { id: 'r1', name: 'João Silva', entryDate: null } }),
    );
  });

  it('menu → Transferir de casa abre o modal com o filho e mode transfer', () => {
    setup();
    fireEvent.press(screen.getByLabelText('Ações de João Silva'));
    fireEvent.press(screen.getByText('Transferir de casa'));
    expect(screen.getByText('remover:João Silva:transfer')).toBeTruthy();
  });

  it('fechar o menu sem escolher não abre o modal', () => {
    setup();
    fireEvent.press(screen.getByLabelText('Ações de João Silva'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText(/remover:João Silva/)).toBeNull();
    expect(mockRemoveModal).toHaveBeenCalledWith(
      expect.objectContaining({ visible: false, resident: null }),
    );
  });

  it('SERVANT não vê o ⋮ em nenhuma linha', () => {
    setup(Role.SERVANT);
    expect(screen.queryByLabelText('Ações de João Silva')).toBeNull();
    expect(screen.queryByLabelText('Ações de Pedro Alves')).toBeNull();
  });

  it('passa a casa do staff logado para o modal', () => {
    setup();
    expect(mockRemoveModal).toHaveBeenCalledWith(expect.objectContaining({ houseId: 'h1' }));
  });
});

describe('ResidentsPage — ordem por data de entrada (story 222)', () => {
  // Cache em ordem alfabética, como chegam o GET e o snapshot offline.
  const ALPHABETICAL = [
    { id: 'a', name: 'Ana', status: ResidentStatus.ACTIVE, entryDate: '2024-01-01' },
    { id: 'b', name: 'Bruno', status: ResidentStatus.DISCHARGED, entryDate: '2026-05-01' },
    { id: 'c', name: 'Carla', status: ResidentStatus.ACTIVE, entryDate: null },
    { id: 'd', name: 'Davi', status: ResidentStatus.ACTIVE, entryDate: '2026-03-01' },
    { id: 'e', name: 'Érico', status: ResidentStatus.ACTIVE, entryDate: '2025-06-01' },
  ];

  const renderedNames = () =>
    screen
      .getAllByText(/^(Ana|Bruno|Carla|Davi|Érico)$/)
      .map((node) => node.props.children as string);

  function renderSorted() {
    mockAuth.mockReturnValue({ staff: { id: 's1', houseId: 'h1', user: { role: Role.SERVANT } } });
    mockResidentsByHouse.mockReturnValue({
      data: ALPHABETICAL,
      isLoading: false,
      refetch: jest.fn(),
    });
    return render(<ResidentsPage />);
  }

  it('renderiza a entrada mais recente primeiro e sem entrada no fim', () => {
    renderSorted();
    expect(renderedNames()).toEqual(['Davi', 'Érico', 'Ana', 'Carla']);
  });

  it('a busca filtra a lista já ordenada', () => {
    renderSorted();
    fireEvent.changeText(screen.getByPlaceholderText('Buscar filho...'), 'a');
    expect(renderedNames()).toEqual(['Davi', 'Ana', 'Carla']);
  });

  it('o filtro de status mantém a ordem por entrada', () => {
    renderSorted();
    fireEvent.press(screen.getByText('icon:options-outline'));
    fireEvent.press(screen.getByText('Alta'));
    fireEvent.press(screen.getByText('Aplicar'));
    expect(renderedNames()).toEqual(['Bruno', 'Davi', 'Érico', 'Ana', 'Carla']);
  });

  it('não muta o array do cache', () => {
    renderSorted();
    expect(ALPHABETICAL.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
