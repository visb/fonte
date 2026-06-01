import { useParams, useSearchParams } from 'react-router-dom';
import { useGoBack } from '@/lib/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { ResidentsTab } from '../components/tabs/ResidentsTab';
import { StaffTab } from '../components/tabs/StaffTab';
import { MinistriesTab } from '../components/tabs/MinistriesTab';
import { StoreroomTab } from '../components/tabs/StoreroomTab';
import { SupplyRoomTab } from '../components/tabs/SupplyRoomTab';
import { RulesTab } from '../components/tabs/RulesTab';
import { useHouseById } from '../hooks/useHouses';

const TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'residents', label: 'Filhos' },
  { id: 'staff', label: 'Servos' },
  { id: 'ministries', label: 'Ministérios' },
  { id: 'storeroom', label: 'Dispensa' },
  { id: 'supply-room', label: 'Almoxarifado' },
  { id: 'rules', label: 'Regras' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function HouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/houses');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });

  const { data: house, isLoading, isError, refetch } = useHouseById(id!);

  if (isLoading) return <LoadingState />;
  if (isError || !house) return <ErrorState message="Casa não encontrada." onRetry={refetch} />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold flex-1">{house.name}</h1>
      </div>

      <div className="border-b flex flex-wrap gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'overview' && <OverviewTab houseId={id!} />}
        {activeTab === 'residents' && <ResidentsTab houseId={id!} />}
        {activeTab === 'staff' && <StaffTab houseId={id!} />}
        {activeTab === 'ministries' && <MinistriesTab houseId={id!} />}
        {activeTab === 'storeroom' && <StoreroomTab houseId={id!} />}
        {activeTab === 'supply-room' && <SupplyRoomTab houseId={id!} />}
        {activeTab === 'rules' && <RulesTab houseId={id!} />}
      </div>
    </div>
  );
}
