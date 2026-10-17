import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAdmissionDraft,
  readAdmissionDraft,
  writeAdmissionDraft,
  type AdmissionDraft,
  type AdmissionDraftData,
} from '../lib/admissionDraft';

type WatchFn = (callback: () => void) => { unsubscribe: () => void };

interface UseAdmissionDraftOptions<V> {
  /** Chave do rascunho (`admissionDraftKey`); null desliga o rascunho. */
  storageKey: string | null;
  /** `watch` do react-hook-form — cada mudança agenda um salvamento com debounce. */
  watch: WatchFn;
  /** Estado atual a gravar (lido na hora do salvamento). */
  snapshot: () => AdmissionDraftData<V>;
  /** Valores que gravam na hora quando mudam (passo, `residentId`) — decisão 5. */
  saveImmediatelyOn?: ReadonlyArray<unknown>;
  debounceMs?: number;
}

/**
 * Rascunho automático do acolhimento (story 211). Encapsula o debounce do
 * `watch`, o salvamento imediato de passo/`residentId` e a retomada.
 *
 * Enquanto há um rascunho anterior aguardando a escolha Continuar/Descartar
 * (`pendingDraft`), nada é gravado — senão o form vazio sobrescreveria o
 * rascunho antes de o usuário decidir.
 */
export function useAdmissionDraft<V>({
  storageKey,
  watch,
  snapshot,
  saveImmediatelyOn = [],
  debounceMs = 1000,
}: UseAdmissionDraftOptions<V>) {
  const [pendingDraft, setPendingDraft] = useState<AdmissionDraft<V> | null>(() =>
    storageKey ? readAdmissionDraft<V>(storageKey) : null,
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const pendingRef = useRef(pendingDraft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só grava depois de haver o que guardar (digitou, avançou ou retomou):
  // abrir o wizard e sair não deixa um rascunho vazio para trás.
  const activeRef = useRef(false);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const saveNow = useCallback(() => {
    cancelTimer();
    if (!storageKey || !activeRef.current || pendingRef.current) return;
    const at = writeAdmissionDraft(storageKey, snapshotRef.current());
    if (at) setSavedAt(at);
  }, [storageKey, cancelTimer]);

  useEffect(() => {
    const subscription = watch(() => {
      if (pendingRef.current) return;
      activeRef.current = true;
      cancelTimer();
      timerRef.current = setTimeout(saveNow, debounceMs);
    });
    return () => subscription.unsubscribe();
  }, [watch, saveNow, cancelTimer, debounceMs]);

  const immediateKey = JSON.stringify(saveImmediatelyOn);
  const initialImmediateKey = useRef(immediateKey);
  useEffect(() => {
    if (immediateKey !== initialImmediateKey.current) activeRef.current = true;
    saveNow();
  }, [immediateKey, saveNow]);

  // Aba fechada / navegação: grava o que ainda estava no debounce.
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) saveNow();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [saveNow]);

  /** Aceita o rascunho pendente e o devolve para a tela restaurar. */
  const resume = useCallback((): AdmissionDraft<V> | null => {
    const draft = pendingRef.current;
    pendingRef.current = null;
    activeRef.current = !!draft;
    setPendingDraft(null);
    if (draft) setSavedAt(draft.savedAt);
    return draft;
  }, []);

  /** Apaga o rascunho (Descartar, Cancelar, concluir). */
  const clear = useCallback(() => {
    cancelTimer();
    activeRef.current = false;
    pendingRef.current = null;
    setPendingDraft(null);
    setSavedAt(null);
    if (storageKey) clearAdmissionDraft(storageKey);
  }, [storageKey, cancelTimer]);

  /** Há dados preenchidos neste acolhimento (para confirmar o Cancelar). */
  const hasData = useCallback(() => activeRef.current, []);

  return { pendingDraft, savedAt, saveNow, resume, clear, hasData };
}
