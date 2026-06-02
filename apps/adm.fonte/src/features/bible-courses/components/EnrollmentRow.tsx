import { Check, RotateCcw, Trash2, X } from 'lucide-react';
import type { BibleCourseEnrollment } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { useUpdateEnrollment, useRemoveEnrollment } from '../hooks/useBibleCourses';
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_BADGE } from '../constants';

interface Props {
  classId: string;
  enrollment: BibleCourseEnrollment;
}

export function EnrollmentRow({ classId, enrollment }: Props) {
  const updateMutation = useUpdateEnrollment(classId);
  const removeMutation = useRemoveEnrollment(classId);
  const busy = updateMutation.isPending || removeMutation.isPending;

  const setStatus = (status: BibleCourseEnrollment['status']) =>
    updateMutation.mutate({ id: enrollment.id, data: { status } });

  return (
    <div className="flex items-center justify-between border rounded px-3 py-2">
      <div className="min-w-0">
        <span className="text-sm font-medium">{enrollment.residentName}</span>
        {enrollment.residentHouseName && (
          <p className="text-xs text-muted-foreground truncate">{enrollment.residentHouseName}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full ${ENROLLMENT_STATUS_BADGE[enrollment.status]}`}>
          {ENROLLMENT_STATUS_LABELS[enrollment.status]}
        </span>
        {enrollment.status === 'ENROLLED' ? (
          <>
            <Button variant="ghost" size="icon" title="Concluir" disabled={busy} onClick={() => setStatus('COMPLETED')}>
              <Check size={15} className="text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" title="Marcar desistência" disabled={busy} onClick={() => setStatus('DROPPED')}>
              <X size={15} className="text-amber-600" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" title="Reverter para matriculado" disabled={busy} onClick={() => setStatus('ENROLLED')}>
            <RotateCcw size={15} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          title="Remover matrícula"
          disabled={busy}
          onClick={() => removeMutation.mutate(enrollment.id)}
        >
          <Trash2 size={15} />
        </Button>
      </div>
    </div>
  );
}
