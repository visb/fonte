import type { BibleClassGrades, UpsertBibleGradeInput } from '@fonte/api-client';
import { BibleGradeRow } from './BibleGradeRow';

interface Props {
  grades: BibleClassGrades;
  disabled?: boolean;
  onSave: (enrollmentId: string, moduleId: string, data: UpsertBibleGradeInput) => void;
}

export function BibleGradesTable({ grades, disabled, onSave }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">
              Filho
            </th>
            {grades.modules.map((m) => (
              <th key={m.id} className="px-2 py-2 text-center text-xs font-semibold">
                <div className="whitespace-nowrap">{m.name}</div>
                <div className="mt-0.5 font-normal text-muted-foreground">Prova · Trabalho</div>
              </th>
            ))}
            <th className="px-3 py-2 text-center text-xs font-semibold whitespace-nowrap">Média</th>
          </tr>
        </thead>
        <tbody>
          {grades.rows.map((row) => (
            <BibleGradeRow key={row.enrollmentId} row={row} disabled={disabled} onSave={onSave} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
