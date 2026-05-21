import { Building2, KeyRound, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { Role } from '@fonte/types';
import type { Staff } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ROLE_LABEL: Record<string, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.OPERATOR]: 'Operador',
};

const ROLE_VARIANT: Record<string, 'destructive' | 'info' | 'secondary'> = {
  [Role.ADMIN]: 'destructive',
  [Role.COORDINATOR]: 'info',
  [Role.OPERATOR]: 'secondary',
};

interface Props {
  staff: Staff;
  onEdit: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
}

export function StaffCard({ staff: s, onEdit, onResetPassword, onDelete }: Props) {
  return (
    <div className="flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{s.name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
          {s.house && (
            <span className="flex items-center gap-1">
              <Building2 size={13} />
              {s.house.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Mail size={13} />
            {s.user.email}
          </span>
          {s.phone && (
            <span className="flex items-center gap-1">
              <Phone size={13} />
              {s.phone}
            </span>
          )}
        </div>
      </div>
      <Badge variant={ROLE_VARIANT[s.user.role] ?? 'secondary'}>
        {ROLE_LABEL[s.user.role] ?? s.user.role}
      </Badge>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
          <Pencil size={16} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onResetPassword} title="Resetar senha">
          <KeyRound size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Excluir"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}
