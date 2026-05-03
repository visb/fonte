import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface House {
  id: string;
  name: string;
  generalCapacity: number | null;
  staffCapacity: number | null;
  activeResidentsCount: number;
  staffCount: number;
}

const fetchHouses = () => api.get<House[]>('/houses').then((r) => r.data);

export function Dashboard() {
  const navigate = useNavigate();

  const { data: houses = [] } = useQuery({
    queryKey: ['houses'],
    queryFn: fetchHouses,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-6">Bem-vindo ao sistema administrativo.</p>
        <Button asChild>
          <Link to="/residents/new">
            <UserPlus size={16} className="mr-2" />
            Novo acolhimento
          </Link>
        </Button>
      </div>

      {houses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Ocupação das Casas
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {houses.map((house) => {
              const hasCapacity =
                house.generalCapacity != null || house.staffCapacity != null;
              const vagas = hasCapacity
                ? Math.max(
                    0,
                    (house.generalCapacity ?? 0) +
                      (house.staffCapacity ?? 0) -
                      house.staffCount -
                      house.activeResidentsCount,
                  )
                : null;

              return (
                <button
                  key={house.id}
                  onClick={() => navigate(`/houses/${house.id}`)}
                  className="shrink-0 w-40 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left p-3 space-y-2"
                >
                  <p className="font-semibold text-sm truncate text-center">{house.name}</p>
                  <div className="text-center">
                    <p className="text-4xl font-bold leading-none">{vagas ?? '—'}</p>
                    <p className="text-sm text-muted-foreground mt-1">vagas</p>
                  </div>
                  <div className="flex justify-around text-center">
                    <div>
                      <p className="text-base font-semibold leading-none">
                        {house.activeResidentsCount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">filhos</p>
                    </div>
                    <div>
                      <p className="text-base font-semibold leading-none">
                        {house.staffCount}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">servos</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
