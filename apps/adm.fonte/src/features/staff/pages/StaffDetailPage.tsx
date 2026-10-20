import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Role } from '@fonte/types';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useGoBack } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PersonAvatar } from '@/components/shared/PersonAvatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TrackingTab } from '@/features/residents/components/tabs/TrackingTab';
import { RelativesTab } from '@/features/residents/components/tabs/RelativesTab';
import { AttachmentsTab } from '@/features/residents/components/tabs/AttachmentsTab';
import { useStaffById } from '../hooks/useStaff';
import { StaffDetailActions } from '../components/StaffDetailActions';
import { StaffDismissedBadge } from '../components/StaffDismissedBadge';
import { StaffOverviewTab } from '../components/StaffOverviewTab';
import { StaffAttachmentsTab } from '../components/StaffAttachmentsTab';
import { StaffHistoryTab } from '../components/StaffHistoryTab';
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

// Anexos do próprio servo (story 98) e Histórico (story 216 — períodos de
// serviço + acolhimentos do ex-filho) valem para todo servo; as abas herdadas
// (dados do acolhimento) só existem para ex-filhos promovidos a servo.
const BASE_TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'attachments', label: 'Anexos' },
  { id: 'admissions', label: 'Histórico' },
] as const;
const INHERITED_TABS = [
  { id: 'timeline', label: 'Acompanhamento' },
  { id: 'relatives', label: 'Familiares' },
  { id: 'resident-attachments', label: 'Anexos do acolhimento' },
] as const;
type TabId =
  | 'overview'
  | 'attachments'
  | 'timeline'
  | 'relatives'
  | 'resident-attachments'
  | 'admissions';

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/staff');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

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
        <PersonAvatar
          size="lg"
          url={staff.photoUrl}
          name={staff.name}
          className={cn(staff.photoUrl && 'cursor-pointer hover:opacity-80 transition-opacity')}
          onClick={() => staff.photoUrl && setPhotoModalOpen(true)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{staff.name}</h1>
            <Badge variant={ROLE_VARIANT[staff.user.role] ?? 'secondary'}>
              {ROLE_LABELS[staff.user.role] ?? staff.user.role}
            </Badge>
            {staff.user.role === Role.SERVANT && staff.rank && (
              <Badge variant={SERVANT_RANK_VARIANT[staff.rank]}>{SERVANT_RANK_LABELS[staff.rank]}</Badge>
            )}
            {staff.dismissedAt && <StaffDismissedBadge dismissedAt={staff.dismissedAt} />}
          </div>
          {staff.house && <p className="text-sm text-muted-foreground mt-0.5">{staff.house.name}</p>}
        </div>
        <StaffDetailActions staff={staff} />
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
      {activeTab === 'attachments' && <StaffAttachmentsTab staffId={staff.id} />}

      {formerResidentId && activeTab === 'timeline' && <TrackingTab residentId={formerResidentId} />}
      {formerResidentId && activeTab === 'relatives' && <RelativesTab residentId={formerResidentId} />}
      {formerResidentId && activeTab === 'resident-attachments' && (
        <AttachmentsTab residentId={formerResidentId} residentName={staff.name} />
      )}
      {activeTab === 'admissions' && (
        <StaffHistoryTab staffId={staff.id} formerResidentId={formerResidentId} />
      )}

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
