import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, Upload, X } from 'lucide-react';
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
import { useDeclareContribution } from '../hooks/useResidents';

const schema = z.object({
  date: z.string().min(1, 'Informe a data'),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const todayIso = () => new Date().toISOString().split('T')[0];

const PAYMENT_METHODS = [
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'Crédito', label: 'Cartão de Crédito' },
  { value: 'Débito', label: 'Cartão de Débito' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  resident: { id: string; name: string };
}

export function DeclarePaymentDialog({ open, onClose, resident }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mutation = useDeclareContribution(resident.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: todayIso(), paymentMethod: '', notes: '' },
  });

  const handleClose = () => {
    reset({ date: todayIso(), paymentMethod: '', notes: '' });
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    mutation.reset();
    onClose();
  };

  const onSubmit = (values: FormValues) => {
    const parts: string[] = [];
    if (values.paymentMethod) parts.push(values.paymentMethod);
    if (values.notes?.trim()) parts.push(values.notes.trim());
    const description = parts.join(' — ') || undefined;

    mutation.mutate(
      { date: values.date, description, file: file ?? null },
      { onSuccess: handleClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Declarar pagamento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{resident.name}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <FormField label="Data do pagamento" error={errors.date?.message}>
            <Input type="date" {...register('date')} />
          </FormField>

          <FormField label="Forma de pagamento">
            <Select {...register('paymentMethod')}>
              <option value="">Selecione...</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
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
            <Textarea
              {...register('notes')}
              placeholder="Alguma observação adicional..."
              rows={2}
            />
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
