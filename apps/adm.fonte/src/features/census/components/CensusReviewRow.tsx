import { User, X } from 'lucide-react';
import type { CensusPendingResident } from '@fonte/api-client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Props {
  resident: CensusPendingResident;
  onReject: (id: string) => void;
  disabled?: boolean;
}

export function CensusReviewRow({ resident, onReject, disabled }: Props) {
  const thumb = api.photoUrl(resident.photoThumbUrl);

  return (
    <div className="flex items-center gap-3 rounded-lg border p-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
        {thumb ? (
          <img src={thumb} alt={resident.name} className="h-9 w-9 object-cover" />
        ) : (
          <User size={16} className="text-muted-foreground" />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{resident.name}</p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={() => onReject(resident.id)}
      >
        <X size={13} /> Negar
      </Button>
    </div>
  );
}
