// Subconjunto mínimo de markdown usado pelo changelog: títulos (## / ###),
// listas (- / *) e parágrafos, com **negrito** e `código` inline.
//
// Parser próprio em vez de lib + dangerouslySetInnerHTML: o conteúdo é nosso,
// o formato é pequeno, e devolver blocos tipados deixa o React montar a árvore
// sem nunca injetar HTML cru na página.

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'code'; text: string };

export type MarkdownBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export function parseInline(text: string): InlineSegment[] {
  return text
    .split(INLINE)
    .filter((part) => part !== '')
    .map((part): InlineSegment => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { kind: 'strong', text: part.slice(2, -2) };
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return { kind: 'code', text: part.slice(1, -1) };
      }
      return { kind: 'text', text: part };
    });
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let list: string[] | null = null;
  let paragraph: string[] | null = null;

  const flush = () => {
    if (list) blocks.push({ kind: 'list', items: list });
    if (paragraph) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    list = null;
    paragraph = null;
  };

  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    const item = /^[-*]\s+(.+)$/.exec(line);

    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1].length as 2 | 3, text: heading[2] });
    } else if (item) {
      if (paragraph) flush();
      list = list ?? [];
      list.push(item[1]);
    } else {
      if (list) flush();
      paragraph = paragraph ?? [];
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
