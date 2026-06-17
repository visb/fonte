import type { ListActivitiesParams } from '@fonte/api-client';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useStaff } from '@/features/staff/hooks/useStaff';

interface Props {
  filters: ListActivitiesParams;
  onChange: (filters: ListActivitiesParams) => void;
  /** ADMIN pode filtrar por casa; demais já são travados na própria casa. */
  showHouseFilter: boolean;
}

export function ActivityFilters({ filters, onChange, showHouseFilter }: Props) {
  const { data: houses = [] } = useHouses();
  const { data: staff = [] } = useStaff();

  const update = (patch: Partial<ListActivitiesParams>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {showHouseFilter && (
        <div className="space-y-1">
          <Label htmlFor="activity-filter-house">Casa</Label>
          <Select
            id="activity-filter-house"
            value={filters.houseId ?? ''}
            onChange={(e) => update({ houseId: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="activity-filter-responsible">Responsável</Label>
        <Select
          id="activity-filter-responsible"
          value={filters.responsibleStaffId ?? ''}
          onChange={(e) => update({ responsibleStaffId: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
