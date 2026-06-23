import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// api.residentSessions mockado: getToday/heartbeat sem HTTP real.
jest.mock('./api', () => ({
  api: {
    residentSessions: {
      getToday: jest.fn(),
      heartbeat: jest.fn(),
    },
  },
}));

import { api } from './api';
import { UsageTimerProvider, useUsageTimerContext } from './UsageTimerContext';

const m = api as unknown as {
  residentSessions: { getToday: jest.Mock; heartbeat: jest.Mock };
};

const LIMIT = 1200;

// Componente sonda que expõe o contexto como texto.
function Probe() {
  const { secondsRemaining, isBlocked, isLoading, startTracking, stopTracking } =
    useUsageTimerContext();
  // expõe os controles globalmente para os testes dispararem.
  (globalThis as never as Record<string, unknown>).__start = startTracking;
  (globalThis as never as Record<string, unknown>).__stop = stopTracking;
  return (
    <Text>{`rem=${secondsRemaining} blocked=${isBlocked} loading=${isLoading}`}</Text>
  );
}

function getStart() {
  return (globalThis as never as Record<string, () => void>).__start;
}
function getStop() {
  return (globalThis as never as Record<string, () => void>).__stop;
}

describe('UsageTimerContext — contador de uso (limite diário)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('useUsageTimerContext fora do provider lança erro', () => {
    function Bad() {
      useUsageTimerContext();
      return null;
    }
    // suprime o erro do console do React no caminho de exceção.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow('useUsageTimerContext must be inside UsageTimerProvider');
    spy.mockRestore();
  });

  it('na montagem busca o valor do servidor e sai de loading com o restante calculado', async () => {
    m.residentSessions.getToday.mockResolvedValue({ secondsUsed: 200 });
    render(
      <UsageTimerProvider>
        <Probe />
      </UsageTimerProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(m.residentSessions.getToday).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`rem=${LIMIT - 200} blocked=false loading=false`)).toBeTruthy();
  });

  it('clampa o valor do servidor ao limite e marca isBlocked quando estoura', async () => {
    m.residentSessions.getToday.mockResolvedValue({ secondsUsed: 5000 });
    render(
      <UsageTimerProvider>
        <Probe />
      </UsageTimerProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('rem=0 blocked=true loading=false')).toBeTruthy();
  });

  it('startTracking faz o display avançar pelo relógio (tick de 1s)', async () => {
    m.residentSessions.getToday.mockResolvedValue({ secondsUsed: 100 });
    m.residentSessions.heartbeat.mockResolvedValue({ secondsUsed: 100 });
    render(
      <UsageTimerProvider>
        <Probe />
      </UsageTimerProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      getStart()();
    });
    // avança 3s de relógio + 3 ticks do display.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    // 100 base + ~3s decorridos → restante ~1097.
    expect(screen.getByText(/rem=109[0-9]/)).toBeTruthy();
  });

  it('ao atingir 10s envia heartbeat com os segundos decorridos', async () => {
    m.residentSessions.getToday.mockResolvedValue({ secondsUsed: 0 });
    m.residentSessions.heartbeat.mockResolvedValue({ secondsUsed: 10 });
    render(
      <UsageTimerProvider>
        <Probe />
      </UsageTimerProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      getStart()();
    });
    act(() => {
      jest.advanceTimersByTime(11000);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(m.residentSessions.heartbeat).toHaveBeenCalled();
    const secs = m.residentSessions.heartbeat.mock.calls[0][0];
    expect(secs).toBeGreaterThanOrEqual(10);
  });

  it('stopTracking faz flush do tempo restante via heartbeat', async () => {
    m.residentSessions.getToday.mockResolvedValue({ secondsUsed: 0 });
    m.residentSessions.heartbeat.mockResolvedValue({ secondsUsed: 5 });
    render(
      <UsageTimerProvider>
        <Probe />
      </UsageTimerProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      getStart()();
    });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    act(() => {
      getStop()();
    });
    await act(async () => {
      await Promise.resolve();
    });
    // flush dispara heartbeat ao parar (>0s desde o último heartbeat).
    expect(m.residentSessions.heartbeat).toHaveBeenCalled();
  });
});
