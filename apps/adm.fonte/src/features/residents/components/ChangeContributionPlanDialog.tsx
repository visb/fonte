import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FamilyInvestment } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FAMILY_INVESTMENT_LABELS } from '../constants';
import { useUpdateContributionPlan } from '../hooks/useResidentReceivables';

// Campos numéricos opcionais: input vazio ('') deve virar undefined, senão
// z.coerce.number('') => 0 e dispara as validações de mínimo indevidamente.
const optionalInt = (inner: z.ZodNumber) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : v), inner.optional());

const schema = z
  .object({
    familyInvestment: z.nativeEnum(FamilyInvestment),
    familyInvestmentAmount: optionalInt(z.coerce.number().int().min(0)),
    contributionDueDay: optionalInt(z.coerce.number().int().min(1).max(31)),
  })
  .refine(
    (v) => v.familyInvestment !== FamilyInvestment.NEGOTIATED || (v.familyInvestmentAmount ?? 0) > 0,
    { message: 'Informe o valor negociado', path: ['familyInvestmentAmount'] },
  );

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  resident: Resident;
}

export function ChangeContributionPlanDialog({ open, onClose, resident }: Props) {
  const mutation = useUpdateContributionPlan(resident.id);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      familyInvestment: resident.familyInvestment ?? FamilyInvestment.PAYMENT_700,
      familyInvestmentAmount: resident.familyInvestmentAmount ?? undefined,
      contributionDueDay: resident.contributionDueDay ?? undefined,
    },
  });

  const plan = watch('familyInvestment');

  const handleClose = () => {
    reset();
    mutation.reset();
    onClose();
  };

  const onSubmit = (values: FormValues) => {
    mutation.mutate(
      {
        familyInvestment: values.familyInvestment,
        familyInvestmentAmount:
          values.familyInvestment === FamilyInvestment.NEGOTIATED ? values.familyInvestmentAmount : null,
        contributionDueDay: values.contributionDueDay ?? null,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar plano de contribuição</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <FormField label="Plano" error={errors.familyInvestment?.message}>
            <Select {...register('familyInvestment')}>
              {Object.values(FamilyInvestment).map((p) => (
                <option key={p} value={p}>
                  {FAMILY_INVESTMENT_LABELS[p]}
                </option>
              ))}
            </Select>
          </FormField>

          {plan === FamilyInvestment.NEGOTIATED && (
            <FormField label="Valor negociado (R$)" error={errors.familyInvestmentAmount?.message}>
              <Input type="number" min={0} step={1} {...register('familyInvestmentAmount')} />
            </FormField>
          )}

          <FormField label="Dia de vencimento (opcional)" error={errors.contributionDueDay?.message}>
            <Input type="number" min={1} max={31} placeholder="Mesmo dia do acolhimento" {...register('contributionDueDay')} />
          </FormField>

          <p className="text-xs text-muted-foreground">
            As parcelas futuras em aberto passam a usar o novo valor e vencimento. Parcelas já pagas não mudam.
          </p>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutation.error, 'Erro ao alterar plano.')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
