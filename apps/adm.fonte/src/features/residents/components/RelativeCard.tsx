import { KeyRound, Phone, Trash2, User } from 'lucide-react';
import type { Relative } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { maskPhone } from '../lib/masks';

interface Props {
  relative: Relative;
  onGenerateAccess: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
}

export function RelativeCard({ relative, onGenerateAccess, onResetPassword, onDelete }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <User size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{relative.name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
          {relative.relationship && <span>{relative.relationship}</span>}
          {relative.phone && (
            <span className="flex items-center gap-1">
              <Phone size={11} />
              {maskPhone(relative.phone)}
            </span>
          )}
          {relative.userId ? (
            <span className="text-green-600">App ativo</span>
          ) : (
            <span>Sem acesso</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {relative.userId ? (
          <Button variant="ghost" size="icon" title="Resetar senha" onClick={onResetPassword}>
            <KeyRound size={15} />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" title="Gerar acesso ao app" onClick={onGenerateAccess}>
            <KeyRound size={15} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </Button>
      </div>
    </div>
  );
}
