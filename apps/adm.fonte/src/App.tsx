import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Role } from '@fonte/types';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { HousesPage } from '@/features/houses/pages/HousesPage';
import { HouseDetailPage } from '@/features/houses/pages/HouseDetailPage';
import { ResidentsPage } from '@/features/residents/pages/ResidentsPage';
import { AdmissionWizardPage } from '@/features/residents/pages/AdmissionWizardPage';
import { NewAdmissionGatewayPage } from '@/features/residents/pages/NewAdmissionGatewayPage';
import { ReadmissionPage } from '@/features/residents/pages/ReadmissionPage';
import { ResidentDetailPage } from '@/features/residents/pages/ResidentDetailPage';
import { EditResidentPage } from '@/features/residents/pages/EditResidentPage';
import { ImportResidentPage } from '@/features/residents/pages/ImportResidentPage';
import { StaffPage } from '@/features/staff/pages/StaffPage';
import { NewStaffPage } from '@/features/staff/pages/NewStaffPage';
import { StaffDetailPage } from '@/features/staff/pages/StaffDetailPage';
import { EditStaffPage } from '@/features/staff/pages/EditStaffPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';
import { DocumentTemplatesPage } from '@/features/settings/pages/DocumentTemplatesPage';
import { PermissionsPage } from '@/features/settings/pages/PermissionsPage';
import { ChildAppSettingsPage } from '@/features/settings/pages/ChildAppSettingsPage';
import { SupportGroupsPage } from '@/features/support-groups/pages/SupportGroupsPage';
import { BibleCoursesPage } from '@/features/bible-courses/pages/BibleCoursesPage';
import { BibleModulesPage } from '@/features/bible-courses/pages/BibleModulesPage';
import { BibleClassDetailPage } from '@/features/bible-courses/pages/BibleClassDetailPage';
import { BillingPage } from '@/features/billing/pages/BillingPage';
import { FilhosPage } from '@/features/billing/pages/FilhosPage';
import { PizzaPage } from '@/features/billing/pages/PizzaPage';
import { BreadPage } from '@/features/billing/pages/BreadPage';
import { AssociadosPage } from '@/features/billing/pages/AssociadosPage';
import { MessagesPage } from '@/features/messages/pages/MessagesPage';
import { ProfilePage } from '@/features/auth/pages/ProfilePage';
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
import { BackupPage } from '@/features/backup/pages/BackupPage';

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
            <Route path="/login" element={<LoginPage />} />
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
              <Route index element={<DashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="houses" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><HousesPage /></ProtectedRoute>} />
              <Route path="houses/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><HouseDetailPage /></ProtectedRoute>} />
              <Route path="residents" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><ResidentsPage /></ProtectedRoute>} />
              <Route path="residents/admission" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><NewAdmissionGatewayPage /></ProtectedRoute>} />
              <Route path="residents/new" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><AdmissionWizardPage /></ProtectedRoute>} />
              <Route path="residents/import" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><ImportResidentPage /></ProtectedRoute>} />
              <Route path="residents/readmit/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><ReadmissionPage /></ProtectedRoute>} />
              <Route path="residents/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><ResidentDetailPage /></ProtectedRoute>} />
              <Route path="residents/:id/edit" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><EditResidentPage /></ProtectedRoute>} />
              <Route path="staff" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><StaffPage /></ProtectedRoute>} />
              <Route path="staff/new" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><NewStaffPage /></ProtectedRoute>} />
              <Route path="staff/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><StaffDetailPage /></ProtectedRoute>} />
              <Route path="staff/:id/edit" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><EditStaffPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><SettingsPage /></ProtectedRoute>}>
                <Route path="templates" element={<DocumentTemplatesPage />} />
                <Route path="permissions" element={<PermissionsPage />} />
                <Route path="app-filhos" element={<ChildAppSettingsPage />} />
              </Route>
              <Route path="support-groups" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><SupportGroupsPage /></ProtectedRoute>} />
              <Route path="bible-courses" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><BibleCoursesPage /></ProtectedRoute>} />
              <Route path="bible-courses/modules" element={<ProtectedRoute allowedRoles={[Role.ADMIN]}><BibleModulesPage /></ProtectedRoute>} />
              <Route path="bible-courses/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><BibleClassDetailPage /></ProtectedRoute>} />
              <Route path="messages" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}><MessagesPage /></ProtectedRoute>} />
              <Route path="backup" element={<ProtectedRoute allowedRoles={[Role.ADMIN]}><BackupPage /></ProtectedRoute>} />
              <Route
                path="billing"
                element={
                  <ProtectedRoute allowedRoles={[Role.ADMIN, Role.COORDINATOR]}>
                    <BillingPage />
                  </ProtectedRoute>
                }
              >
                <Route path="filhos" element={<FilhosPage />} />
                <Route path="pizza" element={<PizzaPage />} />
                <Route path="bread" element={<BreadPage />} />
                <Route path="associados" element={<AssociadosPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
