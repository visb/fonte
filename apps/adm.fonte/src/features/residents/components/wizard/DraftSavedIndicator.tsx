import { formatDraftTime } from '../../lib/admissionDraft';

/** Story 211 (decisão 11): indicador discreto do último salvamento do rascunho. */
export function DraftSavedIndicator({ savedAt }: { savedAt: string | null }) {
  if (!savedAt) return null;
  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      Rascunho salvo às {formatDraftTime(savedAt)}
    </p>
  );
}
