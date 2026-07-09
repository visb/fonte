import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CommitImportPayload,
  ImportPreviewResult,
  ParseSpreadsheetResult,
  SpreadsheetImportRow,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/errors';
import { normalizeForSearch } from '@/lib/utils';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { buildCommitPayloadFromPreview } from '../lib/importCommit';
import {
  IMPORT_BATCH_SIZE,
  IMPORT_TABS,
  IMPORT_TAB_STATUSES,
  IMPORT_TEXTS,
  type ImportItemStatus,
  type ImportTab,
} from '../constants';

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

// ─── Commit do import aprovado (story 105) ──────────────────────────────────

/**
 * Mutation que persiste o filho aprovado (resident + relatives + contribuições
 * retroativas) de forma atômica (story 103). Ao concluir, invalida a lista de
 * `residents` (e casas, cujo headcount muda) para refletir o novo filho; quem
 * dispara marca o item da fila como `imported` no `onSuccess`. Erros sobem para
 * o chamador, que os exibe com `getErrorMessage`.
 */
export function useCommitImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CommitImportPayload) => api.residents.commitImport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    },
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
  /**
   * Cancela o item (story 109): marca `cancelled` em vez de apagá-lo, para que
   * migre para a aba Canceladas e possa ser restaurado. O arquivo/preview é
   * preservado.
   */
  removeItem: (id: string) => void;
  /**
   * Restaura um item cancelado: volta para `ready` (se já tem preview) ou
   * `queued` (sem preview — o escalonador re-agenda a extração).
   */
  restoreItem: (id: string) => void;
  /** Marca o item como `imported` após o commit aprovar (não remove da lista). */
  markImported: (id: string) => void;
  /**
   * Anota no item o motivo de uma falha/pulo de aprovação em lote, sem mudar o
   * status — o item continua `ready` e pode ser aprovado manualmente depois.
   */
  setItemError: (id: string, message: string) => void;
  /**
   * Nome de um filho já aprovado nesta sessão que conflita com o item (mesmo CPF
   * ou mesmo nome normalizado), ou `null` se não há conflito de sessão.
   */
  sessionConflictName: (item: ImportQueueItem) => string | null;
  processingCount: number;
  /** Itens `ready` ainda não importados — a fila de aprovação pendente. */
  pendingCount: number;
  /** Contagem de itens por aba, para os badges (story 109). */
  tabCounts: Record<ImportTab, number>;
}

/** Identidade normalizada de um item (nome sem acento + CPF só dígitos). */
function itemIdentity(item: ImportQueueItem): { name: string | null; cpf: string | null } {
  const resident = (item.preview?.resident ?? {}) as Record<string, unknown>;
  const rawName = typeof resident.name === 'string' ? resident.name.trim() : '';
  const rawCpf = typeof resident.cpf === 'string' ? resident.cpf.replace(/\D/g, '') : '';
  return { name: rawName ? normalizeForSearch(rawName) : null, cpf: rawCpf || null };
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
    // Cancela sem apagar (story 109): o arquivo em `filesRef` é preservado para
    // permitir restaurar depois; o item só migra para a aba Canceladas.
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'cancelled' } : item)),
    );
  }, []);

  const restoreItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.status !== 'cancelled') return item;
        // Tem preview → volta pronto; senão re-agenda a extração via `queued`.
        return { ...item, status: item.preview ? 'ready' : 'queued', error: null };
      }),
    );
  }, []);

  const markImported = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'imported', error: null } : item)),
    );
  }, []);

  const setItemError = useCallback((id: string, message: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, error: message } : item)),
    );
  }, []);

  const sessionConflictName = useCallback(
    (item: ImportQueueItem): string | null => {
      const { name, cpf } = itemIdentity(item);
      if (!name && !cpf) return null;
      const clash = items.find((other) => {
        if (other.id === item.id || other.status !== 'imported') return false;
        const o = itemIdentity(other);
        return (!!cpf && o.cpf === cpf) || (!!name && o.name === name);
      });
      if (!clash) return null;
      const resident = (clash.preview?.resident ?? {}) as Record<string, unknown>;
      return typeof resident.name === 'string' ? resident.name : clash.fileName;
    },
    [items],
  );

  const processingCount = items.filter((item) => item.status === 'processing').length;
  const pendingCount = items.filter((item) => item.status === 'ready').length;

  const tabCounts = IMPORT_TABS.reduce(
    (acc, tab) => {
      acc[tab] = items.filter((item) => IMPORT_TAB_STATUSES[tab].includes(item.status)).length;
      return acc;
    },
    {} as Record<ImportTab, number>,
  );

  return {
    items,
    addFiles,
    removeItem,
    restoreItem,
    markImported,
    setItemError,
    sessionConflictName,
    processingCount,
    pendingCount,
    tabCounts,
  };
}

