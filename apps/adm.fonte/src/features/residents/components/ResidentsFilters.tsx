import { Search } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RESIDENT_STATUS_LABELS } from '../constants';

interface ResidentsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: ResidentStatus | '';
  onStatusChange: (value: ResidentStatus | '') => void;
  overdueContribution: boolean;
  onOverdueContributionChange: (value: boolean) => void;
}

export function ResidentsFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  overdueContribution,
  onOverdueContributionChange,
}: ResidentsFiltersProps) {
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
