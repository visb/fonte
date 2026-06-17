import { Pencil } from 'lucide-react';
import type { BibleClassGrades, BibleClassGradeModuleColumn } from '@fonte/api-client';
import { BibleGradeRow } from './BibleGradeRow';

interface Props {
  grades: BibleClassGrades;
  /** Abre o lançamento de notas do módulo (cabeçalho clicável). */
  onSelectModule: (module: BibleClassGradeModuleColumn) => void;
}

export function BibleGradesTable({ grades, onSelectModule }: Props) {
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
                <button
                  type="button"
                  onClick={() => onSelectModule(m)}
                  aria-label={`Lançar notas — ${m.name}`}
                  title={`Lançar notas — ${m.name}`}
                  className="mx-auto flex flex-col items-center gap-0.5 rounded-md px-2 py-1 hover:bg-accent transition-colors"
                >
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    {m.name}
                    <Pencil size={11} className="text-muted-foreground" />
                  </span>
                  <span className="font-normal text-muted-foreground">Prova · Trabalho</span>
                </button>
              </th>
            ))}
            <th className="px-3 py-2 text-center text-xs font-semibold whitespace-nowrap">Média</th>
          </tr>
        </thead>
        <tbody>
          {grades.rows.map((row) => (
            <BibleGradeRow key={row.enrollmentId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
