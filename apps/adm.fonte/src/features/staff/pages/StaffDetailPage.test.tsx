import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Role } from '@fonte/types';

const staffQuery = { data: null as unknown, isLoading: false, isError: false };

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));
vi.mock('../hooks/useStaff', () => ({ useStaffById: () => staffQuery }));
vi.mock('../components/StaffDetailActions', () => ({
  StaffDetailActions: ({ staff }: { staff: { dismissedAt: string | null } }) => (
    <div>actions {staff.dismissedAt ? 'desligado' : 'ativo'}</div>
  ),
}));
vi.mock('../components/StaffOverviewTab', () => ({ StaffOverviewTab: () => <div>overview</div> }));
vi.mock('../components/StaffAttachmentsTab', () => ({ StaffAttachmentsTab: () => null }));
vi.mock('../components/StaffHistoryTab', () => ({ StaffHistoryTab: () => null }));
vi.mock('@/features/residents/components/tabs/TrackingTab', () => ({ TrackingTab: () => null }));
vi.mock('@/features/residents/components/tabs/RelativesTab', () => ({ RelativesTab: () => null }));
vi.mock('@/features/residents/components/tabs/AttachmentsTab', () => ({ AttachmentsTab: () => null }));

import { StaffDetailPage } from './StaffDetailPage';

const base = {
  id: 's1',
  name: 'Pedro Servo',
  photoUrl: null,
  house: { id: 'h1', name: 'Casa Belém' },
  formerResidentId: null,
  rank: null,
  dismissedAt: null as string | null,
  user: { email: 'p@x.com', role: Role.COORDINATOR },
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/staff/s1']}>
      <Routes>
        <Route path="/staff/:id" element={<StaffDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  staffQuery.data = { ...base };
  staffQuery.isLoading = false;
  staffQuery.isError = false;
});
afterEach(() => cleanup());

describe('StaffDetailPage (story 217)', () => {
  it('ativo: sem selo de desligado, ações do ativo', () => {
    renderPage();
    expect(screen.getByText('Pedro Servo')).toBeInTheDocument();
    expect(screen.queryByText(/Desligado em/)).toBeNull();
    expect(screen.getByText('actions ativo')).toBeInTheDocument();
  });

  it('desligado: selo com a data e ações do desligado; detalhe continua acessível', () => {
    staffQuery.data = { ...base, dismissedAt: '2025-01-10' };
    renderPage();
    expect(screen.getByText('Desligado em 10/01/2025')).toBeInTheDocument();
    expect(screen.getByText('actions desligado')).toBeInTheDocument();
    expect(screen.getByText('overview')).toBeInTheDocument();
  });

  it('não encontrado mostra erro', () => {
    staffQuery.data = null;
    staffQuery.isError = true;
    renderPage();
    expect(screen.getByText('Servo não encontrado.')).toBeInTheDocument();
  });
});
