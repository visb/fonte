import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { ActivityStatus } from '@fonte/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { useCreateActivity } from '../hooks/useActivities';

const quickAddSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
});
type QuickAddData = z.infer<typeof quickAddSchema>;

interface Props {
  status: ActivityStatus;
}

/**
 * Criação rápida estilo Trello no rodapé de uma coluna: digita o título,
 * Enter cria. Após sucesso limpa o campo e mantém o modo de adição aberto
 * (permite criar vários em sequência). Esc/blur com campo vazio cancela.
 */
export function QuickAddCard({ status }: Props) {
  const [adding, setAdding] = useState(false);
  const createMutation = useCreateActivity();
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    getValues,
    formState: { errors },
  } = useForm<QuickAddData>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { title: '' },
  });

  const open = () => {
    setAdding(true);
    createMutation.reset();
    // foca no próximo tick, quando o input já está montado
    setTimeout(() => setFocus('title'), 0);
  };

  const close = () => {
    setAdding(false);
    reset({ title: '' });
    createMutation.reset();
  };

  const onSubmit = (data: QuickAddData) => {
    createMutation.mutate(
      { title: data.title, status },
      {
        onSuccess: () => {
          reset({ title: '' });
          setFocus('title');
        },
      },
    );
  };

  const handleBlur = () => {
    if (!getValues('title').trim()) close();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!adding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start text-muted-foreground"
        onClick={open}
      >
        <Plus size={14} className="mr-1.5" />
        Adicionar atividade
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-1 rounded-md border bg-card p-2 shadow-sm"
    >
      <Input
        {...register('title')}
        placeholder="Título da atividade"
        aria-label="Título da nova atividade"
        autoFocus
        disabled={createMutation.isPending}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {errors.title && (
        <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>
      )}
      {createMutation.error != null && (
        <p className="mt-1 text-xs text-destructive">
          {getErrorMessage(createMutation.error, 'Erro ao criar atividade.')}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <Button type="submit" size="sm" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Adicionando...' : 'Adicionar'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
