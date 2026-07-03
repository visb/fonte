import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    residents: {
      parseSpreadsheet: vi.fn(),
      parseDocxWithSpreadsheet: vi.fn(),
      checkImportConflict: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import { IMPORT_BATCH_SIZE } from '../constants';
import { useParseSpreadsheet, useCheckImportConflict, useImportQueue } from './useBulkImport';

function docx(name: string): File {
  return new File(['x'], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Cria uma promise controlável para segurar a extração e testar concorrência. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useParseSpreadsheet', () => {
  it('envia o arquivo como FormData e devolve o resultado', async () => {
    vi.mocked(api.residents.parseSpreadsheet).mockResolvedValue({
      rows: [{ name: 'A' }],
      houses: ['Casa'],
      skipped: 0,
      ignoredSheets: [],
    } as never);
    const { result } = renderHookWithClient(() => useParseSpreadsheet());
    act(() => result.current.mutate(new File(['x'], 'planilha.xlsx')));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.parseSpreadsheet).toHaveBeenCalledWith(expect.any(FormData));
    const fd = vi.mocked(api.residents.parseSpreadsheet).mock.calls[0][0] as FormData;
    expect(fd.get('file')).toBeInstanceOf(File);
  });
});

describe('useCheckImportConflict', () => {
  it('desliga sem nome nem cpf', () => {
    const { result } = renderHookWithClient(() => useCheckImportConflict(null, null));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('consulta com nome/cpf e usa a query key centralizada', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
    const { result } = renderHookWithClient(() => useCheckImportConflict('João', '123'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.residents.checkImportConflict).toHaveBeenCalledWith('João', '123');
    // sanidade: a key é a centralizada
    expect(queryKeys.residents.importConflict('João', '123')).toEqual([
      'residents', 'import-conflict', 'João', '123',
    ]);
  });

  it('respeita enabled=false mesmo com nome', () => {
    const { result } = renderHookWithClient(() =>
      useCheckImportConflict('João', null, { enabled: false }),
    );
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useImportQueue', () => {
  it('processa e transita queued → processing → ready', async () => {
    const d = deferred<unknown>();
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockReturnValue(d.promise as never);
    const { result } = renderHookWithClient(() => useImportQueue([{ name: 'A' } as never]));

    act(() => result.current.addFiles([docx('a.docx')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('processing'));

    // as rows viajam junto no FormData
    const fd = vi.mocked(api.residents.parseDocxWithSpreadsheet).mock.calls[0][0] as FormData;
    expect(fd.get('file')).toBeInstanceOf(File);
    expect(JSON.parse(fd.get('rows') as string)).toEqual([{ name: 'A' }]);

    act(() => d.resolve({ resident: { name: 'A' }, warnings: {}, houseName: 'Casa' }));
    await waitFor(() => expect(result.current.items[0].status).toBe('ready'));
    expect(result.current.items[0].preview).toMatchObject({ houseName: 'Casa' });
  });

  it('nunca mantém mais de IMPORT_BATCH_SIZE itens em processing', async () => {
    const deferreds = Array.from({ length: IMPORT_BATCH_SIZE + 3 }, () => deferred<unknown>());
    let call = 0;
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockImplementation(
      () => deferreds[call++].promise as never,
    );
    const { result } = renderHookWithClient(() => useImportQueue([]));

    act(() =>
      result.current.addFiles(
        Array.from({ length: IMPORT_BATCH_SIZE + 3 }, (_, i) => docx(`f${i}.docx`)),
      ),
    );

    await waitFor(() => expect(result.current.processingCount).toBe(IMPORT_BATCH_SIZE));
    // teto respeitado: nunca ultrapassa N
    expect(result.current.processingCount).toBeLessThanOrEqual(IMPORT_BATCH_SIZE);
    expect(result.current.items.filter((i) => i.status === 'queued')).toHaveLength(3);

    // conclui um → um da fila entra, mantendo o teto
    act(() => deferreds[0].resolve({ resident: {}, warnings: {}, houseName: '' }));
    await waitFor(() =>
      expect(result.current.items.filter((i) => i.status === 'ready')).toHaveLength(1),
    );
    await waitFor(() => expect(result.current.processingCount).toBe(IMPORT_BATCH_SIZE));
    expect(result.current.processingCount).toBeLessThanOrEqual(IMPORT_BATCH_SIZE);
  });

  it('erro num item vira status error e não derruba a fila', async () => {
    const ok = deferred<unknown>();
    const bad = deferred<unknown>();
    let call = 0;
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockImplementation(
      () => (call++ === 0 ? bad.promise : ok.promise) as never,
    );
    const { result } = renderHookWithClient(() => useImportQueue([]));

    act(() => result.current.addFiles([docx('bad.docx'), docx('ok.docx')]));
    await waitFor(() => expect(result.current.processingCount).toBe(2));

    act(() => bad.reject(new Error('boom')));
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    expect(result.current.items[0].error).toBeTruthy();

    // o segundo item segue vivo e conclui normalmente
    act(() => ok.resolve({ resident: {}, warnings: {}, houseName: '' }));
    await waitFor(() => expect(result.current.items[1].status).toBe('ready'));
  });

  it('removeItem tira o item da fila', async () => {
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockReturnValue(deferred().promise as never);
    const { result } = renderHookWithClient(() => useImportQueue([]));
    act(() => result.current.addFiles([docx('a.docx')]));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    const id = result.current.items[0].id;
    act(() => result.current.removeItem(id));
    expect(result.current.items).toHaveLength(0);
  });
});
