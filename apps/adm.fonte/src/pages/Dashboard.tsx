import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  return (
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
  );
}