// ─── Aprovação em lote (aprovar todos) ──────────────────────────────────────

export interface ApproveAllProgress {
  total: number;
  done: number;
  approved: number;
  skipped: number;
  failed: number;
}

export interface UseApproveAll {
  /** Progresso do run atual (ou do último concluído); `null` antes do 1º run. */
  progress: ApproveAllProgress | null;
  isRunning: boolean;
  start: () => void;
  /** Interrompe após o item em andamento — nada fica pela metade. */
  stop: () => void;
}

/**
 * Aprova todas as fichas `ready` da fila, uma por vez (concorrência 1): com
 * centenas/milhares de fichas, disparar commits em paralelo derrubaria browser
 * e API — sequencial mantém o uso de rede/memória constante. Por item: pula
 * conflito de sessão (identidade local, sem rede) e conflito no banco
 * (checagem fresca por item); falha de commit não
 * derruba o run. Itens pulados/falhos continuam `ready` com o motivo anotado
 * (`setItemError`), para revisão manual. As queries de residents/houses são
 * invalidadas UMA vez ao final — invalidar por item causaria um refetch em
 * cascata a cada aprovação.
 */
export function useApproveAll(
  queue: Pick<UseImportQueue, 'items' | 'markImported' | 'setItemError'>,
): UseApproveAll {
  const queryClient = useQueryClient();
  const { data: houses = [] } = useHouses();
  const [progress, setProgress] = useState<ApproveAllProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);
  // Refs para o loop assíncrono ler sempre o valor mais recente sem re-criar o run.
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const housesRef = useRef(houses);
  housesRef.current = houses;

  const stop = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const start = useCallback(async () => {
    const all = queueRef.current.items;
    const ready = all.filter((item) => item.status === 'ready' && item.preview);
    if (ready.length === 0) return;
    cancelRef.current = false;
    setIsRunning(true);
    const tally: ApproveAllProgress = {
      total: ready.length,
      done: 0,
      approved: 0,
      skipped: 0,
      failed: 0,
    };
    setProgress({ ...tally });

    // Identidades já importadas na sessão + as aprovadas durante este run.
    // Conjunto local (não o estado React): o loop não pode depender de re-render.
    const importedNames = new Set<string>();
    const importedCpfs = new Set<string>();
    const remember = (item: ImportQueueItem) => {
      const { name, cpf } = itemIdentity(item);
      if (name) importedNames.add(name);
      if (cpf) importedCpfs.add(cpf);
    };
    all.filter((item) => item.status === 'imported').forEach(remember);

    for (const item of ready) {
      if (cancelRef.current) break;
      const { name, cpf } = itemIdentity(item);
      try {
        if ((cpf && importedCpfs.has(cpf)) || (name && importedNames.has(name))) {
          queueRef.current.setItemError(item.id, IMPORT_TEXTS.sessionConflictReason);
          tally.skipped += 1;
          continue;
        }
        const resident = (item.preview?.resident ?? {}) as Record<string, unknown>;
        const rawName = typeof resident.name === 'string' ? resident.name : undefined;
        const rawCpf = typeof resident.cpf === 'string' ? resident.cpf : undefined;
        if (rawName || rawCpf) {
          const { conflicts } = await api.residents.checkImportConflict(rawName, rawCpf);
          if (conflicts.length > 0) {
            queueRef.current.setItemError(item.id, IMPORT_TEXTS.conflictReason);
            tally.skipped += 1;
            continue;
          }
        }
        // Ficha sem familiar conhecido é aprovável no import (regra "≥1
        // relative" vale só para o acolhimento manual).
        const payload = buildCommitPayloadFromPreview(item.preview!, housesRef.current);
        await api.residents.commitImport(payload);
        queueRef.current.markImported(item.id);
        remember(item);
        tally.approved += 1;
      } catch (err) {
        tally.failed += 1;
        queueRef.current.setItemError(item.id, getErrorMessage(err, IMPORT_TEXTS.commitError));
      } finally {
        tally.done += 1;
        setProgress({ ...tally });
      }
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
    setIsRunning(false);
  }, [queryClient]);

  return { progress, isRunning, start, stop };
}
