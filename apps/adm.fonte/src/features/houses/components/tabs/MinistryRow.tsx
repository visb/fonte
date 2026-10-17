import { Pencil, Trash2, Users } from 'lucide-react';
import type { HouseMinistry } from '@fonte/api-client';
import { Button } from '@/components/ui/button';

interface Props {
  ministry: HouseMinistry;
  onEditLeader: () => void;
  onManageResidents: () => void;
  onRemove: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Linha da aba Ministérios: contagem separada de servos e filhos (story 205, decisão 10). */
export function MinistryRow({ ministry, onEditLeader, onManageResidents, onRemove }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="font-medium text-sm">{ministry.name}</p>
        <p className="text-xs text-muted-foreground">
          Responsável: {ministry.leaderName ?? 'Não definido'}
          {' · '}
          {plural(ministry.servoCount, 'servo', 'servos')}
          {' · '}
          {plural(ministry.filhoCount ?? 0, 'filho', 'filhos')}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Filhos do ministério"
          onClick={onManageResidents}>
          <Users size={13} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar responsável"
          onClick={onEditLeader}>
          <Pencil size={13} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Remover ministério"
          onClick={onRemove}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}
