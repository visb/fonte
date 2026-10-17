import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDraftDateTime } from '../../lib/admissionDraft';

interface DraftResumeBannerProps {
  /** Nome do filho no rascunho (vazio → "sem nome"). */
  name?: string | null;
  /** ISO do último salvamento. */
  savedAt: string;
  onContinue: () => void;
  onDiscard: () => void;
}

/** Story 211 (decisão 6): oferece retomar ou descartar um acolhimento não concluído. */
export function DraftResumeBanner({ name, savedAt, onContinue, onDiscard }: DraftResumeBannerProps) {
  const label = name?.trim() ? name.trim() : 'sem nome';
  return (
    <div
      role="region"
      aria-label="Rascunho de acolhimento"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
    >
      <div className="flex items-start gap-3">
        <History size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1 space-y-3">
          <p className="text-sm">
            Há um acolhimento não concluído de <span className="font-semibold">{label}</span>,
            salvo em <span className="font-semibold">{formatDraftDateTime(savedAt)}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onContinue}>
              Continuar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onDiscard}>
              Descartar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
