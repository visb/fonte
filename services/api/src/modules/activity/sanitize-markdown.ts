/**
 * Sanitização de markdown da descrição da atividade (story 72).
 *
 * O backend é a AUTORIDADE de segurança (defesa em profundidade): a descrição é
 * armazenada como markdown e renderizada no adm (MD→HTML→DOMPurify) e no ops
 * (render lib com HTML desabilitado). Mesmo assim, sanitizamos no servidor ao
 * salvar para fechar stored-XSS na origem — nenhum cliente confia no outro.
 *
 * O que esta função faz:
 * - Remove blocos de HTML bruto embutido no markdown (qualquer `<tag ...>` ou
 *   `</tag>`). Markdown legítimo (negrito, listas, links) não usa tags HTML, então
 *   removê-las não afeta o conteúdo válido — apenas neutraliza `<script>`,
 *   `<img onerror=...>`, `<iframe>`, etc.
 * - Neutraliza links markdown `[txt](url)` e `<autolink>` cujo protocolo esteja
 *   fora da allowlist (`http`, `https`, `mailto`). `javascript:`, `data:`,
 *   `vbscript:` e similares viram `[txt](#)` (ou texto puro no autolink).
 *
 * Implementado com regex/allowlist puro — sem dependência nova no backend e 100%
 * testável (ver sanitize-markdown.spec.ts).
 */

const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/** true se a URL tem protocolo seguro OU é relativa/âncora (sem `esquema:`). */
function isSafeUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  // Links relativos/âncora (`/path`, `#sec`, `path`) não carregam esquema → seguros.
  // Detecta um esquema explícito do tipo `scheme:` (RFC 3986: começa com letra).
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!schemeMatch) return true;
  return ALLOWED_LINK_PROTOCOLS.includes(schemeMatch[1].toLowerCase() + ':');
}

/**
 * Sanitiza o markdown da descrição. Devolve markdown seguro (string). `null` /
 * `undefined` passam direto (descrição ausente).
 */
export function sanitizeMarkdown(input: string | null | undefined): string | null {
  if (input == null) return null;

  let md = input;

  // 1. Neutraliza protocolo perigoso em links markdown `[texto](url "title")`.
  //    Mantém o texto, troca a URL insegura por `#`. A URL pode conter um nível
  //    de parênteses balanceados (ex.: `javascript:alert(1)`), por isso o grupo
  //    de URL aceita `(...)` internos.
  md = md.replace(
    /\[([^\]]*)\]\(\s*((?:[^()\s]|\([^()]*\))+)([^)]*)\)/g,
    (match, text: string, url: string) => {
      return isSafeUrl(url) ? match : `[${text}](#)`;
    },
  );

  // 2. Autolinks `<http://...>` / `<mailto:...>` com protocolo inseguro: rebaixa
  //    para texto puro (remove os delimitadores `<>`). Autolinks seguros seguem
  //    intactos e NÃO são tocados pelo passo 3 (têm `:` logo após o esquema, o que
  //    não casa com a regex de tag HTML).
  md = md.replace(/<([a-z][a-z0-9+.-]*:[^>\s]+)>/gi, (match, url: string) => {
    return isSafeUrl(url) ? match : url;
  });

  // 3. Remove QUALQUER tag HTML bruta restante (`<script>`, `<img ...>`,
  //    `</div>`, comentários `<!-- -->`, etc.). Markdown legítimo não precisa de
  //    tags HTML, então isto não corrompe conteúdo válido. A regex exige que o
  //    nome da tag seja seguido por espaço, `/`, `>` ou atributo — autolinks
  //    `<https:...>` (com `:` após o esquema) não casam e são preservados.
  md = md.replace(/<!--[\s\S]*?-->/g, ''); // comentários HTML
  md = md.replace(/<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>/gi, ''); // tags abertura/fechamento

  return md;
}
