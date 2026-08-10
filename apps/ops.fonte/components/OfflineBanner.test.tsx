jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));

// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { act, render, screen } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { OfflineBanner, OFFLINE_MESSAGE } from './OfflineBanner';

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('OfflineBanner', () => {
  it('não renderiza nada quando há rede', () => {
    onlineManager.setOnline(true);
    render(<OfflineBanner />);

    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('renderiza o aviso quando a rede cai', () => {
    onlineManager.setOnline(false);
    render(<OfflineBanner />);

    expect(screen.getByTestId('offline-banner')).toBeTruthy();
    expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
  });

  it('some sozinho quando o sinal volta', () => {
    onlineManager.setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();

    act(() => onlineManager.setOnline(true));

    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('avisa que o trabalho continua (não é mensagem de erro)', () => {
    onlineManager.setOnline(false);
    render(<OfflineBanner />);

    expect(OFFLINE_MESSAGE).toContain('você continua trabalhando');
  });
});
