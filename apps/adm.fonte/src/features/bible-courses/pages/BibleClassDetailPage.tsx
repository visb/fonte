import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import type { BibleCourseClassStatus } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useBibleClassById, useUpdateBibleClass } from '../hooks/useBibleCourses';
import { EnrollmentRow } from '../components/EnrollmentRow';
import { EnrollResidentDialog } from '../components/EnrollResidentDialog';
import { CLASS_STATUS_OPTIONS, CLASS_STATUS_BADGE, CLASS_STATUS_LABELS } from '../constants';

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function BibleClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const { data: klass, isLoading, isError, refetch } = useBibleClassById(id ?? null);
  const updateMutation = useUpdateBibleClass();

  if (isLoading) return <LoadingState />;
  if (isError || !klass) return <ErrorState onRetry={() => refetch()} />;

  const enrolledIds = klass.enrollments.map((e) => e.residentId);

  return (
    <div className="max-w-2xl space-y-6">
      <Link to="/bible-courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{klass.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${CLASS_STATUS_BADGE[klass.status]}`}>
                {CLASS_STATUS_LABELS[klass.status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {klass.houseName} · {formatDate(klass.startDate)} – {formatDate(klass.endDate)}
            </p>
            {klass.notes && <p className="text-sm mt-2">{klass.notes}</p>}
          </div>
          <select
            className="border border-input rounded-md bg-transparent px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={klass.status}
            disabled={updateMutation.isPending}
            onChange={(e) =>
              updateMutation.mutate({ id: klass.id, data: { status: e.target.value as BibleCourseClassStatus } })
            }
          >
            {CLASS_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Matrículas ({klass.enrollments.length})</h2>
          <Button size="sm" variant="outline" onClick={() => setEnrollOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            Matricular filho
          </Button>
        </div>

        {klass.enrollments.length === 0 ? (
          <EmptyState title="Nenhum filho matriculado." />
        ) : (
          <div className="space-y-1">
            {klass.enrollments.map((e) => (
              <EnrollmentRow key={e.id} classId={klass.id} enrollment={e} />
            ))}
          </div>
        )}
      </div>

      <EnrollResidentDialog
        open={enrollOpen}
        classId={klass.id}
        enrolledIds={enrolledIds}
        onClose={() => setEnrollOpen(false)}
      />
    </div>
  );
}
