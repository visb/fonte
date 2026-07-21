import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DocumentTemplate } from '@fonte/api-client';

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

vi.mock('../hooks/useDocumentTemplates', () => ({
  useUpdateDocumentTemplate: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

vi.mock('./TableToolbar', () => ({ TableToolbar: () => null }));
vi.mock('./LinkToolbar', () => ({ LinkToolbar: () => null }));
vi.mock('./LinkBubbleMenu', () => ({ LinkBubbleMenu: () => null }));
vi.mock('./TableBlockMenu', () => ({ TableBlockMenu: () => null }));

import { TemplateEditor } from './TemplateEditor';

afterEach(() => cleanup());

function template(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 't1',
    name: 'Termo de Acolhimento',
    isRequired: false,
    signAtAdmission: false,
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
