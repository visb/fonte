import { describe, expect, it, vi } from 'vitest';
import { handleVariableDrop, isVariableToken } from './templateDrop';

// ─── isVariableToken ──────────────────────────────────────────────────────────

describe('isVariableToken', () => {
  it('reconhece o token nu {{chave}}', () => {
    expect(isVariableToken('{{name}}')).toBe(true);
    expect(isVariableToken('{{signature}}')).toBe(true);
    expect(isVariableToken('{{responsibleName}}')).toBe(true);
  });

  it('tolera espaços em volta do token', () => {
    expect(isVariableToken('  {{cpf}}  ')).toBe(true);
  });

  it('rejeita texto que não é um token puro', () => {
    expect(isVariableToken('name')).toBe(false);
    expect(isVariableToken('{name}')).toBe(false);
    expect(isVariableToken('texto {{name}} no meio')).toBe(false);
    expect(isVariableToken('{{a}}{{b}}')).toBe(false);
    expect(isVariableToken('{{}}')).toBe(false);
    expect(isVariableToken('')).toBe(false);
  });

  it('rejeita não-strings', () => {
    expect(isVariableToken(null)).toBe(false);
    expect(isVariableToken(undefined)).toBe(false);
  });
});

// ─── handleVariableDrop ───────────────────────────────────────────────────────
// View e event são mocks: só nos importa que a inserção use a posição do drop e
// que texto não-token não toque no documento.

function makeView(pos: number | null = 5) {
  const insertText = vi.fn().mockReturnValue('tr');
  const view = {
    posAtCoords: vi.fn(() => (pos === null ? null : { pos, inside: -1 })),
    state: { tr: { insertText } },
    dispatch: vi.fn(),
  };
  return { view, insertText };
}

function makeEvent(text: string | undefined) {
  return {
    dataTransfer: text === undefined ? null : { getData: vi.fn(() => text) },
    clientX: 42,
    clientY: 84,
    preventDefault: vi.fn(),
  } as unknown as DragEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

describe('handleVariableDrop', () => {
  it('token válido → insere na posição do drop e consome o evento', () => {
    const { view, insertText } = makeView(7);
    const event = makeEvent('{{name}}');

    const result = handleVariableDrop(view as never, event);

    expect(result).toBe(true);
    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 42, top: 84 });
    expect(insertText).toHaveBeenCalledWith('{{name}}', 7);
    expect(view.dispatch).toHaveBeenCalledWith('tr');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('insere o token sem os espaços que vieram no dataTransfer', () => {
    const { view, insertText } = makeView(3);
    const event = makeEvent('  {{cpf}}  ');

    expect(handleVariableDrop(view as never, event)).toBe(true);
    expect(insertText).toHaveBeenCalledWith('{{cpf}}', 3);
  });

  it('texto não-token → false, sem tocar no documento (no-op)', () => {
    const { view, insertText } = makeView();
    const event = makeEvent('olá mundo');

    const result = handleVariableDrop(view as never, event);

    expect(result).toBe(false);
    expect(view.posAtCoords).not.toHaveBeenCalled();
    expect(insertText).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('sem dataTransfer → false (no-op)', () => {
    const { view } = makeView();
    const event = makeEvent(undefined);

    expect(handleVariableDrop(view as never, event)).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('drop fora do documento (posAtCoords null) → false, sem inserir', () => {
    const { view, insertText } = makeView(null);
    const event = makeEvent('{{name}}');

    const result = handleVariableDrop(view as never, event);

    expect(result).toBe(false);
    expect(insertText).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
