import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useCensusPending,
  useApproveAllCensus,
  useRejectCensusResident,
} from '../hooks/useCensus';
import { CensusReviewRow } from './CensusReviewRow';

interface Props {
  houseId: string;
  houseName?: string;
  open: boolean;
  onClose: () => void;
}

export function CensusReviewModal({ houseId, houseName, open, onClose }: Props) {
  const { data: pending = [], isLoading, error } = useCensusPending(houseId, { enabled: open });
  const approveAll = useApproveAllCensus(houseId);
  const reject = useRejectCensusResident(houseId);
  const [actionError, setActionError] = useState('');

  const busy = approveAll.isPending || reject.isPending;

  async function handleApproveAll() {
    setActionError('');
    try {
      await approveAll.mutateAsync();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Erro ao aprovar.'));
    }
  }

  async function handleReject(id: string) {
    setActionError('');
    try {
      await reject.mutateAsync(id);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Erro ao negar.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revisar contagem{houseName ? ` — ${houseName}` : ''}</DialogTitle>
          <DialogDescription>
            Filhos adicionados durante a contagem, aguardando aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={getErrorMessage(error, 'Erro ao carregar.')} />
          ) : pending.length === 0 ? (
            <EmptyState title="Nenhum filho pendente." />
          ) : (
            pending.map((resident) => (
              <CensusReviewRow
                key={resident.id}
                resident={resident}
                onReject={handleReject}
                disabled={busy}
              />
            ))
          )}
        </div>

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Fechar
          </Button>
          <Button
            className="gap-1"
            disabled={busy || pending.length === 0}
            onClick={handleApproveAll}
          >
            <CheckCheck size={14} /> Aprovar todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
