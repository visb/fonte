import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  admissionDraftKey,
  readAdmissionDraft,
  writeAdmissionDraft,
  type AdmissionDraftData,
} from '../lib/admissionDraft';
import { useAdmissionDraft } from './useAdmissionDraft';

type Values = { name: string };
const KEY = admissionDraftKey('u1');

/** `watch` fake: guarda os callbacks e deixa o teste disparar "mudanças". */
function fakeWatch() {
  const listeners = new Set<() => void>();
  const watch = (cb: () => void) => {
    listeners.add(cb);
    return { unsubscribe: () => listeners.delete(cb) };
  };
  const emit = () => listeners.forEach((cb) => cb());
  return { watch, emit, listeners };
}

interface Props {
  storageKey: string | null;
  step: number;
  residentId: string | null;
  values: Values;
}

function setup(initial: Partial<Props> = {}) {
  const { watch, emit, listeners } = fakeWatch();
  const props: Props = { storageKey: KEY, step: 0, residentId: null, values: { name: '' }, ...initial };
  const hook = renderHook(
    (p: Props) =>
      useAdmissionDraft<Values>({
        storageKey: p.storageKey,
        watch,
        snapshot: (): AdmissionDraftData<Values> => ({
          values: p.values,
          step: p.step,
          residentId: p.residentId,
          firstPaymentPaid: false,
          firstPaymentMethod: '',
          hadPhoto: false,
          hadProof: false,
        }),
        saveImmediatelyOn: [p.step, p.residentId],
      }),
    { initialProps: props },
  );
  return { ...hook, emit, listeners, props };
}

const stored = () => readAdmissionDraft<Values>(KEY);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAdmissionDraft', () => {
  it('não grava nada só por abrir (sem dados)', () => {
    const { result } = setup();
    expect(result.current.pendingDraft).toBeNull();
    expect(result.current.hasData()).toBe(false);
    expect(stored()).toBeNull();
  });

  it('salva após o debounce de uma mudança no form', () => {
    const { result, rerender, emit, props } = setup();
    rerender({ ...props, values: { name: 'Fulano' } });
    act(() => emit());
    expect(stored()).toBeNull();
    act(() => vi.advanceTimersByTime(999));
    expect(stored()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(stored()?.values).toEqual({ name: 'Fulano' });
    expect(result.current.savedAt).toBe(stored()?.savedAt);
    expect(result.current.hasData()).toBe(true);
  });

  it('troca de passo e residentId salvam na hora, sem esperar o debounce', () => {
    const { rerender, props } = setup();
    rerender({ ...props, step: 1, values: { name: 'A' } });
    expect(stored()?.step).toBe(1);
    rerender({ ...props, step: 2, residentId: 'r1', values: { name: 'A' } });
    expect(stored()).toMatchObject({ step: 2, residentId: 'r1' });
  });

  it('rascunho existente fica pendente e não é sobrescrito antes da escolha', () => {
    writeAdmissionDraft(KEY, {
      values: { name: 'Antigo' }, step: 2, residentId: 'r9',
      firstPaymentPaid: false, firstPaymentMethod: '', hadPhoto: false, hadProof: false,
    });
    const { result, emit, rerender, props } = setup();
    expect(result.current.pendingDraft?.values).toEqual({ name: 'Antigo' });
    rerender({ ...props, values: { name: 'Novo' } });
    act(() => emit());
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.saveNow());
    expect(stored()?.values).toEqual({ name: 'Antigo' });
  });

  it('restore devolve valores, passo e id, e volta a gravar depois', () => {
    writeAdmissionDraft(KEY, {
      values: { name: 'Antigo' }, step: 2, residentId: 'r9',
      firstPaymentPaid: false, firstPaymentMethod: '', hadPhoto: false, hadProof: false,
    });
    const { result, rerender, props } = setup();
    let restored: ReturnType<typeof result.current.resume> = null;
    act(() => {
      restored = result.current.resume();
    });
    expect(restored).toMatchObject({ values: { name: 'Antigo' }, step: 2, residentId: 'r9' });
    expect(result.current.pendingDraft).toBeNull();
    expect(result.current.savedAt).toBe((restored as unknown as { savedAt: string }).savedAt);
    expect(result.current.hasData()).toBe(true);
    rerender({ ...props, step: 3, residentId: 'r9', values: { name: 'Antigo' } });
    expect(stored()?.step).toBe(3);
  });

  it('resume sem rascunho devolve null', () => {
    const { result } = setup();
    let restored: unknown = 'x';
    act(() => {
      restored = result.current.resume();
    });
    expect(restored).toBeNull();
  });

  it('clear apaga, cancela o debounce pendente e zera o indicador', () => {
    const { result, emit, rerender, props } = setup();
    rerender({ ...props, values: { name: 'A' } });
    act(() => emit());
    act(() => vi.advanceTimersByTime(1000));
    expect(stored()).not.toBeNull();
    act(() => emit());
    act(() => result.current.clear());
    act(() => vi.advanceTimersByTime(2000));
    expect(stored()).toBeNull();
    expect(result.current.savedAt).toBeNull();
    expect(result.current.hasData()).toBe(false);
  });

  it('desmontar com debounce pendente grava o que faltava', () => {
    const { rerender, emit, unmount, props } = setup();
    rerender({ ...props, values: { name: 'Quase' } });
    act(() => emit());
    unmount();
    expect(stored()?.values).toEqual({ name: 'Quase' });
  });

  it('pagehide grava o debounce pendente', () => {
    const { rerender, emit, props } = setup();
    rerender({ ...props, values: { name: 'Fechando' } });
    act(() => emit());
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(stored()?.values).toEqual({ name: 'Fechando' });
  });

  it('sem chave (usuário desconhecido) não grava nem lê', () => {
    const { result, emit, rerender, props } = setup({ storageKey: null });
    rerender({ ...props, storageKey: null, step: 1 });
    act(() => emit());
    act(() => vi.advanceTimersByTime(2000));
    expect(localStorage.length).toBe(0);
    act(() => result.current.clear());
    expect(result.current.pendingDraft).toBeNull();
  });

  it('storage falhando no write não quebra e não marca salvo', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const { result, rerender, props } = setup();
    rerender({ ...props, step: 1 });
    expect(result.current.savedAt).toBeNull();
    spy.mockRestore();
  });

  it('desinscreve do watch ao desmontar', () => {
    const { unmount, listeners } = setup();
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
