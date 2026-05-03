import { Navigate, useLocation } from 'react-router-dom';
import { Role } from '@fonte/types';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAuthenticated && role === Role.OPERATOR)
    return <Navigate to="/login" replace state={{ error: 'Acesso não permitido para este perfil.' }} />;
  if (mustChangePassword && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}
