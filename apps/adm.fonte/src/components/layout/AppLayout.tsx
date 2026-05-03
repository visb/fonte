import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Building2, Home, LogOut, Moon, Sun, UserCog, Users } from 'lucide-react';
import { Role } from '@fonte/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const { logout, role } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const isAdminOrCoordinator = role === Role.ADMIN || role === Role.COORDINATOR;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold">adm.fonte</h1>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
          >
            <Home size={16} />
            Dashboard
          </Link>
          {isAdminOrCoordinator && (
            <Link
              to="/houses"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <Building2 size={16} />
              Casas
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link
              to="/residents"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <Users size={16} />
              Filhos
            </Link>
          )}
          {isAdminOrCoordinator && (
            <Link
              to="/staff"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <UserCog size={16} />
              Servos
            </Link>
          )}
        </nav>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
