import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useInfiniteScroll } from './useInfiniteScroll';

type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
let lastCallback: IOCallback;
const observe = vi.fn();
const disconnect = vi.fn();

class FakeIO {
  constructor(cb: IOCallback) {
    lastCallback = cb;
  }
  observe = observe;
  disconnect = disconnect;
}

function Harness(props: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => void }) {
  const ref = useInfiniteScroll<HTMLDivElement>(props);
  return <div ref={ref} data-testid="sentinel" />;
}

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO;
});
afterEach(() => cleanup());

describe('useInfiniteScroll', () => {
  it('observa o sentinela e chama fetchNextPage ao intersectar com próxima página', () => {
    const fetchNextPage = vi.fn();
    render(<Harness hasNextPage isFetchingNextPage={false} fetchNextPage={fetchNextPage} />);
    expect(observe).toHaveBeenCalled();
    lastCallback([{ isIntersecting: true }]);
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it('não busca quando não há próxima página', () => {
    const fetchNextPage = vi.fn();
    render(<Harness hasNextPage={false} isFetchingNextPage={false} fetchNextPage={fetchNextPage} />);
    lastCallback([{ isIntersecting: true }]);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('não busca enquanto já está buscando', () => {
    const fetchNextPage = vi.fn();
    render(<Harness hasNextPage isFetchingNextPage fetchNextPage={fetchNextPage} />);
    lastCallback([{ isIntersecting: true }]);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('desconecta o observer ao desmontar', () => {
    const { unmount } = render(<Harness hasNextPage isFetchingNextPage={false} fetchNextPage={vi.fn()} />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
