import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Ponte markdown → HTML sanitizado para render read-only da descrição (story 72).
 *
 * Defesa em profundidade: mesmo a descrição já tendo sido sanitizada no backend
 * ao salvar, NUNCA injetamos markdown convertido sem sanitizar de novo no
 * cliente. Pipeline: marked (HTML bruto DESABILITADO) → DOMPurify (allowlist de
 * tags/atributos + protocolos http/https/mailto).
 */

// marked síncrono, sem HTML bruto embutido. `async:false` garante string (não
// Promise). Quebras de linha simples viram <br> (UX de descrição).
marked.setOptions({ async: false, breaks: true, gfm: true });

// Tags permitidas no render da descrição: formatação básica + listas + links.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'del', 's',
  'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

/**
 * Converte markdown → HTML sanitizado, pronto para `dangerouslySetInnerHTML`.
 * Força links externos a abrir em nova aba com `rel` seguro. Protocolos perigosos
 * (`javascript:`, `data:`, etc.) são barrados pelo DOMPurify (allowlist padrão
 * só permite http/https/mailto/tel e afins).
 */
export function markdownToSafeHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown) as string;
  const clean = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Bloqueia qualquer URI cujo esquema não esteja na allowlist segura.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
  return clean;
}

// Hook do DOMPurify (registrado uma vez) para endurecer todos os links: adiciona
// target/rel seguros. Idempotente — só adiciona o hook na primeira importação.
let hookAdded = false;
if (!hookAdded) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
  hookAdded = true;
}
