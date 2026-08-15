import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  IMPLEMENTED_RECEIPT_TYPES,
  RECEIPT_TYPE_LABELS,
  ReceiptType,
  TemplateKind,
} from '@fonte/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { useCreateDocumentTemplate } from '../hooks/useDocumentTemplates';

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do template'),
  // Só exigido quando o grupo é Recibos — refinado abaixo, no resolver.
  receiptType: z.nativeEnum(ReceiptType).optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Grupo em que o template nasce: documento do acolhido ou recibo. */
  kind: TemplateKind;
  /** Tipos de recibo JÁ cadastrados — decisão 2: um template por tipo. */
  takenReceiptTypes: ReceiptType[];
}

/**
 * Story 178 — criação de template, ciente do grupo.
 *
 * No grupo Recibos pede o TIPO e oferece apenas os tipos com resolver
 * implementado (`IMPLEMENTED_RECEIPT_TYPES`) menos os já cadastrados: a tela não
 * pode oferecer um recibo que ninguém sabe emitir, nem um segundo template de um
 * tipo que já tem o seu.
 */
export function CreateTemplateDialog({ open, onClose, kind, takenReceiptTypes }: Props) {
  const isReceipt = kind === TemplateKind.RECEIPT;
  const available = IMPLEMENTED_RECEIPT_TYPES.filter((t) => !takenReceiptTypes.includes(t));
  // Valor de enum (string): identidade estável, então serve de dependência.
  const defaultReceiptType = available[0];

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', receiptType: defaultReceiptType },
  });

  // Reabrir o dialog sempre começa em branco — inclusive depois de trocar de
  // grupo (o mesmo componente serve aos dois).
  useEffect(() => {
    if (open) reset({ name: '', receiptType: defaultReceiptType });
  }, [open, kind, defaultReceiptType, reset]);

  const createMutation = useCreateDocumentTemplate();

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        name: data.name.trim(),
        content: '',
        isRequired: false,
        ...(isReceipt ? { kind, receiptType: data.receiptType } : {}),
      },
      { onSuccess: () => onClose() },
    );
  };

  const noTypeLeft = isReceipt && available.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isReceipt ? 'Novo template de recibo' : 'Novo template'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-template-name">Nome do documento</Label>
              <Input
                id="new-template-name"
                {...register('name')}
                placeholder={isReceipt ? 'Ex: Recibo de contribuição' : 'Ex: Termo de Confidencialidade'}
                autoFocus
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            {isReceipt && (
              <div className="space-y-2">
                <Label htmlFor="new-template-receipt-type">Tipo de recibo</Label>
                {noTypeLeft ? (
                  <p className="text-sm text-muted-foreground">
                    Todos os tipos de recibo disponíveis já têm um template cadastrado.
                  </p>
                ) : (
                  <Controller
                    name="receiptType"
                    control={control}
                    render={({ field }) => (
                      <select
                        id="new-template-receipt-type"
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value as ReceiptType)}
                      >
                        {available.map((type) => (
                          <option key={type} value={type}>
                            {RECEIPT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                )}
              </div>
            )}

            {createMutation.isError && (
              <p className="text-sm text-destructive">
                {getErrorMessage(createMutation.error, 'Erro ao criar template.')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending || noTypeLeft}>
              {createMutation.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
