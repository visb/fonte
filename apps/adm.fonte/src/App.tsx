import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Role } from '@fonte/types';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { HousesPage } from '@/pages/houses/HousesPage';
import { HouseDetailPage } from '@/pages/houses/HouseDetailPage';
import { ResidentsPage } from '@/pages/residents/ResidentsPage';
import { NewResidentPage } from '@/pages/residents/NewResidentPage';
import { ResidentDetailPage } from '@/pages/residents/ResidentDetailPage';
import { EditResidentPage } from '@/pages/residents/EditResidentPage';
import { StaffPage } from '@/pages/staff/StaffPage';
import { NewStaffPage } from '@/pages/staff/NewStaffPage';
import { EditStaffPage } from '@/pages/staff/EditStaffPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { MinistriesPage } from '@/pages/ministries/MinistriesPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="houses" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><HousesPage /></ProtectedRoute>} />
              <Route path="houses/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><HouseDetailPage /></ProtectedRoute>} />
              <Route path="residents" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><ResidentsPage /></ProtectedRoute>} />
              <Route path="residents/new" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><NewResidentPage /></ProtectedRoute>} />
              <Route path="residents/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><ResidentDetailPage /></ProtectedRoute>} />
              <Route path="residents/:id/edit" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><EditResidentPage /></ProtectedRoute>} />
              <Route path="staff" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><StaffPage /></ProtectedRoute>} />
              <Route path="staff/new" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><NewStaffPage /></ProtectedRoute>} />
              <Route path="staff/:id/edit" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><EditStaffPage /></ProtectedRoute>} />
              <Route path="ministries" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><MinistriesPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><SettingsPage /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
