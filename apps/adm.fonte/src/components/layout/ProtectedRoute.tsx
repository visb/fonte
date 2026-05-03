import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (mustChangePassword && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}
