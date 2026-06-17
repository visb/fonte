import { useEffect, useState } from 'react';
import type {
  BibleClassGradeModuleColumn,
  BibleClassGradeRow,
  UpsertBibleGradeInput,
} from '@fonte/api-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatGrade, parseGradeCell } from '../lib/bibleGradeSchema';

export interface ModuleGradeChange {
  enrollmentId: string;
  data: UpsertBibleGradeInput;
}

interface Props {
  open: boolean;
  module: BibleClassGradeModuleColumn | null;
  rows: BibleClassGradeRow[];
  isPending?: boolean;
  error?: unknown;
  onClose: () => void;
  onSave: (changes: ModuleGradeChange[]) => void;
}

interface DraftEntry {
  exam: string;
  work: string;
}

type Draft = Record<string, DraftEntry>;

function cellFor(row: BibleClassGradeRow, moduleId: string) {
  return row.modules.find((m) => m.moduleId === moduleId) ?? null;
}

function buildDraft(rows: BibleClassGradeRow[], moduleId: string): Draft {
  const draft: Draft = {};
  for (const row of rows) {
    const cell = cellFor(row, moduleId);
    draft[row.enrollmentId] = {
      exam: formatGrade(cell?.examGrade ?? null),
      work: formatGrade(cell?.workGrade ?? null),
    };
  }
  return draft;
}

export function BibleModuleGradesDialog({
  open,
  module,
  rows,
  isPending,
  error,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Draft>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Recarrega os rascunhos sempre que o módulo (ou os dados) mudam.
  useEffect(() => {
    if (open && module) {
      setDraft(buildDraft(rows, module.id));
      setFieldErrors({});
    }
  }, [open, module, rows]);

  if (!module) return null;

  const setField = (enrollmentId: string, key: keyof DraftEntry, value: string) => {
    setDraft((prev) => ({ ...prev, [enrollmentId]: { ...prev[enrollmentId], [key]: value } }));
  };

  const handleSave = () => {
    const errors: Record<string, string> = {};
    const changes: ModuleGradeChange[] = [];

    for (const row of rows) {
      const cell = cellFor(row, module.id);
      const entry = draft[row.enrollmentId] ?? { exam: '', work: '' };

      const parsedExam = parseGradeCell(entry.exam);
      const parsedWork = parseGradeCell(entry.work);

      if ('error' in parsedExam) errors[`${row.enrollmentId}:exam`] = parsedExam.error;
      if ('error' in parsedWork) errors[`${row.enrollmentId}:work`] = parsedWork.error;
      if ('error' in parsedExam || 'error' in parsedWork) continue;

      const examChanged = parsedExam.value !== (cell?.examGrade ?? null);
      const workChanged = parsedWork.value !== (cell?.workGrade ?? null);
      if (examChanged || workChanged) {
        changes.push({
          enrollmentId: row.enrollmentId,
          data: { examGrade: parsedExam.value, workGrade: parsedWork.value },
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onSave(changes);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar notas — {module.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
          <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
            <span>Filho</span>
            <span className="text-center">Prova</span>
            <span className="text-center">Trabalho</span>
          </div>
          {rows.map((row) => {
            const entry = draft[row.enrollmentId] ?? { exam: '', work: '' };
            const examError = fieldErrors[`${row.enrollmentId}:exam`];
            const workError = fieldErrors[`${row.enrollmentId}:work`];
            return (
              <div
                key={row.enrollmentId}
                className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 px-1"
              >
                <span className="truncate text-sm" title={row.residentName}>
                  {row.residentName}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Prova de ${row.residentName}`}
                  aria-invalid={examError ? true : undefined}
                  disabled={isPending}
                  value={entry.exam}
                  onChange={(e) => setField(row.enrollmentId, 'exam', e.target.value)}
                  className={cn(
                    'h-9 w-full rounded-md border bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                    examError ? 'border-destructive' : 'border-input',
                  )}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Trabalho de ${row.residentName}`}
                  aria-invalid={workError ? true : undefined}
                  disabled={isPending}
                  value={entry.work}
                  onChange={(e) => setField(row.enrollmentId, 'work', e.target.value)}
                  className={cn(
                    'h-9 w-full rounded-md border bg-background px-2 text-center text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                    workError ? 'border-destructive' : 'border-input',
                  )}
                />
              </div>
            );
          })}
        </div>

        {Object.keys(fieldErrors).length > 0 && (
          <p className="text-xs text-destructive">Notas devem estar entre 0 e 10.</p>
        )}
        {error != null && (
          <p className="text-xs text-destructive">Erro ao salvar notas. Tente novamente.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
