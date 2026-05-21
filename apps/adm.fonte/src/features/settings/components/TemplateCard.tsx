import type { DocumentTemplate } from '@fonte/api-client';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  template: DocumentTemplate;
  onSelect: () => void;
  onDelete: () => void;
}

export function TemplateCard({ template: t, onSelect, onDelete }: Props) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{t.name}</span>
          {t.isRequired && (
            <Badge variant="secondary" className="text-xs shrink-0">Acolhimento</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Atualizado em {new Date(t.updatedAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-destructive hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
