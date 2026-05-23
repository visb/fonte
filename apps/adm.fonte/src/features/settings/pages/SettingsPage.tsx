import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function SettingsPage() {
  const { pathname } = useLocation();
  if (pathname === '/settings' || pathname === '/settings/') {
    return <Navigate to="/settings/templates" replace />;
  }
  return <Outlet />;
}
