import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, createEvent, fireEvent, waitFor } from '@testing-library/react';

import { ActivityDescriptionEditor } from './ActivityDescriptionEditor';

afterEach(() => cleanup());

// Story 143 — bug de produto: ao clicar "Negrito" (toolbar) com o cursor vazio e
// digitar, o 1º caractere saía SEM negrito. Causa: o <button> da toolbar não
// prevenia o default do mousedown, então o mousedown tirava o foco do
// contenteditable e colapsava a seleção; o stored mark do TipTap não pegava o
// 1º char. Fix: onMouseDown preventDefault em todos os botões da toolbar.
describe('ActivityDescriptionEditor — toolbar preserva foco (story 143)', () => {
  async function renderEditor() {
    render(<ActivityDescriptionEditor value="" onChange={vi.fn()} />);
    // useEditor inicializa via efeito; espera a toolbar aparecer.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Negrito' })).toBeInTheDocument());
  }

  it('mousedown no botão Negrito chama preventDefault (não perde foco/seleção)', async () => {
    await renderEditor();
    const bold = screen.getByRole('button', { name: 'Negrito' });
    const ev = createEvent.mouseDown(bold);
    fireEvent(bold, ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('mousedown preventDefault vale para todos os botões de mark/nó da toolbar', async () => {
    await renderEditor();
    for (const name of ['Itálico', 'Lista com marcadores', 'Lista numerada', 'Inserir/editar link']) {
      const btn = screen.getByRole('button', { name });
      const ev = createEvent.mouseDown(btn);
      fireEvent(btn, ev);
      expect(ev.defaultPrevented, `botão "${name}"`).toBe(true);
    }
  });

  // O comportamento fim-a-fim (1º caractere já sai em negrito ao clicar Negrito
  // com cursor vazio e digitar) depende de um contenteditable real de browser e
  // é coberto pelo e2e activities.spec.ts (o editor está excluído da cobertura
  // unitária justamente por isso). Aqui garantimos o contrato do fix: o mousedown
  // dos botões da toolbar não deixa o editor perder foco/seleção.
});
