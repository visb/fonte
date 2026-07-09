import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    residents: {
      parseSpreadsheet: vi.fn(),
      parseDocxWithSpreadsheet: vi.fn(),
      checkImportConflict: vi.fn(),
      commitImport: vi.fn(),
    },
    houses: { list: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import { IMPORT_BATCH_SIZE, IMPORT_TEXTS } from '../constants';
import {
  useParseSpreadsheet,
  useCheckImportConflict,
  useCommitImport,
  useImportQueue,
  useApproveAll,
  type ImportQueueItem,
} from './useBulkImport';

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

  it('removeItem marca cancelled sem apagar o item (story 109)', async () => {
    const d = deferred<unknown>();
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockReturnValue(d.promise as never);
    const { result } = renderHookWithClient(() => useImportQueue([]));
    act(() => result.current.addFiles([docx('a.docx')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('processing'));
    act(() => d.resolve({ resident: { name: 'A' }, warnings: {}, houseName: 'Casa' }));
    await waitFor(() => expect(result.current.items[0].status).toBe('ready'));

    const id = result.current.items[0].id;
    act(() => result.current.removeItem(id));
    // não some da lista: só migra para cancelled, preview preservado
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].status).toBe('cancelled');
    expect(result.current.items[0].preview).toMatchObject({ houseName: 'Casa' });
  });

  it('restoreItem volta para ready quando já tem preview', async () => {
    const d = deferred<unknown>();
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockReturnValue(d.promise as never);
    const { result } = renderHookWithClient(() => useImportQueue([]));
    act(() => result.current.addFiles([docx('a.docx')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('processing'));
    act(() => d.resolve({ resident: { name: 'A' }, warnings: {}, houseName: 'Casa' }));
    await waitFor(() => expect(result.current.items[0].status).toBe('ready'));

    const id = result.current.items[0].id;
    act(() => result.current.removeItem(id));
    expect(result.current.items[0].status).toBe('cancelled');
    act(() => result.current.restoreItem(id));
    expect(result.current.items[0].status).toBe('ready');
  });

  it('restoreItem re-agenda extração (queued) quando não tem preview', async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    let call = 0;
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockImplementation(
      () => (call++ === 0 ? first.promise : second.promise) as never,
    );
    const { result } = renderHookWithClient(() => useImportQueue([]));
    act(() => result.current.addFiles([docx('a.docx')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('processing'));

    // cancela ainda sem preview
    const id = result.current.items[0].id;
    act(() => result.current.removeItem(id));
    expect(result.current.items[0].status).toBe('cancelled');
    expect(result.current.items[0].preview).toBeNull();

    // restaura → volta para queued e o escalonador re-processa
    act(() => result.current.restoreItem(id));
    await waitFor(() => expect(result.current.items[0].status).toBe('processing'));
    act(() => second.resolve({ resident: { name: 'A' }, warnings: {}, houseName: 'Casa' }));
    await waitFor(() => expect(result.current.items[0].status).toBe('ready'));
  });

  it('restoreItem ignora item que não está cancelado', async () => {
    const d = deferred<unknown>();
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockReturnValue(d.promise as never);
    const { result } = renderHookWithClient(() => useImportQueue([]));
    act(() => result.current.addFiles([docx('a.docx')]));
    await waitFor(() => expect(result.current.items[0].status).toBe('processing'));
    act(() => d.resolve({ resident: { name: 'A' }, warnings: {}, houseName: 'Casa' }));
    await waitFor(() => expect(result.current.items[0].status).toBe('ready'));

    const id = result.current.items[0].id;
    act(() => result.current.restoreItem(id));
    expect(result.current.items[0].status).toBe('ready');
  });

  it('tabCounts agrupa os itens por aba (story 109)', async () => {
    const specs = [
      { name: 'A', cpf: '1' },
      { name: 'B', cpf: '2' },
      { name: 'C', cpf: '3' },
    ];
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockImplementation((fd) => {
      const file = (fd as FormData).get('file') as File;
      const idx = Number(file.name.replace(/\D/g, ''));
      // ficha 2 falha (vira error → aba processadas junto com ready)
      if (idx === 2) return Promise.reject(new Error('boom'));
      return Promise.resolve({ resident: specs[idx], warnings: {}, houseName: '' } as never);
    });
    const { result } = renderHookWithClient(() => useImportQueue([]));
    act(() => result.current.addFiles(specs.map((_, i) => docx(`${i}.docx`))));
    await waitFor(() =>
      expect(result.current.items.filter((i) => i.status === 'ready')).toHaveLength(2),
    );
    await waitFor(() =>
      expect(result.current.items.filter((i) => i.status === 'error')).toHaveLength(1),
    );

    // ready(2) + error(1) → aba processadas = 3
    expect(result.current.tabCounts.processed).toBe(3);
    expect(result.current.tabCounts.queue).toBe(0);
    expect(result.current.tabCounts.approved).toBe(0);
    expect(result.current.tabCounts.cancelled).toBe(0);

    // aprova um e cancela outro → contadores migram entre abas
    act(() => result.current.markImported(result.current.items[0].id));
    act(() => result.current.removeItem(result.current.items[1].id));
    expect(result.current.tabCounts.approved).toBe(1);
    expect(result.current.tabCounts.cancelled).toBe(1);
    expect(result.current.tabCounts.processed).toBe(1);
  });
});

describe('useCommitImport', () => {
  it('on success invalida a query de residents e chama o onSuccess do chamador', async () => {
    vi.mocked(api.residents.commitImport).mockResolvedValue({
      resident: { id: 'r1' },
      contributionsCreated: { created: 2, skipped: 0 },
    } as never);
    const { result, queryClient } = renderHookWithClient(() => useCommitImport());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const onSuccess = vi.fn();

    act(() => result.current.mutate({ resident: {}, relatives: [], contributionMonths: [] } as never, { onSuccess }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.residents.commitImport).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.all });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('on error expõe o erro para o chamador exibir a mensagem', async () => {
    vi.mocked(api.residents.commitImport).mockRejectedValue(new Error('boom'));
    const { result } = renderHookWithClient(() => useCommitImport());
    act(() => result.current.mutate({ resident: {}, relatives: [], contributionMonths: [] } as never));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useImportQueue — aprovação e conflito de sessão', () => {
  function ready(name: string, cpf: string) {
    return { resident: { name, cpf }, relatives: [], warnings: {}, houseName: '' };
  }

  async function seedReady(specs: { name: string; cpf: string }[]) {
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockImplementation((fd) => {
      const file = (fd as FormData).get('file') as File;
      const idx = Number(file.name.replace(/\D/g, ''));
      return Promise.resolve(ready(specs[idx].name, specs[idx].cpf) as never);
    });
    const { result } = renderHookWithClient(() => useImportQueue([]));
    act(() => result.current.addFiles(specs.map((_, i) => docx(`${i}.docx`))));
    await waitFor(() => expect(result.current.items.every((it) => it.status === 'ready')).toBe(true));
    return result;
  }

  it('markImported vira o item para imported e o tira da contagem de pendentes', async () => {
    const result = await seedReady([{ name: 'João', cpf: '111' }, { name: 'Ana', cpf: '222' }]);
    expect(result.current.pendingCount).toBe(2);
    const id = result.current.items[0].id;
    act(() => result.current.markImported(id));
    expect(result.current.items[0].status).toBe('imported');
    expect(result.current.pendingCount).toBe(1);
  });

  it('sessionConflictName acusa filho já importado nesta sessão (mesmo cpf)', async () => {
    const result = await seedReady([{ name: 'João', cpf: '111' }, { name: 'João Neto', cpf: '111' }]);
    // sem nada importado: sem conflito de sessão
    expect(result.current.sessionConflictName(result.current.items[1])).toBeNull();
    act(() => result.current.markImported(result.current.items[0].id));
    expect(result.current.sessionConflictName(result.current.items[1])).toBe('João');
  });

  it('sessionConflictName acusa por nome normalizado (sem acento) mesmo com cpf diferente', async () => {
    const result = await seedReady([{ name: 'José', cpf: '111' }, { name: 'JOSÉ', cpf: '999' }]);
    act(() => result.current.markImported(result.current.items[0].id));
    expect(result.current.sessionConflictName(result.current.items[1])).toBe('José');
  });

  it('sem identidade (preview vazio) não acusa conflito de sessão', () => {
    const { result } = renderHookWithClient(() => useImportQueue([]));
    const empty = { id: 'x', fileName: 'x.docx', status: 'ready', preview: null, error: null } as ImportQueueItem;
    expect(result.current.sessionConflictName(empty)).toBeNull();
  });
});

describe('useApproveAll', () => {
  interface Spec {
    name: string;
    cpf: string;
    relatives?: { name: string; phone: string | null; relationship: string | null }[];
  }

  function preview(spec: Spec) {
    return {
      resident: { name: spec.name, cpf: spec.cpf },
      relatives: spec.relatives ?? [{ name: 'Mãe', phone: null, relationship: 'Mãe' }],
      warnings: {},
      houseName: 'Casa A',
      matchedHouseName: 'Casa A',
      contributionMonths: [],
    };
  }

  /** Sobe fila + hook juntos, com todos os itens já `ready`. */
  async function seed(specs: Spec[]) {
    vi.mocked(api.houses.list).mockResolvedValue([{ id: 'h1', name: 'Casa A' }] as never);
    vi.mocked(api.residents.parseDocxWithSpreadsheet).mockImplementation((fd) => {
      const file = (fd as FormData).get('file') as File;
      const idx = Number(file.name.replace(/\D/g, ''));
      return Promise.resolve(preview(specs[idx]) as never);
    });
    const rendered = renderHookWithClient(() => {
      const queue = useImportQueue([]);
      const approveAll = useApproveAll(queue);
      return { queue, approveAll };
    });
    act(() => rendered.result.current.queue.addFiles(specs.map((_, i) => docx(`${i}.docx`))));
    await waitFor(() =>
      expect(rendered.result.current.queue.items.every((it) => it.status === 'ready')).toBe(true),
    );
    return rendered;
  }

  it('aprova todas as fichas prontas em sequência e invalida as queries uma vez', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
    const first = deferred<unknown>();
    vi.mocked(api.residents.commitImport)
      .mockReturnValueOnce(first.promise as never)
      .mockResolvedValue({ resident: { id: 'r2' } } as never);
    const { result, queryClient } = await seed([
      { name: 'João', cpf: '111' },
      { name: 'Ana', cpf: '222' },
    ]);
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      void result.current.approveAll.start();
    });
    await waitFor(() => expect(result.current.approveAll.isRunning).toBe(true));

    // sequencial: o 2º commit só dispara depois do 1º resolver
    await waitFor(() => expect(api.residents.commitImport).toHaveBeenCalledTimes(1));
    act(() => first.resolve({ resident: { id: 'r1' } }));
    await waitFor(() => expect(api.residents.commitImport).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(result.current.approveAll.isRunning).toBe(false));
    expect(result.current.approveAll.progress).toMatchObject({
      total: 2, done: 2, approved: 2, skipped: 0, failed: 0,
    });
    expect(result.current.queue.items.every((it) => it.status === 'imported')).toBe(true);
    // invalidação única ao final (não por item)
    expect(spy.mock.calls.filter(([arg]) => arg?.queryKey === queryKeys.residents.all)).toHaveLength(1);
    expect(spy.mock.calls.filter(([arg]) => arg?.queryKey === queryKeys.houses.all)).toHaveLength(1);
  });

  it('pula ficha com conflito no banco e anota o motivo, sem commitar', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({
      conflicts: [{ id: 'r9', name: 'João' }],
    } as never);
    const { result } = await seed([{ name: 'João', cpf: '111' }]);

    await act(async () => result.current.approveAll.start());

    await waitFor(() => expect(result.current.approveAll.isRunning).toBe(false));
    expect(api.residents.commitImport).not.toHaveBeenCalled();
    expect(result.current.approveAll.progress).toMatchObject({ approved: 0, skipped: 1 });
    expect(result.current.queue.items[0].status).toBe('ready');
    expect(result.current.queue.items[0].error).toBe(IMPORT_TEXTS.conflictReason);
  });

  it('pula ficha sem familiar com o motivo noRelativesReason', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
    const { result } = await seed([{ name: 'João', cpf: '111', relatives: [] }]);

    await act(async () => result.current.approveAll.start());

    await waitFor(() => expect(result.current.approveAll.isRunning).toBe(false));
    expect(api.residents.commitImport).not.toHaveBeenCalled();
    expect(result.current.queue.items[0].error).toBe(IMPORT_TEXTS.noRelativesReason);
  });

  it('pula duplicata de sessão (mesmo cpf) sem consultar conflito de novo', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
    vi.mocked(api.residents.commitImport).mockResolvedValue({ resident: { id: 'r1' } } as never);
    const { result } = await seed([
      { name: 'João', cpf: '111' },
      { name: 'João Neto', cpf: '111' },
    ]);

    await act(async () => result.current.approveAll.start());

    await waitFor(() => expect(result.current.approveAll.isRunning).toBe(false));
    expect(api.residents.commitImport).toHaveBeenCalledTimes(1);
    expect(result.current.approveAll.progress).toMatchObject({ approved: 1, skipped: 1 });
    expect(result.current.queue.items[1].error).toBe(IMPORT_TEXTS.sessionConflictReason);
  });

  it('falha de commit num item não derruba o run (os demais seguem)', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
    vi.mocked(api.residents.commitImport)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ resident: { id: 'r2' } } as never);
    const { result } = await seed([
      { name: 'João', cpf: '111' },
      { name: 'Ana', cpf: '222' },
    ]);

    await act(async () => result.current.approveAll.start());

    await waitFor(() => expect(result.current.approveAll.isRunning).toBe(false));
    expect(result.current.approveAll.progress).toMatchObject({ approved: 1, failed: 1, done: 2 });
    expect(result.current.queue.items[0].status).toBe('ready');
    expect(result.current.queue.items[0].error).toBeTruthy();
    expect(result.current.queue.items[1].status).toBe('imported');
  });

  it('stop interrompe o run após o item em andamento', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
    const first = deferred<unknown>();
    vi.mocked(api.residents.commitImport).mockReturnValueOnce(first.promise as never);
    const { result } = await seed([
      { name: 'João', cpf: '111' },
      { name: 'Ana', cpf: '222' },
    ]);

    act(() => {
      void result.current.approveAll.start();
    });
    await waitFor(() => expect(api.residents.commitImport).toHaveBeenCalledTimes(1));

    act(() => result.current.approveAll.stop());
    act(() => first.resolve({ resident: { id: 'r1' } }));

    await waitFor(() => expect(result.current.approveAll.isRunning).toBe(false));
    // o 2º item nunca foi commitado
    expect(api.residents.commitImport).toHaveBeenCalledTimes(1);
    expect(result.current.approveAll.progress).toMatchObject({ approved: 1, done: 1, total: 2 });
    expect(result.current.queue.items[1].status).toBe('ready');
  });
});
