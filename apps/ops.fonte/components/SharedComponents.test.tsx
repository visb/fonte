import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

// react-native-reanimated: usa o mock oficial (animações viram no-op).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

import { DatePickerModal } from './DatePickerModal';
import { SuccessBanner } from './shared/SuccessBanner';
import { TimeLimitedScreen } from './TimeLimitedScreen';

const mockUseTimer = jest.fn();
jest.mock('@/lib/UsageTimerContext', () => ({
  useUsageTimerContext: () => mockUseTimer(),
}));

import { Text } from 'react-native';

beforeEach(() => jest.clearAllMocks());

describe('DatePickerModal', () => {
  it('mostra o mês/ano de "value" e seleciona um dia', () => {
    const onChange = jest.fn();
    const onClose = jest.fn();
    render(<DatePickerModal visible value="2026-03-15" onClose={onClose} onChange={onChange} />);
    expect(screen.getByText('Março 2026')).toBeTruthy();
    fireEvent.press(screen.getByText('20'));
    expect(onChange).toHaveBeenCalledWith('2026-03-20');
    expect(onClose).toHaveBeenCalled();
  });

  it('navega para o mês anterior e seguinte', () => {
    render(<DatePickerModal visible value="2026-03-15" onClose={jest.fn()} onChange={jest.fn()} />);
    fireEvent.press(screen.getByText('icon:chevron-back'));
    expect(screen.getByText('Fevereiro 2026')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:chevron-forward'));
    expect(screen.getByText('Março 2026')).toBeTruthy();
  });

  it('vira o ano ao passar de Janeiro/Dezembro', () => {
    render(<DatePickerModal visible value="2026-01-10" onClose={jest.fn()} onChange={jest.fn()} />);
    fireEvent.press(screen.getByText('icon:chevron-back'));
    expect(screen.getByText('Dezembro 2025')).toBeTruthy();
  });
});

describe('SuccessBanner', () => {
  it('renderiza a mensagem e o fechar dispara onDismiss', () => {
    const onDismiss = jest.fn();
    render(<SuccessBanner message="Salvo!" onDismiss={onDismiss} />);
    expect(screen.getByText('Salvo!')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:close'));
    // com o mock do reanimated, o callback de timing roda sincronicamente.
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('TimeLimitedScreen', () => {
  it('loading mostra o indicador', () => {
    mockUseTimer.mockReturnValue({
      secondsRemaining: 0,
      isBlocked: false,
      isLoading: true,
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
    });
    render(<TimeLimitedScreen><Text>conteúdo</Text></TimeLimitedScreen>);
    expect(screen.queryByText('conteúdo')).toBeNull();
  });

  it('bloqueado mostra "Tempo esgotado"', () => {
    mockUseTimer.mockReturnValue({
      secondsRemaining: 0,
      isBlocked: true,
      isLoading: false,
      startTracking: jest.fn(),
      stopTracking: jest.fn(),
    });
    render(<TimeLimitedScreen><Text>conteúdo</Text></TimeLimitedScreen>);
    expect(screen.getByText('Tempo esgotado')).toBeTruthy();
  });

  it('ativo mostra o tempo restante (mm:ss) e o conteúdo; inicia o tracking', () => {
    const startTracking = jest.fn();
    mockUseTimer.mockReturnValue({
      secondsRemaining: 65,
      isBlocked: false,
      isLoading: false,
      startTracking,
      stopTracking: jest.fn(),
    });
    render(<TimeLimitedScreen><Text>conteúdo</Text></TimeLimitedScreen>);
    expect(screen.getByText('01:05')).toBeTruthy();
    expect(screen.getByText('conteúdo')).toBeTruthy();
    expect(startTracking).toHaveBeenCalled();
  });
});
