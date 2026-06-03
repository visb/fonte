import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Role } from '@fonte/types';
import { ArrowLeft, KeyRound, Pencil, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useGoBack } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TrackingTab } from '@/features/residents/components/tabs/TrackingTab';
import { RelativesTab } from '@/features/residents/components/tabs/RelativesTab';
import { AttachmentsTab } from '@/features/residents/components/tabs/AttachmentsTab';
import { AdmissionsTab } from '@/features/residents/components/tabs/AdmissionsTab';
import { useStaffById } from '../hooks/useStaff';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { StaffOverviewTab } from '../components/StaffOverviewTab';
import { SERVANT_RANK_LABELS, SERVANT_RANK_VARIANT } from '../constants';

const ROLE_LABELS: Record<string, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.SERVANT]: 'Servo',
};

const ROLE_VARIANT: Record<string, 'destructive' | 'info' | 'secondary'> = {
  [Role.ADMIN]: 'destructive',
  [Role.COORDINATOR]: 'info',
  [Role.SERVANT]: 'secondary',
};

const BASE_TABS = [{ id: 'overview', label: 'Visão Geral' }] as const;
const INHERITED_TABS = [
  { id: 'timeline', label: 'Acompanhamento' },
  { id: 'relatives', label: 'Familiares' },
  { id: 'attachments', label: 'Anexos' },
  { id: 'admissions', label: 'Histórico' },
] as const;
type TabId = 'overview' | 'timeline' | 'relatives' | 'attachments' | 'admissions';

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/staff');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const { data: staff, isLoading, isError } = useStaffById(id!);

  if (isLoading) return <LoadingState />;
  if (isError || !staff) return <ErrorState message="Servo não encontrado." />;

  const formerResidentId = staff.formerResidentId;
  const tabs = formerResidentId ? [...BASE_TABS, ...INHERITED_TABS] : BASE_TABS;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <div
          className={cn(
            'w-12 h-12 rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden',
            staff.photoUrl && 'cursor-pointer hover:opacity-80 transition-opacity',
          )}
          onClick={() => staff.photoUrl && setPhotoModalOpen(true)}
        >
          {staff.photoUrl ? (
            <img src={api.photoUrl(staff.photoUrl)!} alt={staff.name} className="w-full h-full object-cover" />
          ) : (
            <User size={22} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{staff.name}</h1>
            <Badge variant={ROLE_VARIANT[staff.user.role] ?? 'secondary'}>
              {ROLE_LABELS[staff.user.role] ?? staff.user.role}
            </Badge>
            {staff.user.role === Role.SERVANT && staff.rank && (
              <Badge variant={SERVANT_RANK_VARIANT[staff.rank]}>{SERVANT_RANK_LABELS[staff.rank]}</Badge>
            )}
          </div>
          {staff.house && <p className="text-sm text-muted-foreground mt-0.5">{staff.house.name}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
          <KeyRound size={14} className="mr-2" />
          Resetar senha
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/staff/${id}/edit`}>
            <Pencil size={14} className="mr-2" />
            Editar
          </Link>
        </Button>
      </div>

      <div className="border-b flex gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <StaffOverviewTab staff={staff} />}

      {formerResidentId && activeTab === 'timeline' && <TrackingTab residentId={formerResidentId} />}
      {formerResidentId && activeTab === 'relatives' && <RelativesTab residentId={formerResidentId} />}
      {formerResidentId && activeTab === 'attachments' && (
        <AttachmentsTab residentId={formerResidentId} residentName={staff.name} />
      )}
      {formerResidentId && activeTab === 'admissions' && <AdmissionsTab residentId={formerResidentId} />}

      <ResetPasswordDialog open={resetOpen} onClose={() => setResetOpen(false)} staff={staff} />

      {staff.photoUrl && (
        <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
          <DialogContent className="max-w-sm p-2">
            <img src={api.photoUrl(staff.photoUrl)!} alt={staff.name} className="w-full rounded-md object-contain max-h-[80vh]" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
