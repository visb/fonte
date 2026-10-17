import { act, waitFor } from '@testing-library/react-native';

jest.mock('expo-file-system', () => ({
  cacheDirectory: '/tmp/',
  writeAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('@/lib/api', () => ({
  api: { relatives: { myPaidReceivables: jest.fn(), receivableReceipt: jest.fn() } },
}));

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import { useMyPaidReceivables, useReceivableReceipt } from './useContributions';

const mockApi = api as unknown as {
  relatives: { myPaidReceivables: jest.Mock; receivableReceipt: jest.Mock };
};
const writeAsStringAsync = FileSystem.writeAsStringAsync as unknown as jest.Mock;
const shareAsync = Sharing.shareAsync as unknown as jest.Mock;

const PAID = [
  {
    id: 'rcv-1',
    referenceMonth: '2026-08-01',
    paidAmount: 480,
    paidAt: '2026-08-09',
    paymentMethod: 'PIX',
  },
];

const FILE = { residentName: 'João da Silva', referenceMonth: '2026-08-01' };

beforeEach(() => {
  jest.clearAllMocks();
  writeAsStringAsync.mockResolvedValue(undefined);
  shareAsync.mockResolvedValue(undefined);
});

describe('useMyPaidReceivables (story 193)', () => {
  it('busca as parcelas pagas sem mandar id de filho nenhum', async () => {
    mockApi.relatives.myPaidReceivables.mockResolvedValue(PAID);

    const { result } = renderHookWithClient(() => useMyPaidReceivables());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.relatives.myPaidReceivables).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(PAID);
  });
});

describe('useReceivableReceipt (story 193)', () => {
  it('baixa em arraybuffer, grava em base64 no cache e compartilha como PDF', async () => {
    mockApi.relatives.receivableReceipt.mockResolvedValue(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
    );
    const { result } = renderHookWithClient(() => useReceivableReceipt());

    await act(async () => {
      await result.current.download('rcv-1', FILE);
    });

    // RN não tem Blob utilizável para escrever arquivo — daí o arraybuffer.
    expect(mockApi.relatives.receivableReceipt).toHaveBeenCalledWith('rcv-1', {
      responseType: 'arraybuffer',
    });
    // Story 212 — o arquivo gravado e compartilhado tem o nome do filho e a competência.
    expect(writeAsStringAsync).toHaveBeenCalledWith(
      '/tmp/recibo-joao-da-silva-08-2026.pdf',
      'JVBERg==',
      { encoding: 'base64' },
    );
    expect(shareAsync).toHaveBeenCalledWith(
      '/tmp/recibo-joao-da-silva-08-2026.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.downloadingId).toBeNull();
  });

  it('erro do backend chega ao familiar com a frase acionável, não com erro genérico', async () => {
    const message =
      'Nenhum template de recibo cadastrado para contribuição mensal do acolhido. Cadastre em Configurações → Templates.';
    // O corpo do erro chega em UTF-8 (a frase tem acento), como o axios entrega.
    const utf8 = unescape(encodeURIComponent(JSON.stringify({ message })));
    const bytes = new Uint8Array(utf8.length);
    for (let i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
    mockApi.relatives.receivableReceipt.mockRejectedValue({ response: { data: bytes.buffer } });

    const { result } = renderHookWithClient(() => useReceivableReceipt());
    await act(async () => {
      await result.current.download('rcv-1', FILE);
    });

    expect(result.current.error).toContain('Cadastre em Configurações → Templates.');
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('erro sem corpo legível cai no fallback, e dismissError limpa', async () => {
    mockApi.relatives.receivableReceipt.mockRejectedValue(new Error('network'));
    const { result } = renderHookWithClient(() => useReceivableReceipt());

    await act(async () => {
      await result.current.download('rcv-1', FILE);
    });
    expect(result.current.error).toMatch(/Falha ao gerar o recibo/);

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it('marca a parcela em download enquanto a requisição não volta', async () => {
    let resolve!: (b: ArrayBuffer) => void;
    mockApi.relatives.receivableReceipt.mockReturnValue(
      new Promise<ArrayBuffer>((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHookWithClient(() => useReceivableReceipt());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.download('rcv-9', FILE);
    });
    await waitFor(() => expect(result.current.downloadingId).toBe('rcv-9'));

    await act(async () => {
      resolve(new Uint8Array([0x25]).buffer);
      await pending;
    });
    expect(result.current.downloadingId).toBeNull();
  });
});
