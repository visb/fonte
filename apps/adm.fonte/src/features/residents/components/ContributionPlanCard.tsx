import { useState } from 'react';
import { Pencil, ShieldOff, ShieldCheck } from 'lucide-react';
import { FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FAMILY_INVESTMENT_LABELS } from '../constants';
import { useSetContributionExempt } from '../hooks/useResidentReceivables';

interface Props {
  resident: Resident;
  canManage: boolean;
  onChangePlan: () => void;
}

export function ContributionPlanCard({ resident, canManage, onChangePlan }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const exemptMutation = useSetContributionExempt(resident.id);

  const exempt = resident.contributionExempt;
  const isSocial = resident.familyInvestment === FamilyInvestment.SOCIAL;
  const planLabel = resident.familyInvestment ? FAMILY_INVESTMENT_LABELS[resident.familyInvestment] : '—';
  const amount =
    resident.familyInvestment === FamilyInvestment.NEGOTIATED && resident.familyInvestmentAmount != null
      ? ` — R$ ${resident.familyInvestmentAmount}`
      : '';
  const dueDay = resident.contributionDueDay ? `Dia ${resident.contributionDueDay}` : 'Mesmo dia do acolhimento';

  const toggleExempt = () => {
    exemptMutation.mutate(!exempt, { onSuccess: () => setConfirmOpen(false) });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plano</p>
          <p className="font-medium mt-0.5">
            {planLabel}
            {amount}
          </p>
          {!isSocial && !exempt && (
            <p className="text-sm text-muted-foreground mt-0.5">Vencimento: {dueDay}</p>
          )}
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onChangePlan}>
            <Pencil size={14} className="mr-1.5" />
            Alterar plano
          </Button>
        )}
      </div>

      {(exempt || isSocial) && (
        <Badge variant="secondary" className="gap-1">
          <ShieldCheck size={12} />
          Isento de contribuição
        </Badge>
      )}

      {canManage && !isSocial && (
        <div className="flex items-center justify-between border-t pt-3">
          <div className="text-sm">
            <p className="font-medium">{exempt ? 'Acolhido isento' : 'Marcar como isento'}</p>
            <p className="text-xs text-muted-foreground">
              {exempt
                ? 'Sem cobrança obrigatória enquanto isento.'
                : 'Suspende a cobrança obrigatória das parcelas futuras.'}
            </p>
          </div>
          <Button
            variant={exempt ? 'outline' : 'ghost'}
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={exemptMutation.isPending}
          >
            <ShieldOff size={14} className="mr-1.5" />
            {exempt ? 'Remover isenção' : 'Isentar'}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{exempt ? 'Remover isenção?' : 'Isentar acolhido?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {exempt
                ? 'As parcelas obrigatórias voltarão a ser geradas a partir do mês atual.'
                : 'As parcelas obrigatórias futuras em aberto serão canceladas. Parcelas já pagas não mudam.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exemptMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); toggleExempt(); }} disabled={exemptMutation.isPending}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
