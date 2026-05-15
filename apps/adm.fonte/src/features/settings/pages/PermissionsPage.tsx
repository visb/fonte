import { Check, ShieldCheck } from 'lucide-react';
import { StaffPermissionType, Role } from '@fonte/types';
import type { Staff } from '@fonte/api-client';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useStaff, useStaffPermissions, useAddStaffPermission, useRemoveStaffPermission } from '@/features/staff/hooks/useStaff';

const ROLE_LABEL: Record<string, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.OPERATOR]: 'Operador',
};

const PERMISSIONS = [
  {
    type: StaffPermissionType.MODERATE_MESSAGES,
    label: 'Moderar mensagens e pedidos',
    description: 'Aprovar e rejeitar mensagens e lista de pedidos dos filhos',
  },
  {
    type: StaffPermissionType.SEND_MESSAGES_TO_FAMILIES,
    label: 'Enviar mensagens para famílias',
    description: 'Aparecer na lista de conversas do app.fonte e enviar mensagens diretas',
  },
] as const;

function StaffPermissionRow({ staff }: { staff: Staff }) {
  const { data: permissions = [] } = useStaffPermissions(staff.id);
  const { mutate: add, isPending: adding } = useAddStaffPermission(staff.id);
  const { mutate: remove, isPending: removing } = useRemoveStaffPermission(staff.id);

  const hasPermission = (type: StaffPermissionType) =>
    permissions.some((p) => p.permissionType === type);

  const isLoading = adding || removing;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{staff.name}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABEL[staff.user.role] ?? staff.user.role}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PERMISSIONS.map((perm) => {
          const active = hasPermission(perm.type);
          return (
            <button
              key={perm.type}
              disabled={isLoading}
              title={perm.description}
              onClick={() => active ? remove(perm.type) : add(perm.type)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-foreground',
                isLoading && 'opacity-50 cursor-not-allowed',
              )}
            >
              {active && <Check size={11} />}
              {perm.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PermissionsPage() {
  const { data: staff = [], isLoading } = useStaff();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-muted-foreground" />
        <h2 className="text-lg font-semibold">Permissões</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure quais servos têm acesso a funcionalidades específicas da plataforma.
      </p>

      {isLoading ? (
        <LoadingState />
      ) : staff.length === 0 ? (
        <EmptyState title="Nenhum servo cadastrado." />
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <StaffPermissionRow key={s.id} staff={s} />
          ))}
        </div>
      )}
    </div>
  );
}
