import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Pencil, RotateCcw, Trash2, UserMinus } from 'lucide-react';
import { Role } from '@fonte/types';
import type { Staff } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { DismissStaffDialog } from './DismissStaffDialog';
import { ReinstateStaffDialog } from './ReinstateStaffDialog';
import { DeleteStaffDialog } from './DeleteStaffDialog';

type OpenDialog = 'reset' | 'dismiss' | 'reinstate' | 'delete' | null;

/**
 * Story 217 — ações do cabeçalho do detalhe do servo. Ativo: "Desligar" (ação
 * principal de saída) + "Resetar senha"; desligado: "Reintegrar" (sem resetar
 * senha — não há acesso). "Excluir cadastro" é secundária. Desligar,
 * reintegrar e excluir são só do ADMIN.
 */
export function StaffDetailActions({ staff }: { staff: Staff }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === Role.ADMIN;
  const dismissed = !!staff.dismissedAt;
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const close = () => setDialog(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!dismissed && (
        <Button variant="outline" size="sm" onClick={() => setDialog('reset')}>
          <KeyRound size={14} className="mr-2" />
          Resetar senha
        </Button>
      )}
      <Button asChild variant="outline" size="sm">
        <Link to={`/staff/${staff.id}/edit`}>
          <Pencil size={14} className="mr-2" />
          Editar
        </Link>
      </Button>
      {isAdmin && !dismissed && (
        <Button variant="destructive" size="sm" onClick={() => setDialog('dismiss')}>
          <UserMinus size={14} className="mr-2" />
          Desligar
        </Button>
      )}
      {isAdmin && dismissed && (
        <Button size="sm" onClick={() => setDialog('reinstate')}>
          <RotateCcw size={14} className="mr-2" />
          Reintegrar
        </Button>
      )}
      {isAdmin && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDialog('delete')}
        >
          <Trash2 size={14} className="mr-2" />
          Excluir cadastro
        </Button>
      )}

      <ResetPasswordDialog open={dialog === 'reset'} onClose={close} staff={staff} />
      {isAdmin && (
        <>
          <DismissStaffDialog open={dialog === 'dismiss'} onClose={close} staffId={staff.id} staffName={staff.name} />
          <ReinstateStaffDialog open={dialog === 'reinstate'} onClose={close} staffId={staff.id} houseId={staff.houseId} />
          <DeleteStaffDialog
            staff={dialog === 'delete' ? staff : null}
            onClose={close}
            onDeleted={() => navigate('/staff')}
          />
        </>
      )}
    </div>
  );
}
