import { useMemo } from 'react';
import { markdownToSafeHtml } from '../lib/markdown';

interface Props {
  /** Descrição em markdown (ou null/'' quando ausente). */
  markdown: string | null | undefined;
}

/**
 * Render read-only da descrição da atividade (story 72). Converte o markdown em
 * HTML SANITIZADO (DOMPurify) e injeta. Stored-XSS fechado: nunca confiamos no
 * conteúdo salvo — sanitiza no render mesmo já sendo sanitizado no backend.
 */
export function ActivityDescriptionView({ markdown }: Props) {
  const html = useMemo(
    () => (markdown ? markdownToSafeHtml(markdown) : ''),
    [markdown],
  );

  if (!html) {
    return <p className="text-sm italic text-muted-foreground">Sem descrição.</p>;
  }

  return (
    <div
      data-testid="activity-description-view"
      className="prose prose-sm max-w-none text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold"
      // HTML já sanitizado por markdownToSafeHtml (marked sem HTML bruto + DOMPurify).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
