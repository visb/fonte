import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ResidentStatus, Role } from '@fonte/types';
import { useGoBack } from '@/lib/navigation';
import { ArrowLeft, Pencil, RefreshCw, User, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';
import { useResidentById } from '../hooks/useResidents';
import { PromoteToServantDialog } from '../components/PromoteToServantDialog';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { RelativesTab } from '../components/tabs/RelativesTab';
import { AttachmentsTab } from '../components/tabs/AttachmentsTab';
import { PrivacyTab } from '../components/tabs/PrivacyTab';
import { AdmissionsTab } from '../components/tabs/AdmissionsTab';
import { TrackingTab } from '../components/tabs/TrackingTab';
import { ContributionsTab } from '../components/tabs/ContributionsTab';

const TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'timeline', label: 'Acompanhamento' },
  { id: 'contributions', label: 'Contribuição', manageOnly: true },
  { id: 'relatives', label: 'Familiares' },
  { id: 'attachments', label: 'Anexos' },
  { id: 'privacy', label: 'Privacidade', manageOnly: true },
  { id: 'admissions', label: 'Histórico' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function ResidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/residents');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const { role } = useAuth();
  const canManage = role === Role.ADMIN || role === Role.COORDINATOR;
  const canPromote = canManage;
  const visibleTabs = TABS.filter((tab) => !('manageOnly' in tab && tab.manageOnly) || canManage);

  const { data: resident, isLoading, isError } = useResidentById(id!);

  if (isLoading) return <LoadingState />;
  if (isError || !resident) return <ErrorState message="Acolhido não encontrado." />;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <div
          className={cn(
            'w-12 h-12 rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden',
            resident.photoUrl && 'cursor-pointer hover:opacity-80 transition-opacity',
          )}
          onClick={() => resident.photoUrl && setPhotoModalOpen(true)}
        >
          {resident.photoUrl ? (
            <img src={api.photoUrl(resident.photoThumbUrl ?? resident.photoUrl)!} alt={resident.name} className="w-full h-full object-cover" />
          ) : (
            <User size={22} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{resident.name}</h1>
            <Badge variant={RESIDENT_STATUS_VARIANT[resident.status]}>
              {RESIDENT_STATUS_LABELS[resident.status]}
            </Badge>
          </div>
          {resident.house && (
            <p className="text-sm text-muted-foreground mt-0.5">{resident.house.name}</p>
          )}
        </div>
        {(resident.status === ResidentStatus.DISCHARGED || resident.status === ResidentStatus.EVADED) && (
          <Button asChild variant="default" size="sm">
            <Link to={`/residents/readmit/${id}`}>
              <RefreshCw size={14} className="mr-2" />
              Reintroduzir
            </Link>
          </Button>
        )}
        {canPromote && (
          <Button variant="outline" size="sm" onClick={() => setPromoteOpen(true)}>
            <UserPlus size={14} className="mr-2" />
            Tornar Servo
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to={`/residents/${id}/edit`}>
            <Pencil size={14} className="mr-2" />
            Editar
          </Link>
        </Button>
      </div>

      <div className="border-b flex gap-0">
        {visibleTabs.map((tab) => (
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

      {activeTab === 'overview' && <OverviewTab resident={resident} canManage={canManage} />}

      {activeTab === 'timeline' && <TrackingTab residentId={id!} />}

      {activeTab === 'contributions' && canManage && <ContributionsTab resident={resident} />}

      {activeTab === 'relatives' && <RelativesTab residentId={id!} />}

      {activeTab === 'attachments' && <AttachmentsTab residentId={id!} residentName={resident.name} />}

      {activeTab === 'privacy' && canManage && <PrivacyTab residentId={id!} residentName={resident.name} />}

      {activeTab === 'admissions' && <AdmissionsTab residentId={id!} />}

      <PromoteToServantDialog open={promoteOpen} onClose={() => setPromoteOpen(false)} resident={resident} />

      <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
        <DialogContent className="max-w-sm p-2">
          <img src={api.photoUrl(resident.photoUrl)!} alt={resident.name} className="w-full rounded-md object-contain max-h-[80vh]" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
