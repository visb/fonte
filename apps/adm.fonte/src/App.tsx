import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { HousesPage } from '@/pages/houses/HousesPage';
import { HouseDetailPage } from '@/pages/houses/HouseDetailPage';
import { ResidentsPage } from '@/pages/residents/ResidentsPage';
import { NewResidentPage } from '@/pages/residents/NewResidentPage';
import { EditResidentPage } from '@/pages/residents/EditResidentPage';
import { StaffPage } from '@/pages/staff/StaffPage';
import { NewStaffPage } from '@/pages/staff/NewStaffPage';
import { EditStaffPage } from '@/pages/staff/EditStaffPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';

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
              <Route path="houses" element={<HousesPage />} />
              <Route path="houses/:id" element={<HouseDetailPage />} />
              <Route path="residents" element={<ResidentsPage />} />
              <Route path="residents/new" element={<NewResidentPage />} />
              <Route path="residents/:id/edit" element={<EditResidentPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="staff/new" element={<NewStaffPage />} />
              <Route path="staff/:id/edit" element={<EditStaffPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
