/**
 * Contagem × modais de consulta (story 179).
 *
 * O que se prova aqui é a regressão que protege o censo: abrir a ficha ou a
 * foto de um filho **não** mexe nas confirmações já marcadas (`confirmedIds` é
 * estado local da página) e cada handler leva o filho certo.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ResidentStatus, Role } from '@fonte/types';

let mockRole = Role.COORDINATOR;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ staff: { houseId: 'h1', user: { role: mockRole } } }) }));
const mockSubmit = jest.fn();
jest.mock('@/lib/offline/fieldSubmit', () => ({ useFieldSubmit: () => mockSubmit }));

const mockResidents = [
  { id: 'r1', name: 'João', status: ResidentStatus.ACTIVE, entryDate: '2026-01-05' },
  {
    id: 'r2',
    name: 'Maria',
    status: ResidentStatus.ACTIVE,
    entryDate: '2026-02-10',
    photoThumbUrl: 'https://x/t.jpg',
    photoUrl: 'https://x/full.jpg',
  },
];
jest.mock('../hooks/useCensus', () => ({
  useActiveResidentsByHouse: () => ({
    data: mockResidents,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useConcludeCensus: () => ({ isPending: false }),
}));

let mockOnline = true;
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => mockOnline }));

const mockAddModal = jest.fn();
jest.mock('../components/AddResidentModal', () => ({
  AddResidentModal: (props: { visible: boolean }) => {
    mockAddModal(props);
    return null;
  },
}));
const mockRemoveModal = jest.fn();
jest.mock('@/features/residents/components/RemoveResidentModal', () => ({
  RemoveResidentModal: (props: unknown) => {
    mockRemoveModal(props);
    return null;
  },
}));
const mockConcludeModal = jest.fn();
jest.mock('../components/ConcludeCensusModal', () => ({
  ConcludeCensusModal: (props: unknown) => {
    mockConcludeModal(props);
    return null;
  },
}));
jest.mock('../components/ResidentDetailModal', () => {
  const { Text } = require('react-native');
  return {
    ResidentDetailModal: ({
      visible,
      resident,
      onClose,
    }: {
      visible: boolean;
      resident: { name: string } | null;
      onClose: () => void;
    }) => (visible ? <Text onPress={onClose}>{`detalhes:${resident?.name}`}</Text> : null),
  };
});
jest.mock('@/features/residents/components/ResidentPhotoViewer', () => {
  const { Text } = require('react-native');
  return {
    ResidentPhotoViewer: ({ visible, name, onClose }: { visible: boolean; name: string; onClose: () => void }) =>
      visible ? <Text onPress={onClose}>{`foto:${name}`}</Text> : null,
  };
});

import { CensusPage } from './CensusPage';

describe('CensusPage — adicionar filho exige rede (story 218)', () => {
  const OFFLINE_MESSAGE =
    'Sem conexão: para adicionar um filho é preciso estar online, para checar se ele já passou pela comunidade.';

  beforeEach(() => {
    mockOnline = true;
    mockAddModal.mockClear();
  });

  it('online: botão ativo abre o modal, sem aviso', () => {
    render(<CensusPage />);
    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    fireEvent.press(screen.getByLabelText('Adicionar filho'));
    expect(mockAddModal).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true }));
  });

  it('offline: botão desabilitado com o aviso, e o modal não abre', () => {
    mockOnline = false;
    render(<CensusPage />);
    const button = screen.getByLabelText('Adicionar filho');
    expect(button.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
    fireEvent.press(button);
    expect(mockAddModal).not.toHaveBeenCalledWith(expect.objectContaining({ visible: true }));
  });
});

describe('CensusPage — conclusão e fechamento dos modais', () => {
  type Handlers = { onSent: () => void; onQueued: () => void; onFailed: (e: unknown) => void };
  const last = (mock: jest.Mock) => mock.mock.calls[mock.mock.calls.length - 1][0];

  beforeEach(() => {
    mockOnline = true;
    mockSubmit.mockClear();
  });

  it('concluir envia a contagem e trata enviado, fila e falha', () => {
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<CensusPage />);

    last(mockConcludeModal).onConfirm();
    expect(mockSubmit).toHaveBeenCalledWith(
      { houseId: 'h1', confirmedCount: 0, total: 2 },
      expect.any(Object),
    );
    const handlers: Handlers = mockSubmit.mock.calls[0][1];
    act(() => handlers.onSent());
    expect(alert).toHaveBeenCalledWith('Contagem concluída', 'O ADM foi notificado.');
    act(() => handlers.onQueued());
    expect(alert).toHaveBeenCalledWith('Contagem salva', expect.any(String));
    act(() => handlers.onFailed({ response: { data: { message: 'Falhou' } } }));
    expect(alert).toHaveBeenCalledWith('Erro', 'Falhou');
  });

  it('fechar e concluir os modais não quebra a página', () => {
    render(<CensusPage />);
    act(() => {
      last(mockAddModal).onClose();
      last(mockAddModal).onSuccess();
      last(mockRemoveModal).onClose();
      last(mockRemoveModal).onSuccess();
      last(mockConcludeModal).onClose();
    });
    expect(screen.getByText('0/2 confirmados')).toBeTruthy();
  });
});

describe('CensusPage — modais de consulta', () => {
  beforeEach(() => { mockRole = Role.COORDINATOR; mockOnline = true; });

  it('servo confirma presença, mas não pode remover filho pela contagem', () => {
    mockRole = Role.SERVANT;
    render(<CensusPage />);
    expect(screen.queryByLabelText('Remover João')).toBeNull();
    expect(screen.getByLabelText('Confirmar João')).toBeTruthy();
  });

  it.each([Role.ADMIN, Role.COORDINATOR])('%s pode remover filho ativo', (role) => {
    mockRole = role;
    render(<CensusPage />);
    expect(screen.getByLabelText('Remover João')).toBeTruthy();
  });

  // Story 203: a entrada do filho (cache da contagem) limita a data de saída.
  it('remover leva a entrada do filho ao modal de baixa', () => {
    render(<CensusPage />);
    fireEvent.press(screen.getByLabelText('Remover Maria'));
    expect(mockRemoveModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visible: true,
        resident: { id: 'r2', name: 'Maria', entryDate: '2026-02-10' },
      }),
    );
  });

  it('abrir e fechar os detalhes não altera as confirmações', () => {
    render(<CensusPage />);
    expect(screen.getByText('0/2 confirmados')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Confirmar João'));
    expect(screen.getByText('1/2 confirmados')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Detalhes de João'));
    expect(screen.getByText('detalhes:João')).toBeTruthy();
    expect(screen.getByText('1/2 confirmados')).toBeTruthy();
  });

  it('cada linha abre os detalhes do seu próprio filho', () => {
    render(<CensusPage />);
    fireEvent.press(screen.getByLabelText('Detalhes de Maria'));
    expect(screen.getByText('detalhes:Maria')).toBeTruthy();
    expect(screen.queryByText('detalhes:João')).toBeNull();
  });

  it('toque na foto abre o visualizador do filho da linha', () => {
    render(<CensusPage />);
    fireEvent.press(screen.getByLabelText('Ver foto de Maria'));
    expect(screen.getByText('foto:Maria')).toBeTruthy();
    expect(screen.queryByText('detalhes:Maria')).toBeNull();
    fireEvent.press(screen.getByText('foto:Maria'));
    expect(screen.queryByText('foto:Maria')).toBeNull();
  });

  it('fechar os detalhes some com o modal', () => {
    render(<CensusPage />);
    fireEvent.press(screen.getByLabelText('Detalhes de Maria'));
    fireEvent.press(screen.getByText('detalhes:Maria'));
    expect(screen.queryByText('detalhes:Maria')).toBeNull();
  });
});
