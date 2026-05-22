import { Search } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RESIDENT_STATUS_LABELS } from '../constants';

interface ResidentsFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: ResidentStatus | '';
  onStatusChange: (value: ResidentStatus | '') => void;
}

export function ResidentsFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
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
    </div>
  );
}
