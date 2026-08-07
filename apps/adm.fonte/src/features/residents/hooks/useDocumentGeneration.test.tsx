import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const downloadDocumentPdf = vi.fn();
const downloadCombinedDocumentsPdf = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    residents: {
      downloadDocumentPdf: (...a: unknown[]) => downloadDocumentPdf(...a),
      downloadCombinedDocumentsPdf: (...a: unknown[]) => downloadCombinedDocumentsPdf(...a),
    },
  },
}));

import { useDocumentGeneration } from './useDocumentGeneration';
import type { DocumentTemplate } from '@fonte/api-client';

function template(id: string, over: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id, name: `Termo ${id}`, content: 'sem variáveis', isRequired: true, signAtAdmission: false,
    ...over,
  } as DocumentTemplate;
}

function setup() {
  // Sem `resident` os gates de pré-voo (assinatura/campos) não entram no
  // caminho: aqui interessa só a seleção e o download.
  return renderHook(() => useDocumentGeneration({ residentId: 'r1', residentName: 'Fulano' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:1'), revokeObjectURL: vi.fn() });
  downloadCombinedDocumentsPdf.mockResolvedValue(new Blob(['pdf']));
  downloadDocumentPdf.mockResolvedValue(new Blob(['pdf']));
});
afterEach(() => vi.clearAllMocks());

describe('useDocumentGeneration — seleção', () => {
  it('toggleSelected marca e desmarca um id', () => {
    const { result } = setup();
    act(() => result.current.toggleSelected('t1'));
    expect([...result.current.selectedIds]).toEqual(['t1']);
    act(() => result.current.toggleSelected('t1'));
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggleAll com seleção vazia marca todos os ids', () => {
    const { result } = setup();
    act(() => result.current.toggleAll(['t1', 't2', 't3']));
    expect([...result.current.selectedIds]).toEqual(['t1', 't2', 't3']);
  });

  it('toggleAll com todos já marcados esvazia a seleção', () => {
    const { result } = setup();
    act(() => result.current.toggleAll(['t1', 't2']));
    act(() => result.current.toggleAll(['t1', 't2']));
    expect(result.current.selectedIds.size).toBe(0);
  });

  // Decisão 4 da story 161: parcial vira TUDO marcado (é o clique no traço do
  // indeterminate).
  it('toggleAll com seleção parcial marca todos', () => {
    const { result } = setup();
    act(() => result.current.toggleSelected('t2'));
    act(() => result.current.toggleAll(['t1', 't2', 't3']));
    expect([...result.current.selectedIds]).toEqual(['t1', 't2', 't3']);
  });

  it('toggleAll com ids repetidos guarda cada id uma vez só', () => {
    const { result } = setup();
    act(() => result.current.toggleAll(['t1', 't1', 't2']));
    expect(result.current.selectedIds.size).toBe(2);
    expect([...result.current.selectedIds]).toEqual(['t1', 't2']);
  });

  it('toggleAll sem ids nenhum deixa a seleção vazia', () => {
    const { result } = setup();
    act(() => result.current.toggleAll([]));
    expect(result.current.selectedIds.size).toBe(0);
  });

  // Trava a decisão 3: o botão "Limpar seleção" saiu e o helper foi SUBSTITUÍDO
  // pelo toggleAll — nada de código morto sobrando no hook.
  it('não exporta mais clearSelection', () => {
    const { result } = setup();
    expect(result.current).not.toHaveProperty('clearSelection');
    expect(typeof result.current.toggleAll).toBe('function');
  });
});

describe('useDocumentGeneration — PDF combinado e seleção', () => {
  it('download combinado com sucesso esvazia a seleção', async () => {
    const { result } = setup();
    act(() => result.current.toggleAll(['t1', 't2']));
    act(() => result.current.requestCombined([template('t1'), template('t2')]));

    await waitFor(() =>
      expect(downloadCombinedDocumentsPdf).toHaveBeenCalledWith('r1', ['t1', 't2']),
    );
    await waitFor(() => expect(result.current.selectedIds.size).toBe(0));
    expect(result.current.error).toBeNull();
  });

  it('download combinado que falha mantém a seleção e seta o erro', async () => {
    downloadCombinedDocumentsPdf.mockRejectedValue({
      response: { data: { message: 'Selecione ao menos um documento.' } },
    });
    const { result } = setup();
    act(() => result.current.toggleAll(['t1', 't2']));
    act(() => result.current.requestCombined([template('t1'), template('t2')]));

    await waitFor(() => expect(result.current.error).toBe('Selecione ao menos um documento.'));
    expect([...result.current.selectedIds]).toEqual(['t1', 't2']);
  });

  it('requestCombined sem templates não chama a API nem mexe na seleção', () => {
    const { result } = setup();
    act(() => result.current.requestCombined([]));
    expect(downloadCombinedDocumentsPdf).not.toHaveBeenCalled();
  });

  it('download individual não mexe na seleção', async () => {
    const { result } = setup();
    act(() => result.current.toggleAll(['t1']));
    act(() => result.current.requestSingle(template('t1')));

    await waitFor(() => expect(downloadDocumentPdf).toHaveBeenCalledWith('r1', 't1'));
    expect([...result.current.selectedIds]).toEqual(['t1']);
  });
});
