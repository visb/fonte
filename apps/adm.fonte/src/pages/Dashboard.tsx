import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

const API_ORIGIN =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace('/api/v1', '') ??
  'http://localhost:3000';

interface House {
  id: string;
  name: string;
  generalCapacity: number | null;
  staffCapacity: number | null;
  thumbnailUrl: string | null;
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
                  className="shrink-0 w-44 rounded-lg border bg-card hover:bg-accent/50 transition-colors overflow-hidden text-left"
                >
                  <div className="h-20 bg-muted">
                    {house.thumbnailUrl ? (
                      <img
                        src={`${API_ORIGIN}${house.thumbnailUrl}`}
                        alt={house.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Home size={24} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate mb-2">{house.name}</p>
                    <div className="flex justify-between text-center">
                      <div>
                        <p className="text-lg font-bold leading-none">
                          {vagas ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">vagas</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold leading-none">
                          {house.activeResidentsCount}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">filhos</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold leading-none">
                          {house.staffCount}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">servos</p>
                      </div>
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
