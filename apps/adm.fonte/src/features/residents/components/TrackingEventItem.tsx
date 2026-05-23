import {
  AlertTriangle,
  ClipboardList,
  DollarSign,
  LogIn,
  LogOut,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  StickyNote,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FollowUpAccessLevel, FollowUpType } from '@fonte/types';
import type { ResidentFollowUp } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { FOLLOW_UP_ACCESS_LABELS, FOLLOW_UP_TYPE_LABELS } from '../constants';

const TYPE_ICONS: Record<FollowUpType, LucideIcon> = {
  [FollowUpType.ADMISSION]: LogIn,
  [FollowUpType.READMISSION]: RefreshCw,
  [FollowUpType.DISCHARGE]: LogOut,
  [FollowUpType.EVASION]: AlertTriangle,
  [FollowUpType.MINISTRY_CHANGE]: Shuffle,
  [FollowUpType.RELATIVE_ADDED]: Users,
  [FollowUpType.DOCUMENT_ATTACHED]: Paperclip,
  [FollowUpType.MONTHLY_CONTRIBUTION]: DollarSign,
  [FollowUpType.DISCIPLINE]: ShieldAlert,
  [FollowUpType.BEHAVIOR_ASSESSMENT]: ClipboardList,
  [FollowUpType.NOTE]: StickyNote,
};

const TYPE_COLORS: Record<FollowUpType, string> = {
  [FollowUpType.ADMISSION]: 'bg-green-100 text-green-700',
  [FollowUpType.READMISSION]: 'bg-blue-100 text-blue-700',
  [FollowUpType.DISCHARGE]: 'bg-purple-100 text-purple-700',
  [FollowUpType.EVASION]: 'bg-red-100 text-red-700',
  [FollowUpType.MINISTRY_CHANGE]: 'bg-orange-100 text-orange-700',
  [FollowUpType.RELATIVE_ADDED]: 'bg-teal-100 text-teal-700',
  [FollowUpType.DOCUMENT_ATTACHED]: 'bg-gray-100 text-gray-700',
  [FollowUpType.MONTHLY_CONTRIBUTION]: 'bg-yellow-100 text-yellow-700',
  [FollowUpType.DISCIPLINE]: 'bg-amber-100 text-amber-700',
  [FollowUpType.BEHAVIOR_ASSESSMENT]: 'bg-indigo-100 text-indigo-700',
  [FollowUpType.NOTE]: 'bg-slate-100 text-slate-700',
};

interface Props {
  followUp: ResidentFollowUp;
}

export function TrackingEventItem({ followUp }: Props) {
  const Icon = TYPE_ICONS[followUp.type];
  const colorClass = TYPE_COLORS[followUp.type];

  const date = new Date(followUp.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex gap-3 rounded-lg border bg-card px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{FOLLOW_UP_TYPE_LABELS[followUp.type]}</span>
          {followUp.accessLevel === FollowUpAccessLevel.ADMINISTRATION && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {FOLLOW_UP_ACCESS_LABELS[followUp.accessLevel]}
            </Badge>
          )}
        </div>
        {followUp.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{followUp.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{date}</span>
          {followUp.createdByName && (
            <>
              <span>·</span>
              <span>{followUp.createdByName}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
