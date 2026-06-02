import { Link } from 'react-router-dom';
import { Pencil, Trash2, Users } from 'lucide-react';
import type { BibleCourseClass } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { CLASS_STATUS_LABELS, CLASS_STATUS_BADGE } from '../constants';

interface Props {
  klass: BibleCourseClass;
  onEdit: (klass: BibleCourseClass) => void;
  onDelete: (klass: BibleCourseClass) => void;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function BibleClassCard({ klass, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Link to={`/bible-courses/${klass.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{klass.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${CLASS_STATUS_BADGE[klass.status]}`}>
            {CLASS_STATUS_LABELS[klass.status]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {klass.houseName} · {formatDate(klass.startDate)} – {formatDate(klass.endDate)}
          <span className="inline-flex items-center gap-1 ml-2">
            <Users size={12} /> {klass.enrollmentCount}
          </span>
        </p>
      </Link>
      <Button variant="ghost" size="icon" title="Editar" onClick={() => onEdit(klass)}>
        <Pencil size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        title="Excluir"
        onClick={() => onDelete(klass)}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
