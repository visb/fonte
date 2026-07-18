import { Search } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { RESIDENT_STATUS_LABELS, RESIDENT_SORT_OPTIONS, type ResidentSortOption } from '../constants';

interface ResidentsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: ResidentStatus | '';
  onStatusChange: (value: ResidentStatus | '') => void;
  houseId: string;
  onHouseIdChange: (value: string) => void;
  overdueContribution: boolean;
  onOverdueContributionChange: (value: boolean) => void;
  sort: ResidentSortOption;
  onSortChange: (value: ResidentSortOption) => void;
}

export function ResidentsFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  houseId,
  onHouseIdChange,
  overdueContribution,
  onOverdueContributionChange,
  sort,
  onSortChange,
}: ResidentsFiltersProps) {
  const { data: houses = [] } = useHouses();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as ResidentStatus | '')}
        className="w-full sm:w-48"
      >
        <option value="">Todos os status</option>
        {Object.values(ResidentStatus).map((s) => (
          <option key={s} value={s}>
            {RESIDENT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        value={houseId}
        onChange={(e) => onHouseIdChange(e.target.value)}
        className="w-full sm:w-48"
      >
        <option value="">Todas as casas</option>
        {houses.map((house) => (
          <option key={house.id} value={house.id}>
            {house.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Ordenar por"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as ResidentSortOption)}
        className="w-full sm:w-48"
      >
        {RESIDENT_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Button
        variant={overdueContribution ? 'destructive' : 'outline'}
        size="sm"
        onClick={() => onOverdueContributionChange(!overdueContribution)}
        className="w-full sm:w-auto whitespace-nowrap"
      >
        Contribuição em atraso
      </Button>
    </div>
  );
}
