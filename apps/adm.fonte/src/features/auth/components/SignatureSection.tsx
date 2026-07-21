import { useState } from 'react';
import { PenLine, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useStaffMe } from '@/features/staff/hooks/useStaff';
import { SignatureDialog } from './SignatureDialog';
import { RemoveSignatureDialog } from './RemoveSignatureDialog';

export function SignatureSection() {
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { data: me } = useStaffMe();
  const hasSignature = !!me?.signatureUrl;
  const signatureUrl = api.photoUrl(me?.signatureUrl ?? null);

  return (
    <div className="space-y-2">
      <Label>Assinatura</Label>
      <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
        {signatureUrl ? (
          <img
            src={signatureUrl}
            alt="Sua assinatura"
            className="h-16 w-auto max-w-[220px] object-contain"
          />
        ) : (
          <p className="flex-1 text-sm text-muted-foreground">
            Nenhuma assinatura configurada.
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {hasSignature && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 size={14} />
              Redefinir
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setOpen(true)}
          >
            <PenLine size={14} />
            {hasSignature ? 'Redesenhar' : 'Configurar assinatura'}
          </Button>
        </div>
      </div>

      <SignatureDialog open={open} onClose={() => setOpen(false)} />
      <RemoveSignatureDialog open={confirmRemove} onClose={() => setConfirmRemove(false)} />
    </div>
  );
}
