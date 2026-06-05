import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, Upload, X } from 'lucide-react';
import { FamilyInvestment, PaymentMethod } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FAMILY_INVESTMENT_LABELS, PAYMENT_METHOD_LABELS } from '../constants';
import { useRegisterReceivablePayment } from '../hooks/useResidentReceivables';
import { formatReferenceMonth } from '../lib/receivables';

const schema = z.object({
  paidAt: z.string().min(1, 'Informe a data'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidFamilyInvestment: z.nativeEnum(FamilyInvestment),
  paidAmount: z.coerce.number().int().min(0, 'Valor inválido'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const todayIso = () => new Date().toISOString().split('T')[0];

function defaultsFor(receivable: ResidentReceivable | null): FormValues {
  return {
    paidAt: todayIso(),
    paymentMethod: PaymentMethod.PIX,
    paidFamilyInvestment: receivable?.familyInvestment ?? FamilyInvestment.PAYMENT_700,
    paidAmount: receivable?.amount ?? 0,
    notes: '',
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  residentId: string;
  residentName: string;
  receivable: ResidentReceivable | null;
}

export function RegisterPaymentDialog({ open, onClose, residentId, residentName, receivable }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mutation = useRegisterReceivablePayment(residentId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(receivable),
  });

  // The dialog instance is reused across installments — reapply defaults when the
  // target receivable changes so modality/amount reflect the selected plan.
  useEffect(() => {
    if (open && receivable) reset(defaultsFor(receivable));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receivable?.id]);

  const handleClose = () => {
    reset(defaultsFor(receivable));
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    mutation.reset();
    onClose();
  };

  const onSubmit = (values: FormValues) => {
    if (!receivable) return;
    mutation.mutate(
      {
        receivableId: receivable.id,
        paidAt: values.paidAt,
        paymentMethod: values.paymentMethod,
        paidAmount: values.paidAmount,
        paidFamilyInvestment: values.paidFamilyInvestment,
        notes: values.notes?.trim() || undefined,
        file: file ?? null,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>
        <div>
          <p className="text-sm text-muted-foreground">{residentName}</p>
          {receivable && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Referente a {formatReferenceMonth(receivable.referenceMonth)} — R$ {receivable.amount}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <FormField label="Data do pagamento" error={errors.paidAt?.message}>
            <Input type="date" {...register('paidAt')} />
          </FormField>

          <FormField label="Forma de pagamento" error={errors.paymentMethod?.message}>
            <Select {...register('paymentMethod')}>
              {Object.values(PaymentMethod).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Modalidade" error={errors.paidFamilyInvestment?.message}>
            <Select {...register('paidFamilyInvestment')}>
              {Object.values(FamilyInvestment).map((m) => (
                <option key={m} value={m}>
                  {FAMILY_INVESTMENT_LABELS[m]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Valor pago (R$)" error={errors.paidAmount?.message}>
            <Input type="number" min={0} {...register('paidAmount', { valueAsNumber: true })} />
          </FormField>

          <FormField label="Comprovante (opcional)">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                <Paperclip size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{file.name}</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-input bg-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-ring hover:text-foreground transition-colors"
              >
                <Upload size={14} className="shrink-0" />
                <span>Clique para anexar arquivo</span>
              </button>
            )}
          </FormField>

          <FormField label="Observação (opcional)">
            <Textarea {...register('notes')} placeholder="Alguma observação adicional..." rows={2} />
          </FormField>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutation.error, 'Erro ao registrar pagamento.')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || !receivable}>
              {mutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
