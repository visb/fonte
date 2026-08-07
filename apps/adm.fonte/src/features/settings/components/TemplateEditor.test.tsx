import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DocumentTemplate } from '@fonte/api-client';
import { TemplateAvailability } from '@fonte/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────
// O TipTap real exige um contenteditable/ProseMirror que o jsdom não implementa
// (por isso o TemplateEditor é excluído da cobertura unitária). Aqui só nos
// importa a montagem do componente: que a barra de variáveis (story 139) é
// renderizada e que o antigo grid de rodapé sumiu — sem editor real.

const chainStub: Record<string, unknown> = {};
['focus', 'insertContent', 'setMark', 'run'].forEach((m) => {
  chainStub[m] = () => chainStub;
});

const stubEditor = {
  getAttributes: () => ({}),
  isActive: () => false,
  getHTML: () => '<p></p>',
  commands: { setContent: vi.fn() },
  chain: () => chainStub,
};

vi.mock('@tiptap/react', () => ({
  useEditor: () => stubEditor,
  EditorContent: () => <div data-testid="editor-content" />,
  NodeViewWrapper: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ReactNodeViewRenderer: () => () => null,
}));

const updateMutate = vi.fn();
vi.mock('../hooks/useDocumentTemplates', () => ({
  useUpdateDocumentTemplate: () => ({ mutate: updateMutate, isPending: false, isError: false, error: null }),
}));

vi.mock('./TableToolbar', () => ({ TableToolbar: () => null }));
vi.mock('./LinkToolbar', () => ({ LinkToolbar: () => null }));
vi.mock('./LinkBubbleMenu', () => ({ LinkBubbleMenu: () => null }));
vi.mock('./TableBlockMenu', () => ({ TableBlockMenu: () => null }));

import { TemplateEditor } from './TemplateEditor';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function template(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 't1',
    name: 'Termo de Acolhimento',
    isRequired: false,
    signAtAdmission: false,
    availableFor: TemplateAvailability.ALL,
    updatedAt: '2026-06-01T12:00:00.000Z',
    content: '<p>Oi</p>',
    ...overrides,
  } as DocumentTemplate;
}

describe('TemplateEditor — barra de variáveis (story 139)', () => {
  it('renderiza o VariablesPanel (aba recolhida à direita)', () => {
    render(<TemplateEditor template={template()} onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Variáveis/i })).toBeInTheDocument();
  });

  it('não renderiza mais o grid de variáveis no rodapé', () => {
    render(<TemplateEditor template={template()} onSaved={vi.fn()} />);
    // Cabeçalho do antigo bloco de rodapé.
    expect(
      screen.queryByText(/Variáveis disponíveis — clique para inserir no editor/i),
    ).not.toBeInTheDocument();
    // Barra recolhida por default → nenhuma chave visível (sem duplicidade).
    expect(screen.queryByText('{{name}}')).not.toBeInTheDocument();
  });
});

// ─── Disponibilidade por status do filho (story 160) ─────────────────────────

describe('TemplateEditor — disponível para (story 160)', () => {
  function radio(label: RegExp | string) {
    return screen.getByRole('radio', { name: label }) as HTMLInputElement;
  }

  it('renderiza os três rádios marcando o valor atual do template', () => {
    render(<TemplateEditor template={template({ availableFor: TemplateAvailability.ACTIVE_ONLY })} onSaved={vi.fn()} />);
    expect(radio('Todos').checked).toBe(false);
    expect(radio('Só filhos ativos').checked).toBe(true);
    expect(radio('Só filhos não-ativos').checked).toBe(false);
  });

  it('template sem o campo (legado) nasce em Todos', () => {
    render(<TemplateEditor template={template({ availableFor: undefined as never })} onSaved={vi.fn()} />);
    expect(radio('Todos').checked).toBe(true);
  });

  it('salvar envia o availableFor escolhido no payload', async () => {
    render(<TemplateEditor template={template()} onSaved={vi.fn()} />);
    fireEvent.click(radio('Só filhos não-ativos'));
    fireEvent.click(screen.getByRole('button', { name: /Salvar template/ }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0]).toMatchObject({
      id: 't1',
      data: { availableFor: TemplateAvailability.INACTIVE_ONLY },
    });
  });

  it('sem mexer no rádio, salvar preserva o valor que veio do template', async () => {
    render(<TemplateEditor template={template({ availableFor: TemplateAvailability.ACTIVE_ONLY })} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Salvar template/ }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].data.availableFor).toBe(TemplateAvailability.ACTIVE_ONLY);
  });
});
