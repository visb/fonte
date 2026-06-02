import { Home, MapPin, Pencil, Phone, Trash2, User } from 'lucide-react';
import { api } from '@/lib/api';
import type { House } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { houseChildVacancies } from '../utils';

interface Props {
  house: House;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function HouseCard({ house, onNavigate, onEdit, onDelete }: Props) {
  return (
    <div
      className="flex w-full overflow-hidden rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onNavigate}
    >
      <div className="w-20 sm:w-36 shrink-0 bg-muted">
        {house.thumbnailUrl ? (
          <img src={api.photoUrl(house.thumbnailUrl)!} alt={house.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Home size={28} />
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center gap-3 sm:gap-6 px-3 sm:px-5 py-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-base truncate">{house.name}</p>
            {house.isMotherHouse && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                Casa mãe
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            {(house.city || house.state) && (
              <span className="flex items-center gap-1">
                <MapPin size={13} />
                {[house.city, house.state].filter(Boolean).join(' — ')}
              </span>
            )}
            {house.coordinator && (
              <span className="flex items-center gap-1">
                <User size={13} />
                {house.coordinator.name}
              </span>
            )}
            {house.phone && (
              <span className="flex items-center gap-1">
                <Phone size={13} />
                {house.phone}
              </span>
            )}
          </div>
        </div>

        {(house.generalCapacity != null || house.staffCapacity != null) && (
          <div className="hidden sm:flex gap-4 shrink-0 text-center">
            <div>
              <p className="text-xl font-bold leading-none">{houseChildVacancies(house)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">vagas</p>
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{house.activeResidentsCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">filhos</p>
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{house.staffCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">servos</p>
            </div>
          </div>
        )}

        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete} title="Excluir">
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
