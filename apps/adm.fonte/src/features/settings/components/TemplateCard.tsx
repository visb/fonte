import type { DocumentTemplate } from '@fonte/api-client';
import { Trash2 } from 'lucide-react';
import { RECEIPT_TYPE_LABELS, TemplateKind } from '@fonte/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TEMPLATE_AVAILABILITY_BADGE } from '../constants';

interface Props {
  template: DocumentTemplate;
  onSelect: () => void;
  onDelete: () => void;
}

export function TemplateCard({ template: t, onSelect, onDelete }: Props) {
  // Story 160 — só sinaliza a restrição; ALL (o padrão) não vira ruído visual.
  const availabilityLabel = TEMPLATE_AVAILABILITY_BADGE[t.availableFor];
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
          {/* Story 212 — o tipo do recibo à vista: é ele que o gerador procura. */}
          {t.kind === TemplateKind.RECEIPT && t.receiptType && (
            <Badge variant="outline" className="text-xs shrink-0">
              {RECEIPT_TYPE_LABELS[t.receiptType]}
            </Badge>
          )}
          {availabilityLabel && (
            <Badge variant="outline" className="text-xs shrink-0">{availabilityLabel}</Badge>
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
