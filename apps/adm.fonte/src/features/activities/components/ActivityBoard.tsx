import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import {
  ACTIVITY_COLUMNS,
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_STATUS_VARIANTS,
} from '../constants';
import { canTransition, type TransitionUser } from '../lib/transitions';
import { resolveDrop, type DropResolution } from '../lib/resolveDrop';
import { ActivityColumn } from './ActivityColumn';

interface Props {
  activities: Activity[];
  isAdmin: boolean;
  role: string | null;
  userId: string | null;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  onApprove: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
  onOpenDetails: (activity: Activity) => void;
  /** Card solto numa coluna onde a transição não é válida/permitida (UX). */
  onInvalidDrop: (activity: Activity, to: ActivityStatus) => void;
}

export function ActivityBoard({
  activities,
  isAdmin,
  role,
  userId,
  onChangeStatus,
  onApprove,
  onEdit,
  onDelete,
  onOpenDetails,
  onInvalidDrop,
}: Props) {
  const [dragging, setDragging] = useState<Activity | null>(null);
  const user: TransitionUser = { role, userId };

  // Pointer com distância mínima distingue clique (abre detalhes) de arraste.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = (status: ActivityStatus) =>
    activities.filter((a) => a.status === status);

  const handleDragStart = (event: DragStartEvent) => {
    const activity = event.active.data.current?.activity as Activity | undefined;
    setDragging(activity ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activity = event.active.data.current?.activity as Activity | undefined;
    const to = event.over?.id as ActivityStatus | undefined;
    setDragging(null);

    const resolution: DropResolution = resolveDrop(activity, to, user);
    switch (resolution.kind) {
      case 'move':
        onChangeStatus(resolution.activity, resolution.to);
        break;
      case 'approve':
        onApprove(resolution.activity);
        break;
      case 'invalid':
        onInvalidDrop(resolution.activity, resolution.to);
        break;
      case 'noop':
        break;
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ACTIVITY_COLUMNS.map((column) => (
          <ActivityColumn
            key={column.status}
            column={column}
            activities={byStatus(column.status)}
            isAdmin={isAdmin}
            role={role}
            userId={userId}
            isDragActive={dragging != null}
            isValidDropTarget={
              dragging != null && canTransition(dragging, column.status, user)
            }
            onChangeStatus={onChangeStatus}
            onApprove={onApprove}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>

      <DragOverlay>
        {dragging ? (
          <div className="w-72 rounded-md border bg-card p-3 shadow-lg space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1 text-sm font-medium leading-tight">
                {dragging.title}
              </p>
              <Badge
                variant={ACTIVITY_STATUS_VARIANTS[dragging.status]}
                className="shrink-0"
              >
                {ACTIVITY_STATUS_LABELS[dragging.status]}
              </Badge>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
