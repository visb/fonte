import { useState } from 'react';
import { Search } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDebounce } from '@/lib/useDebounce';
import { useInfiniteResidents } from '@/features/residents/hooks/useResidents';
import { useEnrollResident } from '../hooks/useBibleCourses';

interface Props {
  open: boolean;
  classId: string;
  /** Resident ids already enrolled — hidden from the list. */
  enrolledIds: string[];
  onClose: () => void;
}

export function EnrollResidentDialog({ open, classId, enrolledIds, onClose }: Props) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const { data, isLoading } = useInfiniteResidents({ search: debouncedSearch, status: ResidentStatus.ACTIVE });
  const enrollMutation = useEnrollResident(classId);

  const enrolledSet = new Set(enrolledIds);
  const residents = (data?.pages.flatMap((p) => p.data) ?? []).filter((r) => !enrolledSet.has(r.id));

  const handleEnroll = (residentId: string) => {
    enrollMutation.mutate({ residentId });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Matricular filho</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar filho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {isLoading ? (
              <LoadingState />
            ) : residents.length === 0 ? (
              <EmptyState title="Nenhum filho disponível." />
            ) : (
              residents.map((r) => (
                <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{r.name}</span>
                    {r.house && <p className="text-xs text-muted-foreground">{r.house.name}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enrollMutation.isPending}
                    onClick={() => handleEnroll(r.id)}
                  >
                    Matricular
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
