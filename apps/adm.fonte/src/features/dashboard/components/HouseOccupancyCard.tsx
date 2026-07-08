import { useNavigate } from 'react-router-dom';
import type { House } from '@fonte/api-client';
import { houseChildVacancies } from '@/features/houses/utils';

interface Props {
  house: House;
}

export function HouseOccupancyCard({ house }: Props) {
  const navigate = useNavigate();
  const vagas = houseChildVacancies(house);

  return (
    <button
      onClick={() => navigate(`/houses/${house.id}`)}
      className="rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left p-3 space-y-2"
    >
      <p className="font-semibold text-sm truncate text-center">{house.name}</p>
      <div className="text-center">
        <p className="text-4xl font-bold leading-none">{vagas ?? '—'}</p>
        <p className="text-sm text-muted-foreground mt-1">vagas</p>
      </div>
      <div className="flex justify-around text-center">
        <div>
          <p className="text-base font-semibold leading-none">{house.activeResidentsCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">filhos</p>
        </div>
        <div>
          <p className="text-base font-semibold leading-none">{house.staffCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">servos</p>
        </div>
      </div>
    </button>
  );
}
