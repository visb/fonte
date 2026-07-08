import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, Plus, Upload, X } from 'lucide-react';
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
import {
  useDeclareProductContribution,
  useInventoryCatalog,
} from '../hooks/useProductContributions';
import {
  emptyProductLine,
  productLineSchema,
  toContributionLines,
} from '../lib/productContributions';
import { formatReferenceMonth } from '../lib/receivables';
import { ProductContributionRow } from './ProductContributionRow';

export const paymentFormSchema = z
  .object({
    registerMoney: z.boolean(),
    paidAt: z.string(),
    paymentMethod: z.nativeEnum(PaymentMethod),
    paidFamilyInvestment: z.nativeEnum(FamilyInvestment),
    paidAmount: z.coerce.number().int().min(0, 'Valor inválido'),
    notes: z.string().optional(),
    products: z.array(productLineSchema),
  })
  .superRefine((v, ctx) => {
    if (v.registerMoney && !v.paidAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paidAt'], message: 'Informe a data' });
    }
    if (!v.registerMoney && v.products.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['products'],
        message: 'Registre o pagamento em dinheiro ou adicione ao menos um produto.',
      });
    }
  });

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const todayIso = () => new Date().toISOString().split('T')[0];

function defaultsFor(receivable: ResidentReceivable | null): PaymentFormValues {
  return {
    registerMoney: true,
    paidAt: todayIso(),
    paymentMethod: PaymentMethod.PIX,
    paidFamilyInvestment: receivable?.familyInvestment ?? FamilyInvestment.PAYMENT_700,
    paidAmount: receivable?.amount ?? 0,
    notes: '',
    products: [],
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  residentId: string;
  residentName: string;
  houseId: string;
  receivable: ResidentReceivable | null;
}

export function RegisterPaymentDialog({
  open,
  onClose,
  residentId,
  residentName,
  houseId,
  receivable,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const paymentMutation = useRegisterReceivablePayment(residentId);
  const productMutation = useDeclareProductContribution(residentId);
  const { data: catalog = [], isLoading: catalogLoading } = useInventoryCatalog(houseId, {
    enabled: open && !!houseId,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: defaultsFor(receivable),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'products' });
  const registerMoney = watch('registerMoney');

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
    paymentMutation.reset();
    productMutation.reset();
    onClose();
  };

  const onSubmit = async (values: PaymentFormValues) => {
    if (!receivable) return;
    try {
      if (values.registerMoney) {
        await paymentMutation.mutateAsync({
          receivableId: receivable.id,
          paidAt: values.paidAt,
          paymentMethod: values.paymentMethod,
          paidAmount: values.paidAmount,
          paidFamilyInvestment: values.paidFamilyInvestment,
          notes: values.notes?.trim() || undefined,
          file: file ?? null,
        });
      }
      if (values.products.length > 0) {
        await productMutation.mutateAsync({
          receivableId: receivable.id,
          lines: toContributionLines(values.products),
        });
      }
      handleClose();
    } catch {
      // Erros são exibidos via estado das mutations abaixo.
    }
  };

  const isPending = paymentMutation.isPending || productMutation.isPending;
  const mutationError = paymentMutation.error ?? productMutation.error;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar contribuição</DialogTitle>
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
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" {...register('registerMoney')} className="h-4 w-4" />
            Registrar pagamento em dinheiro
          </label>

          {registerMoney && (
            <div className="space-y-3 rounded-lg border p-3">
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
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Produtos</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append(emptyProductLine())}
              >
                <Plus size={14} /> Adicionar produto
              </Button>
            </div>
            {fields.map((field, index) => (
              <ProductContributionRow
                key={field.id}
                index={index}
                register={register}
                control={control}
                setValue={setValue}
                catalog={catalog}
                catalogLoading={catalogLoading}
                errors={errors.products?.[index]}
                onRemove={() => remove(index)}
              />
            ))}
            {typeof errors.products?.message === 'string' && (
              <p className="text-sm text-destructive">{errors.products.message}</p>
            )}
          </div>

          {mutationError && (
            <p className="text-sm text-destructive">
              {getErrorMessage(mutationError, 'Erro ao registrar a contribuição.')}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !receivable}>
              {isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
