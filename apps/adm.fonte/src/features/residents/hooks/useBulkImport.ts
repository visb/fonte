import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  ImportPreviewResult,
  ParseSpreadsheetResult,
  SpreadsheetImportRow,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/errors';
import { IMPORT_BATCH_SIZE, type ImportItemStatus } from '../constants';

// ─── Parse da planilha de referência ────────────────────────────────────────

/** Mutation que envia a planilha `.xlsx` e devolve as linhas normalizadas. */
export function useParseSpreadsheet() {
  return useMutation<ParseSpreadsheetResult, unknown, File>({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.residents.parseSpreadsheet(formData);
    },
  });
}

// ─── Checagem de conflito de um item ────────────────────────────────────────

/**
 * Consulta conflito (nome/CPF) de uma ficha já extraída. É uma query
 * autossuficiente: o card a dispara sozinho quando fica `ready` (CLAUDE.md —
 * componentes buscam seus próprios dados), habilitada só com nome ou CPF.
 */
export function useCheckImportConflict(
  name?: string | null,
  cpf?: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.residents.importConflict(name ?? null, cpf ?? null),
    queryFn: () => api.residents.checkImportConflict(name ?? undefined, cpf ?? undefined),
    enabled: (options?.enabled ?? true) && (!!name || !!cpf),
  });
}

// ─── Fila de extração das fichas ────────────────────────────────────────────

export interface ImportQueueItem {
  id: string;
  fileName: string;
  status: ImportItemStatus;
  preview: ImportPreviewResult | null;
  error: string | null;
}

export interface UseImportQueue {
  items: ImportQueueItem[];
  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  processingCount: number;
}

/**
 * Controla a fila de extração das fichas `.docx` com concorrência limitada a
 * `IMPORT_BATCH_SIZE`: nunca mais que N itens em `processing` ao mesmo tempo.
 * Cada item transita `queued → processing → ready | error`; o erro de um item
 * não derruba a fila (os demais seguem). As `rows` da planilha viajam junto de
 * cada ficha para o cross-match no backend (story 102).
 */
export function useImportQueue(rows: SpreadsheetImportRow[]): UseImportQueue {
  const [items, setItems] = useState<ImportQueueItem[]>([]);
  // Guarda os arquivos fora do estado (não serializáveis) e as rows mais recentes.
  const filesRef = useRef<Map<string, File>>(new Map());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const updateItem = useCallback((id: string, patch: Partial<ImportQueueItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processItem = useCallback(
    async (id: string) => {
      const file = filesRef.current.get(id);
      if (!file) return;
      updateItem(id, { status: 'processing' });
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('rows', JSON.stringify(rowsRef.current));
        const preview = await api.residents.parseDocxWithSpreadsheet(formData);
        updateItem(id, { status: 'ready', preview, error: null });
      } catch (err) {
        updateItem(id, {
          status: 'error',
          error: getErrorMessage(err, 'Não foi possível extrair esta ficha.'),
        });
      }
    },
    [updateItem],
  );

  // Escalonador: promove itens `queued` respeitando o teto de concorrência.
  useEffect(() => {
    const processing = items.filter((item) => item.status === 'processing').length;
    const available = IMPORT_BATCH_SIZE - processing;
    if (available <= 0) return;
    const next = items.filter((item) => item.status === 'queued').slice(0, available);
    next.forEach((item) => processItem(item.id));
  }, [items, processItem]);

  const addFiles = useCallback((files: File[]) => {
    const newItems = files.map<ImportQueueItem>((file) => {
      const id = crypto.randomUUID();
      filesRef.current.set(id, file);
      return { id, fileName: file.name, status: 'queued', preview: null, error: null };
    });
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const removeItem = useCallback((id: string) => {
    filesRef.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const processingCount = items.filter((item) => item.status === 'processing').length;

  return { items, addFiles, removeItem, processingCount };
}
