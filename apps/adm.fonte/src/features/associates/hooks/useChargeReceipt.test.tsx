import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReceiptType } from '@fonte/types';

vi.mock('@/lib/api', () => ({
  api: { associates: { chargeReceipt: vi.fn() } },
}));

import { api } from '@/lib/api';
import { useChargeReceipt } from './useChargeReceipt';

const click = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:recibo'),
    revokeObjectURL: vi.fn(),
  });
  // O jsdom não navega: intercepta o click do <a> criado pelo download.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
});
afterEach(() => vi.restoreAllMocks());

describe('useChargeReceipt (story 178)', () => {
  it('baixa o blob e dispara o download', async () => {
    vi.mocked(api.associates.chargeReceipt).mockResolvedValue(new Blob(['%PDF']) as never);
    const { result } = renderHook(() => useChargeReceipt());

    await act(async () => {
      await result.current.download('chg-1');
    });

    expect(api.associates.chargeReceipt).toHaveBeenCalledWith('chg-1');
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recibo');
    expect(result.current.error).toBeNull();
    expect(result.current.downloadingId).toBeNull();
  });

  // O 404 de template ausente é a frase acionável do backend; se virasse erro
  // genérico de axios, o operador não saberia que basta cadastrar o template.
  it('erro 404 de template ausente exibe a MENSAGEM DO BACKEND (getErrorMessage)', async () => {
    vi.mocked(api.associates.chargeReceipt).mockRejectedValue({
      response: {
        status: 404,
        data: {
          message:
            'Nenhum template de recibo cadastrado para contribuição mensal do associado. Cadastre em Configurações → Templates.',
        },
      },
    } as never);
    const { result } = renderHook(() => useChargeReceipt());

    await act(async () => {
      await result.current.download('chg-1');
    });

    await waitFor(() =>
      expect(result.current.error).toContain('Cadastre em Configurações → Templates.'),
    );
    expect(result.current.error).not.toMatch(/Falha ao gerar o recibo/);
    expect(click).not.toHaveBeenCalled();
  });

  // Story 212 — o corpo do erro chega como Blob (responseType: 'blob').
  it('404 com code RECEIPT_TEMPLATE_MISSING em Blob → mensagem + missingTemplateType', async () => {
    const body = new Blob([
      JSON.stringify({
        statusCode: 404,
        message: 'Nenhum template de recibo cadastrado para contribuição mensal do associado.',
        code: 'RECEIPT_TEMPLATE_MISSING',
        receiptType: 'ASSOCIATE_CONTRIBUTION',
      }),
    ]);
    vi.mocked(api.associates.chargeReceipt).mockRejectedValue({
      response: { status: 404, data: body },
    } as never);
    const { result } = renderHook(() => useChargeReceipt());

    await act(async () => {
      await result.current.download('chg-1');
    });

    expect(result.current.error).toContain('contribuição mensal do associado');
    expect(result.current.missingTemplateType).toBe(ReceiptType.ASSOCIATE_CONTRIBUTION);
    act(() => result.current.dismissError());
    expect(result.current.missingTemplateType).toBeNull();
  });

  it('404 sem code (cobrança inexistente) não oferece atalho', async () => {
    vi.mocked(api.associates.chargeReceipt).mockRejectedValue({
      response: { status: 404, data: new Blob([JSON.stringify({ message: 'Cobrança não encontrada' })]) },
    } as never);
    const { result } = renderHook(() => useChargeReceipt());

    await act(async () => {
      await result.current.download('chg-x');
    });

    expect(result.current.error).toBe('Cobrança não encontrada');
    expect(result.current.missingTemplateType).toBeNull();
  });

  it('erro sem mensagem do backend cai no fallback, e dismissError limpa', async () => {
    vi.mocked(api.associates.chargeReceipt).mockRejectedValue(new Error('network') as never);
    const { result } = renderHook(() => useChargeReceipt());

    await act(async () => {
      await result.current.download('chg-1');
    });
    expect(result.current.error).toMatch(/Falha ao gerar o recibo/);

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it('marca a cobrança em download enquanto a requisição não volta', async () => {
    let resolve!: (b: Blob) => void;
    vi.mocked(api.associates.chargeReceipt).mockReturnValue(
      new Promise<Blob>((r) => { resolve = r; }) as never,
    );
    const { result } = renderHook(() => useChargeReceipt());

    let pending!: Promise<void>;
    act(() => { pending = result.current.download('chg-9'); });
    await waitFor(() => expect(result.current.downloadingId).toBe('chg-9'));

    await act(async () => {
      resolve(new Blob(['%PDF']));
      await pending;
    });
    expect(result.current.downloadingId).toBeNull();
  });
});
