import { Pencil, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useHouseStaff } from '../../hooks/useHouses';

export function StaffTab({ houseId }: { houseId: string }) {
  const navigate = useNavigate();
  const { data: staff = [], isLoading } = useHouseStaff(houseId);

  if (isLoading) return <LoadingState />;
  if (staff.length === 0) return <EmptyState title="Nenhum servo cadastrado nesta casa." />;

  return (
    <div className="space-y-1">
      {staff.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
          <p className="font-medium text-sm">{s.name}</p>
          <div className="flex items-center gap-3">
            {s.phone && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Phone size={12} />
                {s.phone}
              </span>
            )}
            <button
              onClick={() => navigate(`/staff/${s.id}/edit`)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Editar servo"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
