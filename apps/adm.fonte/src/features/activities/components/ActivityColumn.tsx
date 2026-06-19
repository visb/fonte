import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { ActivityCard } from './ActivityCard';
import { QuickAddCard } from './QuickAddCard';
import { canQuickAddInStatus, type ActivityColumnDef } from '../constants';

interface Props {
  column: ActivityColumnDef;
  activities: Activity[];
  isAdmin: boolean;
  role: string | null;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  onApprove: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onOpenDetails: (activity: Activity) => void;
}

export function ActivityColumn({
  column,
  activities,
  isAdmin,
  role,
  onChangeStatus,
  onApprove,
  onEdit,
  onDelete,
  onOpenDetails,
}: Props) {
  const canQuickAdd = canQuickAddInStatus(column.status, role);
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/40 p-2">
      <div className="flex items-center justify-between px-1 py-1.5">
        <Badge variant={column.variant}>{column.label}</Badge>
        <span className="text-xs text-muted-foreground">{activities.length}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto">
        {activities.length === 0 ? (
          !canQuickAdd && (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">
              Nenhuma atividade
            </p>
          )
        ) : (
          activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isAdmin={isAdmin}
              onChangeStatus={onChangeStatus}
              onApprove={onApprove}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenDetails={onOpenDetails}
            />
          ))
        )}
        {canQuickAdd && <QuickAddCard status={column.status} />}
      </div>
    </div>
  );
}
