import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

const mockCount = jest.fn<number, []>();
jest.mock('../hooks/useSyncQueue', () => ({
  useSyncQueueCount: () => mockCount(),
}));

import { SyncQueueBadge } from './SyncQueueBadge';
import { SyncSection } from './SyncSection';
import { SyncLogoutNotice } from './SyncLogoutNotice';

beforeEach(() => jest.clearAllMocks());

describe('SyncQueueBadge', () => {
  it('some quando não há nada por sincronizar', () => {
    mockCount.mockReturnValue(0);
    render(<SyncQueueBadge />);
    expect(screen.queryByTestId('sync-queue-badge')).toBeNull();
  });

  it('mostra a contagem no singular e leva para a tela de pendências', () => {
    mockCount.mockReturnValue(1);
    render(<SyncQueueBadge />);

    expect(screen.getByText('1 lançamento por sincronizar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sync-queue-badge'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/sync');
  });

  it('pluraliza a partir de dois', () => {
    mockCount.mockReturnValue(3);
    render(<SyncQueueBadge />);
    expect(screen.getByText('3 lançamentos por sincronizar')).toBeTruthy();
  });
});

describe('SyncSection', () => {
  it('mostra título, contagem e descrição da seção', () => {
    render(<SyncSection title="Não enviadas" description="O servidor recusou." count={2} />);

    expect(screen.getByText('Não enviadas')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('O servidor recusou.')).toBeTruthy();
  });
});

describe('SyncLogoutNotice', () => {
  it('avisa que sair do app apaga a fila (LGPD do epic 167)', () => {
    render(<SyncLogoutNotice />);

    expect(screen.getByTestId('sync-logout-notice')).toBeTruthy();
    expect(
      screen.getByText(/Sair do app apaga os lançamentos que ainda não foram enviados/),
    ).toBeTruthy();
  });
});
