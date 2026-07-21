import type { EditorView } from '@tiptap/pm/view';

// ─── templateDrop ─────────────────────────────────────────────────────────────
// Lógica pura do drag-and-drop de variáveis para o corpo do editor (story 140).
// Extraída do `editorProps.handleDrop` do TemplateEditor para ser testável sem um
// contenteditable/ProseMirror real (o jsdom não o implementa; o editor em si fica
// fora da cobertura unitária). A fonte de arraste é a VariablesPanel (story 139),
// que carrega o token literal `{{chave}}` no `dataTransfer` (`text/plain`).

// Token nu de variável: `{{chave}}` sem chaves aninhadas. Casa a string inteira
// (só o token puro que a barra arrasta) — texto arbitrário não é tratado como
// token, preservando o DnD nativo/`handlePaste` padrão.
const TOKEN_PATTERN = /^\{\{[^{}]+\}\}$/;

export function isVariableToken(text: string | null | undefined): text is string {
  return typeof text === 'string' && TOKEN_PATTERN.test(text.trim());
}

// handleDrop do ProseMirror: se o texto arrastado for um token de variável,
// insere-o na posição solta (coords do mouse) e consome o evento (`true`). Caso
// contrário devolve `false` para preservar o comportamento padrão (DnD nativo de
// texto, colar imagem via handlePaste, etc). Não altera clique/paste existentes.
export function handleVariableDrop(view: EditorView, event: DragEvent): boolean {
  const text = event.dataTransfer?.getData('text/plain');
  if (!isVariableToken(text)) return false;

  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return false;

  view.dispatch(view.state.tr.insertText(text.trim(), coords.pos));
  event.preventDefault();
  return true;
}
