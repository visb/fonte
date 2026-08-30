import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ObservabilityRuntime } from '@fonte/api-client';
import { RuntimeCards } from './RuntimeCards';

function runtime(overrides: Partial<ObservabilityRuntime> = {}): ObservabilityRuntime {
  return {
    uptimeSec: 3600 * 3 + 60 * 14,
    eventLoopLagMs: { p50: 1.2, p99: 8.5, max: 20 },
    memory: { rssMb: 180.4, heapUsedMb: 96.2, heapTotalMb: 128, externalMb: 3.1 },
    cpuPercent: 12.5,
    nodeVersion: 'v22.14.0',
    ...overrides,
  };
}

const lagValue = () => screen.getByTestId('runtime-value-Event loop lag (p99)');
const memoryValue = () => screen.getByTestId('runtime-value-Memória (RSS)');
const cpuValue = () => screen.getByTestId('runtime-value-CPU');

describe('RuntimeCards', () => {
  it('formata lag, memória, CPU e uptime', () => {
    render(<RuntimeCards runtime={runtime()} />);

    expect(lagValue()).toHaveTextContent('8.5 ms');
    expect(screen.getByText(/p50 1\.2 ms · máx 20\.0 ms/)).toBeInTheDocument();
    expect(memoryValue()).toHaveTextContent('180.4 MB');
    expect(screen.getByText(/heap 96\.2 MB de 128\.0 MB/)).toBeInTheDocument();
    expect(cpuValue()).toHaveTextContent('12.5%');
    expect(screen.getByTestId('runtime-value-Uptime')).toHaveTextContent('3h 14min');
    expect(screen.getByText('Node v22.14.0')).toBeInTheDocument();
  });

  it('destaca o lag p99 acima de 100ms e não destaca abaixo', () => {
    const { unmount } = render(
      <RuntimeCards runtime={runtime({ eventLoopLagMs: { p50: 10, p99: 180, max: 400 } })} />,
    );
    expect(lagValue().className).toContain('text-destructive');
    unmount();

    render(
      <RuntimeCards runtime={runtime({ eventLoopLagMs: { p50: 1, p99: 100, max: 120 } })} />,
    );
    expect(lagValue().className).not.toContain('text-destructive');
  });

  it('destaca CPU acima de 80% e memória acima do teto', () => {
    render(
      <RuntimeCards
        runtime={runtime({
          cpuPercent: 91,
          memory: { rssMb: 900, heapUsedMb: 700, heapTotalMb: 800, externalMb: 5 },
        })}
      />,
    );
    expect(cpuValue().className).toContain('text-destructive');
    expect(memoryValue().className).toContain('text-destructive');
  });

  it('explica o que é event loop lag num title', () => {
    render(<RuntimeCards runtime={runtime()} />);
    expect(
      document.querySelector('[title^="Tempo que o event loop"]'),
    ).toBeInTheDocument();
  });

  it('tolera runtime sem campos numéricos sem imprimir NaN', () => {
    render(
      <RuntimeCards
        runtime={{
          uptimeSec: undefined,
          eventLoopLagMs: undefined,
          memory: undefined,
          cpuPercent: undefined,
          nodeVersion: undefined,
        } as unknown as ObservabilityRuntime}
      />,
    );
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(lagValue()).toHaveTextContent('—');
  });
});
