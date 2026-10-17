import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReceiptType } from '@fonte/types';

vi.mock('@/lib/api', () => ({
  api: { residents: { receivableReceipt: vi.fn() } },
}));

import { api } from '@/lib/api';
import { useReceivableReceipt } from './useReceivableReceipt';

const click = vi.fn();
let downloadName: string | null = null;
const FILE = { residentName: 'João da Silva', referenceMonth: '2026-10-01' };

const MISSING_MESSAGE =
  'Nenhum template de recibo cadastrado para contribuição mensal do acolhido. Cadastre em Configurações → Templates.';

beforeEach(() => {
  vi.clearAllMocks();
  downloadName = null;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:recibo'),
    revokeObjectURL: vi.fn(),
  });
  // O jsdom não navega: intercepta o click do <a> criado pelo download.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloadName = this.download;
    click();
  });
});
afterEach(() => vi.restoreAllMocks());

describe('useReceivableReceipt (story 193)', () => {
  it('baixa o blob da parcela e dispara o download como recibo-{filho}-{MM}-{AAAA}.pdf (story 212)', async () => {
    vi.mocked(api.residents.receivableReceipt).mockResolvedValue(new Blob(['%PDF']) as never);
    const { result } = renderHook(() => useReceivableReceipt());

    await act(async () => {
      await result.current.download('res-1', 'rcv-1', FILE);
    });

    expect(api.residents.receivableReceipt).toHaveBeenCalledWith('res-1', 'rcv-1');
    expect(click).toHaveBeenCalled();
    expect(downloadName).toBe('recibo-joao-da-silva-10-2026.pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recibo');
    expect(result.current.error).toBeNull();
    expect(result.current.missingTemplateType).toBeNull();
    expect(result.current.downloadingId).toBeNull();
  });

  // O 404 de template ausente é a frase acionável do backend; se virasse erro
  // genérico de axios, o operador não saberia que basta cadastrar o template.
  it('erro 404 de template ausente exibe a MENSAGEM DO BACKEND (getErrorMessage)', async () => {
    vi.mocked(api.residents.receivableReceipt).mockRejectedValue({
      response: { status: 404, data: { message: MISSING_MESSAGE } },
    } as never);
    const { result } = renderHook(() => useReceivableReceipt());

    await act(async () => {
      await result.current.download('res-1', 'rcv-1', FILE);
    });

    await waitFor(() =>
      expect(result.current.error).toContain('Cadastre em Configurações → Templates.'),
    );
    expect(result.current.error).not.toMatch(/Falha ao gerar o recibo/);
    // Sem o code: só a mensagem, sem atalho.
    expect(result.current.missingTemplateType).toBeNull();
    expect(click).not.toHaveBeenCalled();
  });

  // Story 212 — o corpo do erro chega como Blob (responseType: 'blob').
  it('404 com code RECEIPT_TEMPLATE_MISSING em Blob → mensagem + missingTemplateType', async () => {
    const body = new Blob(
      [
        JSON.stringify({
          statusCode: 404,
          message: MISSING_MESSAGE,
          code: 'RECEIPT_TEMPLATE_MISSING',
          receiptType: 'RESIDENT_CONTRIBUTION',
        }),
      ],
      { type: 'application/json' },
    );
    vi.mocked(api.residents.receivableReceipt).mockRejectedValue({
      response: { status: 404, data: body },
    } as never);
    const { result } = renderHook(() => useReceivableReceipt());

    await act(async () => {
      await result.current.download('res-1', 'rcv-1', FILE);
    });

    expect(result.current.error).toBe(MISSING_MESSAGE);
    expect(result.current.missingTemplateType).toBe(ReceiptType.RESIDENT_CONTRIBUTION);

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
    expect(result.current.missingTemplateType).toBeNull();
  });

  it('404 de parcela inexistente (Blob sem code) mostra só a mensagem', async () => {
    const body = new Blob([JSON.stringify({ statusCode: 404, message: 'Parcela não encontrada' })]);
    vi.mocked(api.residents.receivableReceipt).mockRejectedValue({
      response: { status: 404, data: body },
    } as never);
    const { result } = renderHook(() => useReceivableReceipt());

    await act(async () => {
      await result.current.download('res-1', 'rcv-x', FILE);
    });

    expect(result.current.error).toBe('Parcela não encontrada');
    expect(result.current.missingTemplateType).toBeNull();
  });

  it('erro sem mensagem do backend cai no fallback, e dismissError limpa', async () => {
    vi.mocked(api.residents.receivableReceipt).mockRejectedValue(new Error('network') as never);
    const { result } = renderHook(() => useReceivableReceipt());

    await act(async () => {
      await result.current.download('res-1', 'rcv-1', FILE);
    });
    expect(result.current.error).toMatch(/Falha ao gerar o recibo/);

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it('marca a PARCELA em download enquanto a requisição não volta', async () => {
    let resolve!: (b: Blob) => void;
    vi.mocked(api.residents.receivableReceipt).mockReturnValue(
      new Promise<Blob>((r) => {
        resolve = r;
      }) as never,
    );
    const { result } = renderHook(() => useReceivableReceipt());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.download('res-1', 'rcv-9', FILE);
    });
    await waitFor(() => expect(result.current.downloadingId).toBe('rcv-9'));

    await act(async () => {
      resolve(new Blob(['%PDF']));
      await pending;
    });
    expect(result.current.downloadingId).toBeNull();
  });
});
