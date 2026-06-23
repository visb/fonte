import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/api', () => ({ resolveAssetUrl: (u: string | null) => u }));

const mockUseAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ useAuth: () => mockUseAuth() }));

const mockUseHouseRelatives = jest.fn();
jest.mock('../hooks/useMessages', () => ({
  useHouseRelativesForMessages: () => mockUseHouseRelatives(),
}));

import { NewDirectConversationModal } from './NewDirectConversationModal';

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ staff: { houseId: 'h1' } });
  mockUseHouseRelatives.mockReturnValue({ data: [], isLoading: false });
});

describe('NewDirectConversationModal', () => {
  it('sem casa vinculada mostra aviso', () => {
    mockUseAuth.mockReturnValue({ staff: { houseId: null } });
    rc(<NewDirectConversationModal visible onClose={jest.fn()} />);
    expect(screen.getByText('Seu perfil não está vinculado a uma casa')).toBeTruthy();
  });

  it('lista vazia mostra "Nenhum familiar cadastrado na casa"', () => {
    mockUseHouseRelatives.mockReturnValue({ data: [], isLoading: false });
    rc(<NewDirectConversationModal visible onClose={jest.fn()} />);
    expect(screen.getByText('Nenhum familiar cadastrado na casa')).toBeTruthy();
  });

  it('agrupa por residente e seleciona um familiar (navega + fecha)', () => {
    const onClose = jest.fn();
    mockUseHouseRelatives.mockReturnValue({
      data: [{ residentId: 'r1', residentName: 'João', relatives: [{ id: 'rel1', name: 'Maria Silva', relationship: 'Mãe' }] }],
      isLoading: false,
    });
    rc(<NewDirectConversationModal visible onClose={onClose} />);
    expect(screen.getByText('João')).toBeTruthy();
    fireEvent.press(screen.getByText('Maria Silva'));
    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalled();
  });
});
