import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RelativeCheckinHistoryItem } from '@fonte/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSupportGroupMeetingDetail, useResidentCheckinHistory } from '../hooks/useSupportGroups';

function ResidentHistoryRow({ residentId }: { residentId: string }) {
  const { data: history = [], isLoading } = useResidentCheckinHistory(residentId);

  if (isLoading) return <p className="text-xs text-muted-foreground py-1 pl-2">Carregando...</p>;
  if (history.length === 0) return <p className="text-xs text-muted-foreground py-1 pl-2">Nenhuma participação anterior.</p>;

  return (
    <div className="pl-2 pt-1 space-y-1">
      {history.map((item: RelativeCheckinHistoryItem) => (
        <div key={item.meetingId} className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')}
          </span>
          <span>{item.groupName}</span>
        </div>
      ))}
    </div>
  );
}

interface MeetingFamiliesModalProps {
  meetingId: string | null;
  onClose: () => void;
}

export function MeetingFamiliesModal({ meetingId, onClose }: MeetingFamiliesModalProps) {
  const [expandedResidentId, setExpandedResidentId] = useState<string | null>(null);
  const { data: meeting, isLoading } = useSupportGroupMeetingDetail(meetingId);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setExpandedResidentId(null);
      onClose();
    }
  }

  return (
    <Dialog open={!!meetingId} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Famílias presentes</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : !meeting || meeting.checkins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma família registrada nesta reunião.</p>
        ) : (
          <div className="divide-y">
            {meeting.checkins.map((checkin) => {
              const isOpen = expandedResidentId === checkin.residentId;
              return (
                <div key={checkin.id} className="py-2">
                  <button
                    className="flex items-center gap-2 w-full text-left hover:text-foreground transition-colors"
                    onClick={() => setExpandedResidentId(isOpen ? null : checkin.residentId)}
                  >
                    {isOpen
                      ? <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                      : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                    <p className="text-sm font-medium">{checkin.residentName}</p>
                  </button>
                  {isOpen && (
                    <div className="mt-1 ml-5">
                      <ResidentHistoryRow residentId={checkin.residentId} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
