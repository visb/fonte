import { Search } from 'lucide-react';
import type { StaffListStatus } from '@fonte/types';
import { Input } from '@/components/ui/input';
import { HouseFilterSelect } from '@/components/shared/HouseFilterSelect';
import { StaffStatusFilter } from './StaffStatusFilter';

interface StaffFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StaffListStatus;
  onStatusChange: (value: StaffListStatus) => void;
  houseId: string;
  onHouseIdChange: (value: string) => void;
  /** Só o ADMIN escolhe casa (o COORDINATOR já é escopado à própria). */
  showHouseFilter: boolean;
}

/** Story 223 — busca (nome/CPF), Ativos | Desligados e casa da lista de servos. */
export function StaffFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  houseId,
  onHouseIdChange,
  showHouseFilter,
}: StaffFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar servos"
          placeholder="Buscar por nome ou CPF..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {showHouseFilter && <HouseFilterSelect value={houseId} onChange={onHouseIdChange} />}

      <StaffStatusFilter value={status} onChange={onStatusChange} />
    </div>
  );
}
