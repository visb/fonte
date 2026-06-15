import { Pencil, Trash2 } from 'lucide-react';
import type { BibleCourseModule } from '@fonte/api-client';
import { Button } from '@/components/ui/button';

interface Props {
  module: BibleCourseModule;
  onEdit: (module: BibleCourseModule) => void;
  onDelete: (module: BibleCourseModule) => void;
}

export function BibleModuleRow({ module, onEdit, onDelete }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <span className="w-6 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
        {module.sequence}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{module.name}</span>
        {module.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{module.notes}</p>
        )}
      </div>
      <Button variant="ghost" size="icon" title="Editar" onClick={() => onEdit(module)}>
        <Pencil size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        title="Excluir"
        onClick={() => onDelete(module)}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
