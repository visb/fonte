import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { HouseOccupancyCard } from '../components/HouseOccupancyCard';

export function DashboardPage() {
  const { data: houses = [] } = useHouses();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-6">Bem-vindo ao sistema administrativo.</p>
        <Button asChild>
          <Link to="/residents/admission">
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
            {houses.map((house) => (
              <HouseOccupancyCard key={house.id} house={house} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
