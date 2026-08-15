import { Plus } from 'lucide-react';
import type { DocumentTemplate } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { TemplateCard } from './TemplateCard';

interface Props {
  title: string;
  hint: string;
  emptyTitle: string;
  createLabel: string;
  templates: DocumentTemplate[];
  onCreate: () => void;
  onSelect: (template: DocumentTemplate) => void;
  onDelete: (template: DocumentTemplate) => void;
}

/**
 * Story 178 — um grupo da aba de Templates (documentos do acolhido ou recibos).
 * Extraído para que a aba fique com a orquestração e não com duas cópias do
 * mesmo cabeçalho + lista.
 */
export function TemplateGroupSection({
  title, hint, emptyTitle, createLabel, templates, onCreate, onSelect, onDelete,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button size="sm" onClick={onCreate} className="shrink-0">
          <Plus size={14} className="mr-1.5" />
          {createLabel}
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onSelect={() => onSelect(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
