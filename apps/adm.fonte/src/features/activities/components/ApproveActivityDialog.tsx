import { useEffect, useState } from 'react';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/errors';
import { useStaff } from '@/features/staff/hooks/useStaff';
import { useChangeActivityStatus } from '../hooks/useActivities';

interface Props {
  open: boolean;
  activity: Activity | null;
  onClose: () => void;
}

/** Aprovação (solicitações → a fazer): só ADMIN, exige escolher o responsável. */
export function ApproveActivityDialog({ open, activity, onClose }: Props) {
  const { data: staff = [] } = useStaff({ enabled: open });
  const mutation = useChangeActivityStatus();
  const [responsibleStaffId, setResponsibleStaffId] = useState('');

  useEffect(() => {
    if (open) setResponsibleStaffId(activity?.responsibleStaffId ?? '');
  }, [open, activity]);

  const handleApprove = () => {
    if (!activity || !responsibleStaffId) return;
    mutation.mutate(
      {
        id: activity.id,
        data: { status: ActivityStatus.TODO, responsibleStaffId },
      },
      {
        onSuccess: () => {
          mutation.reset();
          onClose();
        },
      },
    );
  };

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aprovar atividade</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{activity?.title}</p>
          <div className="space-y-1">
            <Label htmlFor="approve-responsible">Responsável *</Label>
            <Select
              id="approve-responsible"
              value={responsibleStaffId}
              onChange={(e) => setResponsibleStaffId(e.target.value)}
            >
              <option value="" disabled>
                Selecione um responsável
              </option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          {mutation.error != null && (
            <p className="text-xs text-destructive">
              {getErrorMessage(mutation.error, 'Erro ao aprovar atividade.')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!responsibleStaffId || mutation.isPending}
            onClick={handleApprove}
          >
            {mutation.isPending ? 'Aprovando...' : 'Aprovar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
