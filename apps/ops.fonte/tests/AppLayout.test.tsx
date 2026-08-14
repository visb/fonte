// Teste do layout do grupo (app) — mora FORA de app/ de propósito: o
// expo-router trata todo arquivo sob app/ como rota. Um `_layout.test.tsx`
// vira layout do grupo e é carregado na hora de montar a árvore de rotas
// (quebra o `expo export`); qualquer outro nome ali viraria uma aba a mais nas
// Tabs. Por isso o spec fica em tests/ e importa o layout pelo alias.
//
// Safe area do app autenticado (story 174). Mock padrão do repo: o inset de
// topo do "aparelho" é 20 — em jsdom/web o valor real seria 0 e o teste não
// distinguiria wrapper que paga o inset de wrapper que ignora.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 34, left: 0, right: 0 }),
}));

// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

// As Tabs do expo-router montam o navigator inteiro (gesture handler, screens):
// aqui o que está sob teste é o wrapper, não a navegação.
jest.mock('expo-router', () => {
  const { View } = require('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) => (
    <View testID="tabs">{children}</View>
  );
  Tabs.Screen = () => null;
  return { Tabs, router: { replace: jest.fn(), navigate: jest.fn() } };
});

const statusBarProps: Record<string, unknown>[] = [];
jest.mock('expo-status-bar', () => ({
  StatusBar: (props: Record<string, unknown>) => {
    statusBarProps.push(props);
    return null;
  },
}));

jest.mock('@/lib/offline/prefetch', () => ({ useWarmHouseCache: jest.fn() }));

jest.mock('@/lib/UsageTimerContext', () => {
  const { View } = require('react-native');
  return {
    UsageTimerProvider: ({ children }: { children: React.ReactNode }) => (
      <View testID="usage-timer-provider">{children}</View>
    ),
  };
});

let mockAuth: Record<string, unknown>;
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth }));

import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import AppLayout from '@/app/(app)/_layout';

const THEME = '#272950';

// A visibilidade das tabs passou a vir do `useMenuAccess` (story 176), que
// consulta a casa do coordenador via react-query — daí o provider. Com o staff
// padrão (servo) a consulta fica `enabled: false`: nenhuma rede no teste.
function renderLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<AppLayout />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

function wrapperStyle() {
  return StyleSheet.flatten(screen.getByTestId('app-safe-area').props.style) as Record<
    string,
    number | string | undefined
  >;
}

beforeEach(() => {
  statusBarProps.length = 0;
  onlineManager.setOnline(true);
  mockAuth = {
    token: 'jwt',
    isLoading: false,
    staff: { id: 's1', name: 'Ana', houseId: 'h1' },
    isResident: false,
    canSendMessagesToFamilies: false,
    canModerateMessages: false,
  };
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('AppLayout — safe area do topo (story 174)', () => {
  it('paga o inset de topo uma única vez, no wrapper', () => {
    renderLayout();

    expect(wrapperStyle().paddingTop).toBe(20);
  });

  it('pinta a faixa da status bar na cor do header', () => {
    renderLayout();

    expect(wrapperStyle().backgroundColor).toBe(THEME);
  });

  it('não aplica inset inferior — a tab bar já trata o dela', () => {
    renderLayout();

    expect(wrapperStyle().paddingBottom).toBeUndefined();
  });

  it('configura a status bar clara e sem backgroundColor (no-op sob edge-to-edge)', () => {
    renderLayout();

    expect(statusBarProps).toHaveLength(1);
    expect(statusBarProps[0].style).toBe('light');
    expect(statusBarProps[0]).not.toHaveProperty('backgroundColor');
  });

  it('offline: banner e wrapper não somam o mesmo inset (nada de gap duplo)', () => {
    onlineManager.setOnline(false);
    renderLayout();

    const banner = StyleSheet.flatten(
      screen.getByTestId('offline-banner').props.style,
    ) as Record<string, number>;

    expect(wrapperStyle().paddingTop).toBe(20);
    expect(banner.paddingTop).toBe(8);
  });

  it('mantém o wrapper no modo interno (UsageTimerProvider)', () => {
    mockAuth = { ...mockAuth, isResident: true };
    renderLayout();

    expect(screen.getByTestId('usage-timer-provider')).toBeTruthy();
    expect(wrapperStyle().paddingTop).toBe(20);
    expect(wrapperStyle().backgroundColor).toBe(THEME);
  });

  it('mantém o wrapper para o servo de grupo de apoio (sem casa, sem tab bar)', () => {
    mockAuth = { ...mockAuth, staff: { id: 's2', name: 'Bia', houseId: null } };
    renderLayout();

    expect(wrapperStyle().paddingTop).toBe(20);
  });
});
