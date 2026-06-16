import type { ListPayablesParams } from '@fonte/api-client';
import { PayableCategory, PayableStatus } from '@fonte/types';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  PAYABLE_CATEGORIES,
  PAYABLE_CATEGORY_LABELS,
  PAYABLE_STATUS_LABELS,
} from '../constants';

interface Props {
  filters: ListPayablesParams;
  onChange: (filters: ListPayablesParams) => void;
}

export function PayablesFilters({ filters, onChange }: Props) {
  const update = (patch: Partial<ListPayablesParams>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <div className="space-y-1">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          id="filter-status"
          value={filters.status ?? ''}
          onChange={(e) =>
            update({ status: (e.target.value || undefined) as PayableStatus | undefined })
          }
        >
          <option value="">Todos</option>
          {Object.values(PayableStatus).map((s) => (
            <option key={s} value={s}>
              {PAYABLE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-category">Categoria</Label>
        <Select
          id="filter-category"
          value={filters.category ?? ''}
          onChange={(e) =>
            update({ category: (e.target.value || undefined) as PayableCategory | undefined })
          }
        >
          <option value="">Todas</option>
          {PAYABLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PAYABLE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-from">Vencimento de</Label>
        <Input
          id="filter-from"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => update({ from: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-to">Vencimento até</Label>
        <Input
          id="filter-to"
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => update({ to: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
