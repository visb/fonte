import { waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('@/lib/api', () => ({
  api: {
    messages: {
      getConversations: jest.fn(),
      getMyConversations: jest.fn(),
      getThread: jest.fn(),
      getPending: jest.fn(),
      send: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      getDirectConversations: jest.fn(),
      getDirectThread: jest.fn(),
      sendDirect: jest.fn(),
      uploadAttachment: jest.fn(),
    },
    residents: { listByHouse: jest.fn() },
    relatives: { listByResident: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useConversations,
  useMyConversations,
  useMessageThread,
  usePendingMessages,
  useSendMessage,
  useApproveMessage,
  useRejectMessage,
  useDirectConversations,
  useHouseRelativesForMessages,
  useDirectThread,
  useSendDirectMessage,
} from './useMessages';

const m = api as unknown as {
  messages: Record<string, jest.Mock>;
  residents: Record<string, jest.Mock>;
  relatives: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useMessages — queries', () => {
  it('useConversations / useMyConversations / usePendingMessages / useDirectConversations', async () => {
    m.messages.getConversations.mockResolvedValue([]);
    m.messages.getMyConversations.mockResolvedValue([]);
    m.messages.getPending.mockResolvedValue([]);
    m.messages.getDirectConversations.mockResolvedValue([]);
    const a = renderHookWithClient(() => useConversations());
    const b = renderHookWithClient(() => useMyConversations());
    const c = renderHookWithClient(() => usePendingMessages());
    const d = renderHookWithClient(() => useDirectConversations());
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(c.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(d.result.current.isSuccess).toBe(true));
    expect(m.messages.getConversations).toHaveBeenCalled();
    expect(m.messages.getMyConversations).toHaveBeenCalled();
    expect(m.messages.getPending).toHaveBeenCalled();
    expect(m.messages.getDirectConversations).toHaveBeenCalled();
  });

  it('useMessageThread enabled só com residentId + relativeId', async () => {
    m.messages.getThread.mockResolvedValue([]);
    const { result } = renderHookWithClient(() => useMessageThread('r1', 'rel1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.messages.getThread).toHaveBeenCalledWith('r1', 'rel1');
    renderHookWithClient(() => useMessageThread('', ''));
    expect(m.messages.getThread).toHaveBeenCalledTimes(1);
  });

  it('useDirectThread enabled só com staffId + relativeId', async () => {
    m.messages.getDirectThread.mockResolvedValue([]);
    const { result } = renderHookWithClient(() => useDirectThread('s1', 'rel1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.messages.getDirectThread).toHaveBeenCalledWith('s1', 'rel1');
  });

  it('useHouseRelativesForMessages agrupa residentes com familiares (filtra os sem)', async () => {
    m.residents.listByHouse.mockResolvedValue([{ id: 'r1', name: 'João' }, { id: 'r2', name: 'Pedro' }]);
    m.relatives.listByResident.mockImplementation((id: string) =>
      Promise.resolve(id === 'r1' ? [{ id: 'rel1', name: 'Mãe' }] : []),
    );
    const { result } = renderHookWithClient(() => useHouseRelativesForMessages('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { residentId: 'r1', residentName: 'João', relatives: [{ id: 'rel1', name: 'Mãe' }] },
    ]);
  });

  it('useHouseRelativesForMessages não dispara sem casa', () => {
    renderHookWithClient(() => useHouseRelativesForMessages(null));
    expect(m.residents.listByHouse).not.toHaveBeenCalled();
  });
});

describe('moderação de mensagens', () => {
  it('useApproveMessage aprova', async () => {
    m.messages.approve.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useApproveMessage());
    result.current.mutate('msg-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.messages.approve).toHaveBeenCalledWith('msg-1');
  });

  it('useRejectMessage rejeita', async () => {
    m.messages.reject.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useRejectMessage());
    result.current.mutate('msg-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.messages.reject).toHaveBeenCalledWith('msg-1');
  });
});

describe('useSendMessage / useSendDirectMessage', () => {
  const origOS = Platform.OS;
  beforeAll(() => {
    // @ts-expect-error força ramo web do uploadAttachment
    Platform.OS = 'web';
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })) }) as never;
  });
  afterAll(() => {
    // @ts-expect-error restaura
    Platform.OS = origOS;
  });

  it('envia só texto quando não há anexos', async () => {
    m.messages.send.mockResolvedValue({ id: 'msg-1' });
    const { result } = renderHookWithClient(() => useSendMessage());
    result.current.mutate({ residentId: 'r1', relativeId: 'rel1', payload: { content: 'Olá' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.messages.send).toHaveBeenCalledWith({ residentId: 'r1', relativeId: 'rel1', content: 'Olá' });
  });

  it('faz upload do anexo e envia com attachmentUrl/Type', async () => {
    m.messages.uploadAttachment.mockResolvedValue({ url: 'http://x/a.png', type: 'image' });
    m.messages.send.mockResolvedValue({ id: 'msg-2' });
    const { result } = renderHookWithClient(() => useSendMessage());
    result.current.mutate({
      residentId: 'r1',
      relativeId: 'rel1',
      payload: { attachments: [{ uri: 'blob:x', mimeType: 'image/png', name: 'a' }] as never },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.messages.uploadAttachment).toHaveBeenCalledWith(expect.any(FormData));
    expect(m.messages.send).toHaveBeenCalledWith({
      residentId: 'r1',
      relativeId: 'rel1',
      attachmentUrl: 'http://x/a.png',
      attachmentType: 'image',
    });
  });

  it('useSendDirectMessage envia texto direto staff↔relative', async () => {
    m.messages.sendDirect.mockResolvedValue({ id: 'd-1' });
    const { result } = renderHookWithClient(() => useSendDirectMessage());
    result.current.mutate({ staffId: 's1', relativeId: 'rel1', payload: { content: 'Oi' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.messages.sendDirect).toHaveBeenCalledWith({ staffId: 's1', relativeId: 'rel1', content: 'Oi' });
  });
});
