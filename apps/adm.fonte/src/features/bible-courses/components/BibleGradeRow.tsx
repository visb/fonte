import type { BibleClassGradeRow } from '@fonte/api-client';
import { formatAverage, formatGrade } from '../lib/bibleGradeSchema';

interface Props {
  row: BibleClassGradeRow;
}

function gradeText(value: number | null): string {
  return formatGrade(value) || '–';
}

export function BibleGradeRow({ row }: Props) {
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
          <div className="text-center text-sm tabular-nums whitespace-nowrap">
            {gradeText(cell.examGrade)} · {gradeText(cell.workGrade)}
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
