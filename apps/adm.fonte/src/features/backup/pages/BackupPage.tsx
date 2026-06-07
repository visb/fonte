import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useBackups, useRunBackup } from '../hooks/useBackups';
import { BackupRow } from '../components/BackupRow';

export function BackupPage() {
  const { data: backups = [], isLoading, isError, refetch } = useBackups();
  const runMutation = useRunBackup();

  const result = runMutation.data;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Backup"
        description="Backup semanal do banco e dos arquivos (domingos 04:00). Os 4 backups mais recentes são mantidos."
        actions={
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            <Play size={14} className="mr-1.5" />
            {runMutation.isPending ? 'Rodando…' : 'Fazer backup agora'}
          </Button>
        }
      />

      {runMutation.isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {getErrorMessage(runMutation.error, 'Falha ao rodar o backup.')}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          {result.skipped
            ? `Backup não executado: ${result.reason ?? 'pulado'}.`
            : `Backup concluído: dump criado, ${result.filesCopied ?? 0} de ${
                result.filesTotal ?? 0
              } arquivos copiados.`}
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : backups.length === 0 ? (
        <EmptyState title="Nenhum backup ainda." />
      ) : (
        <div className="space-y-2">
          {backups.map((b) => (
            <BackupRow key={b.key} backup={b} />
          ))}
        </div>
      )}
    </div>
  );
}
