import type { BibleClassGradeRow, UpsertBibleGradeInput } from '@fonte/api-client';
import { BibleGradeCell } from './BibleGradeCell';
import { formatAverage } from '../lib/bibleGradeSchema';

interface Props {
  row: BibleClassGradeRow;
  disabled?: boolean;
  onSave: (enrollmentId: string, moduleId: string, data: UpsertBibleGradeInput) => void;
}

export function BibleGradeRow({ row, disabled, onSave }: Props) {
  return (
    <tr className="border-t">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-sm font-medium whitespace-nowrap"
      >
        {row.residentName}
      </th>
      {row.modules.map((cell) => (
        <td key={cell.moduleId} className="px-2 py-2 align-top">
          <div className="flex items-start gap-1.5">
            <BibleGradeCell
              value={cell.examGrade}
              disabled={disabled}
              ariaLabel={`Prova de ${row.residentName}`}
              onSave={(value) => onSave(row.enrollmentId, cell.moduleId, { examGrade: value })}
            />
            <BibleGradeCell
              value={cell.workGrade}
              disabled={disabled}
              ariaLabel={`Trabalho de ${row.residentName}`}
              onSave={(value) => onSave(row.enrollmentId, cell.moduleId, { workGrade: value })}
            />
          </div>
          <div className="mt-0.5 text-center text-[10px] text-muted-foreground tabular-nums">
            {formatAverage(cell.moduleAverage)}
          </div>
        </td>
      ))}
      <td className="px-3 py-2 text-center text-sm font-semibold tabular-nums">
        {formatAverage(row.average)}
      </td>
    </tr>
  );
}
