import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { ACTIVITY_COLUMNS } from '../constants';
import { ActivityColumn } from './ActivityColumn';

interface Props {
  activities: Activity[];
  isAdmin: boolean;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  onApprove: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

export function ActivityBoard({
  activities,
  isAdmin,
  onChangeStatus,
  onApprove,
  onEdit,
  onDelete,
}: Props) {
  const byStatus = (status: ActivityStatus) =>
    activities.filter((a) => a.status === status);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {ACTIVITY_COLUMNS.map((column) => (
        <ActivityColumn
          key={column.status}
          column={column}
          activities={byStatus(column.status)}
          isAdmin={isAdmin}
          onChangeStatus={onChangeStatus}
          onApprove={onApprove}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
