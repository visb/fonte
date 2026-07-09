import { CheckCheck, Loader2, Square } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { ApproveAllProgress } from '../../hooks/useBulkImport';
import {
  approveAllConfirmDescription,
  approveAllProgressLabel,
  approveAllSummary,
  IMPORT_TEXTS,
} from '../../constants';

interface ImportApproveAllProps {
  /** Fichas `ready` aguardando aprovação — o botão só habilita com > 0. */
  pendingCount: number;
  progress: ApproveAllProgress | null;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Botão "Aprovar todos" da fila de import em lote: confirma a ação em massa,
 * mostra o progresso item a item enquanto roda (com opção de parar) e o resumo
 * final (aprovadas/puladas/erros) ao concluir.
 */
export function ImportApproveAll({
  pendingCount,
  progress,
  isRunning,
  onStart,
  onStop,
}: ImportApproveAllProps) {
  if (isRunning) {
    return (
      <div className="flex items-center gap-3" data-testid="approve-all-running">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          {approveAllProgressLabel(progress?.done ?? 0, progress?.total ?? 0)}
        </span>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onStop}>
          <Square size={12} />
          {IMPORT_TEXTS.approveAllStop}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {progress && (
        <span className="text-sm text-muted-foreground" data-testid="approve-all-summary">
          {approveAllSummary(progress.approved, progress.skipped, progress.failed)}
        </span>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" className="gap-1" disabled={pendingCount === 0}>
            <CheckCheck size={14} />
            {IMPORT_TEXTS.approveAll}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{IMPORT_TEXTS.approveAllConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {approveAllConfirmDescription(pendingCount)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{IMPORT_TEXTS.approveAllCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={onStart}>
              {IMPORT_TEXTS.approveAllConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
