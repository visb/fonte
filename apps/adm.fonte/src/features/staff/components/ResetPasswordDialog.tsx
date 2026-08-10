import { useState } from 'react';
import { Copy } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/shared/PasswordInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useResetStaffPassword } from '../hooks/useStaff';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generatePassword(len = 12) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

interface Props {
  open: boolean;
  onClose: () => void;
  staff: { id: string; name: string } | null;
}

export function ResetPasswordDialog({ open, onClose, staff }: Props) {
  const [password] = useState(() => generatePassword());
  const [copied, setCopied] = useState(false);

  const mutation = useResetStaffPassword(staff?.id ?? '');

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    if (!staff) return;
    mutation.mutate(password, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar Senha</DialogTitle>
          <DialogDescription>
            Uma nova senha será gerada para <strong>{staff?.name}</strong>. O servo deverá alterá-la no próximo acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <PasswordInput
              containerClassName="flex-1"
              value={password}
              readOnly
              className="font-mono"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              <Copy size={14} className="mr-1" />
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Copie e envie esta senha ao servo via WhatsApp antes de confirmar.
          </p>
          {mutation.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutation.error, 'Erro ao resetar senha.')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Confirmar Reset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
