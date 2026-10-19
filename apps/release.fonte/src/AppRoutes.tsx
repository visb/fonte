import { Navigate, Route, Routes } from 'react-router-dom';
import { ChangelogPage } from '@/features/changelog/pages/ChangelogPage';
import { ReleaseDetailPage } from '@/features/changelog/pages/ReleaseDetailPage';
import { HomePage } from '@/features/download/pages/HomePage';

// Comportamento do React Router v7 já ligado (sem warnings de migração).
export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/changelog/:version" element={<ReleaseDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
