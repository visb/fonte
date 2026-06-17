import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// api-client mockado: nenhuma chamada HTTP real é feita.
jest.mock('@/lib/api', () => ({
  api: {
    messages: {
      getThread: jest.fn(),
      send: jest.fn(),
      uploadAttachment: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { useThread, useSendMessage } from './useMessages';

const mockApi = api as unknown as {
  messages: {
    getThread: jest.Mock;
    send: jest.Mock;
  };
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useThread', () => {
    it('busca a thread passando residentId e relativeId ao api-client', async () => {
      const messages = [{ id: 'm1', content: 'Olá' }];
      mockApi.messages.getThread.mockResolvedValue(messages);

      const { result } = renderHook(() => useThread('res-1', 'rel-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.messages.getThread).toHaveBeenCalledWith('res-1', 'rel-1');
      expect(result.current.data).toEqual(messages);
    });

    it('não dispara a query quando os ids estão vazios (enabled=false)', () => {
      renderHook(() => useThread('', ''), { wrapper: createWrapper() });
      expect(mockApi.messages.getThread).not.toHaveBeenCalled();
    });
  });

  describe('useSendMessage', () => {
    it('envia a mensagem de texto com resident/relative na mutation', async () => {
      mockApi.messages.send.mockResolvedValue({ id: 'm-new' });

      const { result } = renderHook(() => useSendMessage('res-1', 'rel-1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ content: 'Bom dia' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.messages.send).toHaveBeenCalledWith({
        residentId: 'res-1',
        relativeId: 'rel-1',
        content: 'Bom dia',
      });
    });

    it('ignora conteúdo só com espaços (não chama send)', async () => {
      const { result } = renderHook(() => useSendMessage('res-1', 'rel-1'), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ content: '   ' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApi.messages.send).not.toHaveBeenCalled();
    });
  });
});
