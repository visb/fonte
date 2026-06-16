import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Payable } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { payableSchema, type PayableFormData } from '../lib/payableSchema';
import { centsToReais } from '../lib/money';
import { PAYABLE_CATEGORIES, PAYABLE_CATEGORY_LABELS } from '../constants';

interface Props {
  payable?: Payable | null;
  isPending: boolean;
  error: unknown;
  onSubmit: (data: PayableFormData) => void;
  onCancel: () => void;
}

export function PayableForm({ payable, isPending, error, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PayableFormData>({ resolver: zodResolver(payableSchema) });

  useEffect(() => {
    if (payable) {
      reset({
        description: payable.description,
        amount: centsToReais(payable.amount),
        dueDate: payable.dueDate,
        category: payable.category,
        supplier: payable.supplier ?? '',
        notes: payable.notes ?? '',
      });
    } else {
      reset({
        description: '',
        amount: undefined,
        dueDate: '',
        category: undefined,
        supplier: '',
        notes: '',
      });
    }
  }, [payable, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <Label htmlFor="pay-description">Descrição *</Label>
          <Input
            id="pay-description"
            {...register('description')}
            placeholder="Ex: Conta de luz - junho"
            autoFocus
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pay-amount">Valor (R$) *</Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0"
              {...register('amount')}
              placeholder="250,00"
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay-due-date">Vencimento *</Label>
            <Input id="pay-due-date" type="date" {...register('dueDate')} />
            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pay-category">Categoria *</Label>
            <Select id="pay-category" defaultValue="" {...register('category')}>
              <option value="" disabled>
                Selecione
              </option>
              {PAYABLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PAYABLE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay-supplier">Fornecedor</Label>
            <Input id="pay-supplier" {...register('supplier')} placeholder="Opcional" />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pay-notes">Observação</Label>
          <Textarea id="pay-notes" {...register('notes')} placeholder="Opcional" rows={2} />
        </div>

        {error != null && (
          <p className="text-xs text-destructive">
            {getErrorMessage(error, 'Erro ao salvar conta.')}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isPending}>
          {isPending ? 'Salvando...' : payable ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
