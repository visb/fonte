import { waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

// api-client mockado: nenhuma chamada HTTP real é feita.
jest.mock('@/lib/api', () => ({
  api: {
    messages: {
      getThread: jest.fn(),
      send: jest.fn(),
      uploadAttachment: jest.fn(),
      getHouseStaffThreads: jest.fn(),
      getDirectThread: jest.fn(),
      sendDirect: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useThread,
  useSendMessage,
  useHouseStaffThreads,
  useDirectThread,
  useSendDirectMessage,
} from './useMessages';

const mockApi = api as unknown as {
  messages: {
    getThread: jest.Mock;
    send: jest.Mock;
    uploadAttachment: jest.Mock;
    getHouseStaffThreads: jest.Mock;
    getDirectThread: jest.Mock;
    sendDirect: jest.Mock;
  };
};

beforeEach(() => jest.clearAllMocks());

describe('useThread', () => {
  it('busca a thread passando residentId e relativeId ao api-client', async () => {
    const messages = [{ id: 'm1', content: 'Olá' }];
    mockApi.messages.getThread.mockResolvedValue(messages);

    const { result } = renderHookWithClient(() => useThread('res-1', 'rel-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.messages.getThread).toHaveBeenCalledWith('res-1', 'rel-1');
    expect(result.current.data).toEqual(messages);
  });

  it('não dispara a query quando os ids estão vazios (enabled=false)', () => {
    renderHookWithClient(() => useThread('', ''));
    expect(mockApi.messages.getThread).not.toHaveBeenCalled();
  });
});

describe('useSendMessage', () => {
  it('envia a mensagem de texto com resident/relative na mutation', async () => {
    mockApi.messages.send.mockResolvedValue({ id: 'm-new' });

    const { result } = renderHookWithClient(() => useSendMessage('res-1', 'rel-1'));
    result.current.mutate({ content: 'Bom dia' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.messages.send).toHaveBeenCalledWith({
      residentId: 'res-1',
      relativeId: 'rel-1',
      content: 'Bom dia',
    });
  });

  it('ignora conteúdo só com espaços (não chama send)', async () => {
    const { result } = renderHookWithClient(() => useSendMessage('res-1', 'rel-1'));
    result.current.mutate({ content: '   ' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.messages.send).not.toHaveBeenCalled();
  });

  it('faz upload do anexo e envia mensagem com attachmentUrl/Type', async () => {
    mockApi.messages.uploadAttachment.mockResolvedValue({ url: 'u://a.jpg', type: 'image' });
    mockApi.messages.send.mockResolvedValue({ id: 'm-att' });

    const { result } = renderHookWithClient(() => useSendMessage('res-1', 'rel-1'));
    result.current.mutate({
      attachments: [{ uri: 'file://a.jpg', mimeType: 'image/jpeg', name: 'a.jpg' }],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.messages.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(mockApi.messages.send).toHaveBeenCalledWith({
      residentId: 'res-1',
      relativeId: 'rel-1',
      attachmentUrl: 'u://a.jpg',
      attachmentType: 'image',
    });
  });

  describe('na plataforma web (upload via fetch+blob+File)', () => {
    const originalOS = Platform.OS;
    const originalFetch = global.fetch;
    const originalFile = (global as { File?: unknown }).File;

    beforeEach(() => {
      (Platform as { OS: string }).OS = 'web';
      global.fetch = jest.fn().mockResolvedValue({
        blob: () => Promise.resolve({ type: 'image/jpeg' }),
      }) as unknown as typeof fetch;
      // garante File no ambiente de teste (node) p/ a montagem do FormData web
      (global as { File: unknown }).File = class FileStub {
        parts: unknown[];
        name: string;
        type?: string;
        constructor(parts: unknown[], name: string, opts?: { type?: string }) {
          this.parts = parts;
          this.name = name;
          this.type = opts?.type;
        }
      };
    });

    afterEach(() => {
      (Platform as { OS: string }).OS = originalOS;
      global.fetch = originalFetch;
      (global as { File?: unknown }).File = originalFile;
    });

    it('monta o nome com extensão derivada do mime e envia o anexo', async () => {
      mockApi.messages.uploadAttachment.mockResolvedValue({ url: 'u://web.jpg', type: 'image' });
      mockApi.messages.send.mockResolvedValue({ id: 'm-web' });

      const { result } = renderHookWithClient(() => useSendMessage('res-1', 'rel-1'));
      // att.name sem ponto → recebe a extensão derivada do mime (jpeg)
      result.current.mutate({
        attachments: [{ uri: 'blob://a', mimeType: 'image/jpeg', name: 'foto' }],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(global.fetch).toHaveBeenCalledWith('blob://a');
      const fd = mockApi.messages.uploadAttachment.mock.calls[0][0];
      expect(fd).toBeInstanceOf(FormData);
      expect(mockApi.messages.send).toHaveBeenCalledWith({
        residentId: 'res-1',
        relativeId: 'rel-1',
        attachmentUrl: 'u://web.jpg',
        attachmentType: 'image',
      });
    });
  });
});

describe('useHouseStaffThreads', () => {
  it('lista as threads de staff da casa', async () => {
    const threads = [{ staffId: 's1', staffName: 'Ana' }];
    mockApi.messages.getHouseStaffThreads.mockResolvedValue(threads);

    const { result } = renderHookWithClient(() => useHouseStaffThreads());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(threads);
  });
});

describe('useDirectThread', () => {
  it('busca a thread direta com staffId e relativeId', async () => {
    mockApi.messages.getDirectThread.mockResolvedValue([{ id: 'd1' }]);

    const { result } = renderHookWithClient(() => useDirectThread('s1', 'rel-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.messages.getDirectThread).toHaveBeenCalledWith('s1', 'rel-1');
  });

  it('não dispara sem staffId (enabled=false)', () => {
    renderHookWithClient(() => useDirectThread('', 'rel-1'));
    expect(mockApi.messages.getDirectThread).not.toHaveBeenCalled();
  });
});

describe('useSendDirectMessage', () => {
  it('envia mensagem direta de texto', async () => {
    mockApi.messages.sendDirect.mockResolvedValue({ id: 'd-new' });

    const { result } = renderHookWithClient(() => useSendDirectMessage('s1', 'rel-1'));
    result.current.mutate({ content: 'Oi' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.messages.sendDirect).toHaveBeenCalledWith({
      staffId: 's1',
      relativeId: 'rel-1',
      content: 'Oi',
    });
  });

  it('faz upload e envia anexo direto com url/type', async () => {
    mockApi.messages.uploadAttachment.mockResolvedValue({ url: 'u://d.pdf', type: 'document' });
    mockApi.messages.sendDirect.mockResolvedValue({ id: 'd-att' });

    const { result } = renderHookWithClient(() => useSendDirectMessage('s1', 'rel-1'));
    result.current.mutate({
      attachments: [{ uri: 'file://d.pdf', mimeType: 'application/pdf', name: 'd.pdf' }],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.messages.sendDirect).toHaveBeenCalledWith({
      staffId: 's1',
      relativeId: 'rel-1',
      attachmentUrl: 'u://d.pdf',
      attachmentType: 'document',
    });
  });
});
