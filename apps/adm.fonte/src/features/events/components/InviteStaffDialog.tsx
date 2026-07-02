import { useMemo, useState } from 'react';
import type { Event } from '@fonte/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useStaff } from '@/features/staff/hooks/useStaff';
import { useInviteEventStaff } from '../hooks/useEvents';
import { InviteStaffRow } from './InviteStaffRow';
import { InviteStaffSummary } from './InviteStaffSummary';

interface Props {
  open: boolean;
  event: Event | null;
  onClose: () => void;
}

/**
 * Convite via WhatsApp aos servos selecionados (story 95). Dialog
 * autossuficiente: busca os servos elegíveis e dispara a mutation, com filtro
 * por casa e "selecionar todos". Após o envio mostra o resumo enviados/pulados.
 */
export function InviteStaffDialog({ open, event, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [houseFilter, setHouseFilter] = useState('all');

  const { data: staff = [], isLoading, error, refetch } = useStaff({ enabled: open });
  const mutation = useInviteEventStaff(event?.id ?? '');

  const houses = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach((s) => s.house && map.set(s.house.id, s.house.name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [staff]);

  const filtered = useMemo(
    () => (houseFilter === 'all' ? staff : staff.filter((s) => s.houseId === houseFilter)),
    [staff, houseFilter],
  );

  const staffNames = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff]);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggle = (staffId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((s) => next.delete(s.id));
      else filtered.forEach((s) => next.add(s.id));
      return next;
    });
  };

  const close = () => {
    setSelected(new Set());
    setHouseFilter('all');
    mutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar servos — {event?.title}</DialogTitle>
          <DialogDescription>
            Envia o convite por WhatsApp com o link da página do evento.
          </DialogDescription>
        </DialogHeader>

        {mutation.isSuccess ? (
          <>
            <InviteStaffSummary result={mutation.data} staffNames={staffNames} />
            <DialogFooter>
              <Button data-testid="invite-close" onClick={close}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={getErrorMessage(error, 'Erro ao carregar servos.')} onRetry={refetch} />
        ) : staff.length === 0 ? (
          <EmptyState title="Nenhum servo cadastrado." />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select
                aria-label="Filtrar por casa"
                value={houseFilter}
                onChange={(e) => setHouseFilter(e.target.value)}
                className="h-9 flex-1"
              >
                <option value="all">Todas as casas</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={toggleAllFiltered}>
                {allFilteredSelected ? 'Limpar seleção' : 'Selecionar todos'}
              </Button>
            </div>

            <div className="space-y-1.5">
              {filtered.map((s) => (
                <InviteStaffRow key={s.id} staff={s} checked={selected.has(s.id)} onToggle={toggle} />
              ))}
            </div>

            {mutation.isError && (
              <p className="text-sm text-destructive">
                {getErrorMessage(mutation.error, 'Erro ao enviar convites.')}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button
                disabled={selected.size === 0 || mutation.isPending}
                onClick={() => mutation.mutate([...selected])}
              >
                {mutation.isPending
                  ? 'Enviando...'
                  : `Enviar convites (${selected.size})`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
