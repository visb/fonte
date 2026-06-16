import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Associate } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { associateSchema, type AssociateFormData } from '../lib/associateSchema';
import { formatWhatsapp, toE164 } from '../lib/whatsappMask';

interface Props {
  associate?: Associate | null;
  isPending: boolean;
  error: unknown;
  onSubmit: (data: AssociateFormData) => void;
  onCancel: () => void;
}

export function AssociateForm({ associate, isPending, error, onSubmit, onCancel }: Props) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssociateFormData>({ resolver: zodResolver(associateSchema) });

  useEffect(() => {
    if (associate) {
      reset({
        name: associate.name,
        whatsapp: associate.whatsapp,
        email: associate.email ?? '',
        contributionAmount: associate.contributionAmount,
        dueDay: associate.dueDay,
      });
    } else {
      reset({ name: '', whatsapp: '', email: '', contributionAmount: undefined, dueDay: undefined });
    }
  }, [associate, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <Label htmlFor="assoc-name">Nome *</Label>
          <Input id="assoc-name" {...register('name')} placeholder="Ex: Maria da Silva" autoFocus />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="assoc-whatsapp">WhatsApp *</Label>
          <Controller
            control={control}
            name="whatsapp"
            render={({ field }) => (
              <Input
                id="assoc-whatsapp"
                placeholder="+55 (62) 99999-8888"
                inputMode="tel"
                value={formatWhatsapp(field.value ?? '')}
                onChange={(e) => field.onChange(toE164(e.target.value))}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="assoc-email">E-mail</Label>
          <Input id="assoc-email" type="email" {...register('email')} placeholder="Opcional" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="assoc-amount">Contribuição (R$) *</Label>
            <Input
              id="assoc-amount"
              type="number"
              step="0.01"
              min="0"
              {...register('contributionAmount')}
              placeholder="50,00"
            />
            {errors.contributionAmount && (
              <p className="text-xs text-destructive">{errors.contributionAmount.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="assoc-due-day">Dia de vencimento *</Label>
            <Input
              id="assoc-due-day"
              type="number"
              min="1"
              max="31"
              {...register('dueDay')}
              placeholder="10"
            />
            {errors.dueDay && <p className="text-xs text-destructive">{errors.dueDay.message}</p>}
          </div>
        </div>

        {error != null && (
          <p className="text-xs text-destructive">{getErrorMessage(error, 'Erro ao salvar associado.')}</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isPending}>
          {isPending ? 'Salvando...' : associate ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}
