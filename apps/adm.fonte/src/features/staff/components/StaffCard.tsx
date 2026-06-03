import { Building2, KeyRound, Mail, Pencil, Phone, Trash2, User } from 'lucide-react';
import { Role } from '@fonte/types';
import type { Staff } from '@fonte/api-client';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SERVANT_RANK_LABELS, SERVANT_RANK_VARIANT } from '../constants';

function StaffAvatar({ url, name }: { url: string | null; name: string }) {
  const src = api.photoUrl(url);
  return (
    <div className="w-10 h-10 rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <User size={18} className="text-muted-foreground" />
      )}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.SERVANT]: 'Servo',
};

const ROLE_VARIANT: Record<string, 'destructive' | 'info' | 'secondary'> = {
  [Role.ADMIN]: 'destructive',
  [Role.COORDINATOR]: 'info',
  [Role.SERVANT]: 'secondary',
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
      <StaffAvatar url={s.photoUrl} name={s.name} />
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
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant={ROLE_VARIANT[s.user.role] ?? 'secondary'}>
          {ROLE_LABEL[s.user.role] ?? s.user.role}
        </Badge>
        {s.user.role === Role.SERVANT && s.rank && (
          <Badge variant={SERVANT_RANK_VARIANT[s.rank]}>{SERVANT_RANK_LABELS[s.rank]}</Badge>
        )}
      </div>
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
