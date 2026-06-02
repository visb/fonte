import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '@/features/residents/constants';
import { ResidentStatus } from '@fonte/types';
import { useResidentById } from '@/features/residents/hooks/useResidents';
import { useHouseResidents } from '../../hooks/useHouses';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function ResidentsTab({ houseId }: { houseId: string }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: residents = [], isLoading } = useHouseResidents(houseId);

  const { data: detail } = useResidentById(selectedId ?? '');

  if (isLoading) return <LoadingState />;
  if (residents.length === 0) return <EmptyState title="Nenhum filho cadastrado nesta casa." />;

  return (
    <>
      <div className="space-y-1">
        {residents.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground">Entrada: {formatDate(r.entryDate)}</p>
            </div>
            <Badge variant={RESIDENT_STATUS_VARIANT[r.status as ResidentStatus] ?? 'outline'}>
              {RESIDENT_STATUS_LABELS[r.status as ResidentStatus] ?? r.status}
            </Badge>
          </button>
        ))}
      </div>

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Filho</DialogTitle>
          </DialogHeader>
          {!detail ? (
            <LoadingState />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {detail.photoUrl ? (
                  <img src={api.photoUrl(detail.photoThumbUrl ?? detail.photoUrl)!} alt={detail.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User size={24} className="text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-base">{detail.name}</p>
                  <Badge variant={RESIDENT_STATUS_VARIANT[detail.status]} className="mt-1">
                    {RESIDENT_STATUS_LABELS[detail.status]}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <span className="text-muted-foreground">Entrada</span>
                <span>{formatDate(detail.entryDate)}</span>
                <span className="text-muted-foreground">Idade</span>
                <span>{calcAge(detail.birthDate) !== null ? `${calcAge(detail.birthDate)} anos` : '—'}</span>
                <span className="text-muted-foreground">CPF</span>
                <span>{detail.cpf || '—'}</span>
                <span className="text-muted-foreground">RG</span>
                <span>{detail.rg || '—'}</span>
                <span className="text-muted-foreground">Telefone</span>
                <span>{detail.contactPhone || '—'}</span>
                <span className="text-muted-foreground">Ocupação</span>
                <span>{detail.occupation || '—'}</span>
                {detail.addiction && (
                  <>
                    <span className="text-muted-foreground">Dependência</span>
                    <span>{detail.addiction}</span>
                  </>
                )}
                {detail.healthIssues && (
                  <>
                    <span className="text-muted-foreground">Saúde</span>
                    <span>{detail.healthIssues}</span>
                  </>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); navigate(`/residents/${detail.id}`); }}>
                  Ver página completa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
