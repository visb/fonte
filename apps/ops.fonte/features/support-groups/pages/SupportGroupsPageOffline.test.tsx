/**
 * Grupo de apoio depende de check-in de terceiros em tempo real: fica fora da
 * fila offline (decisão 1 do epic 167) e avisa em vez de falhar — story 171.
 */
import { render, screen } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { name: 'Irmão João', photoUrl: null }, logout: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({ resolveAssetUrl: () => null }));
jest.mock('../hooks/useSupportGroups', () => ({
  useAllMeetings: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
}));
jest.mock('../components/CreateMeetingModal', () => ({ CreateMeetingModal: () => null }));

import { SupportGroupsPage } from './SupportGroupsPage';

afterEach(() => onlineManager.setOnline(true));

describe('SupportGroupsPage sem rede', () => {
  it('bloqueia a criação de reunião com o motivo', () => {
    onlineManager.setOnline(false);
    render(<SupportGroupsPage />);

    expect(screen.getByTestId('offline-notice')).toBeTruthy();
    expect(screen.getByText('Precisa de conexão para criar uma reunião.')).toBeTruthy();
  });

  it('com rede não há aviso', () => {
    onlineManager.setOnline(true);
    render(<SupportGroupsPage />);

    expect(screen.queryByTestId('offline-notice')).toBeNull();
  });
});
