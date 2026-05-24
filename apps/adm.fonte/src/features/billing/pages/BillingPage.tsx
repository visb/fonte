import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function BillingPage() {
  const { pathname } = useLocation();
  if (pathname === '/billing' || pathname === '/billing/') {
    return <Navigate to="/billing/filhos" replace />;
  }
  return <Outlet />;
}
