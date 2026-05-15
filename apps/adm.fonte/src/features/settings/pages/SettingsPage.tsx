import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/settings/templates', label: 'Templates de documentos' },
  { to: '/settings/permissions', label: 'Permissões' },
  { to: '/settings/app-filhos', label: 'App para filhos' },
];

export function SettingsPage() {
  const { pathname } = useLocation();
  const isRoot = pathname === '/settings' || pathname === '/settings/';

  if (isRoot) return <Navigate to="/settings/templates" replace />;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <div className="flex flex-col sm:flex-row gap-6">
        <nav className="sm:w-48 shrink-0">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'block px-3 py-2 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-accent font-medium text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
