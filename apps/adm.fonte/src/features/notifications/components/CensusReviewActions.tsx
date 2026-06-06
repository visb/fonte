import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { Notification } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { CensusReviewModal } from '@/features/census/components/CensusReviewModal';

interface Props {
  notification: Notification;
}

/** "Revisar" button shown on a CENSUS_CONCLUDED notification when residents were added. */
export function CensusReviewActions({ notification }: Props) {
  const meta = (notification.metadata ?? {}) as Record<string, unknown>;
  const houseId = typeof meta.houseId === 'string' ? meta.houseId : null;
  const houseName = typeof meta.houseName === 'string' ? meta.houseName : undefined;
  const addedCount = typeof meta.addedCount === 'number' ? meta.addedCount : 0;
  const [open, setOpen] = useState(false);

  if (!houseId || addedCount <= 0) return null;

  return (
    <div className="px-3 pb-2.5">
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full gap-1"
        onClick={() => setOpen(true)}
      >
        <ClipboardList size={13} /> Revisar {addedCount} adicionado(s)
      </Button>
      <CensusReviewModal
        houseId={houseId}
        houseName={houseName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
