import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ControlledDateInput } from '@/components/shared/ControlledDateInput';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useStaff } from '@/features/staff/hooks/useStaff';
import { ACTION_OPTIONS } from '../constants';
import { auditFiltersSchema, EMPTY_AUDIT_FILTERS, type AuditFiltersForm } from '../utils';

interface Props {
  onApply: (filters: AuditFiltersForm) => void;
}

/** Filtros da trilha (story 199). Aplicar/limpar reinicia a paginação. */
export function AuditFilters({ onApply }: Props) {
  const { data: houses = [] } = useHouses();
  const { data: staff = [] } = useStaff();
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<AuditFiltersForm>({
    resolver: zodResolver(auditFiltersSchema),
    defaultValues: EMPTY_AUDIT_FILTERS,
  });

  const clear = () => {
    reset(EMPTY_AUDIT_FILTERS);
    onApply(EMPTY_AUDIT_FILTERS);
  };

  return (
    <form
      onSubmit={handleSubmit(onApply)}
      className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Filtros da auditoria"
    >
      <div className="space-y-1">
        <Label htmlFor="audit-from">De</Label>
        <ControlledDateInput control={control} name="from" id="audit-from" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-to">Até</Label>
        <ControlledDateInput control={control} name="to" id="audit-to" />
        {errors.to && <p className="text-xs text-destructive">{errors.to.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-action">Ação</Label>
        <Select id="audit-action" {...register('action')}>
          <option value="">Todas</option>
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-outcome">Resultado</Label>
        <Select id="audit-outcome" {...register('outcome')}>
          <option value="">Todos</option>
          <option value="SUCCESS">Sucesso</option>
          <option value="FAILURE">Falha</option>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-house">Casa</Label>
        <Select id="audit-house" {...register('houseId')}>
          <option value="">Todas</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-user">Usuário</Label>
        <Select id="audit-user" {...register('userId')}>
          <option value="">Todos</option>
          {staff
            .filter((s) => !!s.userId)
            .map((s) => (
              <option key={s.id} value={s.userId}>{s.name}</option>
            ))}
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-target">ID do recurso</Label>
        <Input id="audit-target" placeholder="ex.: id do filho" {...register('targetId')} />
        {errors.targetId && <p className="text-xs text-destructive">{errors.targetId.message}</p>}
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">Filtrar</Button>
        <Button type="button" size="sm" variant="ghost" onClick={clear}>Limpar filtros</Button>
      </div>
    </form>
  );
}
