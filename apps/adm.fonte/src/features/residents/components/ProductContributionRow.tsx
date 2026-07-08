import { useWatch, type Control, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PaymentFormValues } from './RegisterPaymentDialog';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';

interface LineErrors {
  inventoryItemId?: { message?: string };
  description?: { message?: string };
  quantity?: { message?: string };
}

interface Props {
  index: number;
  register: UseFormRegister<PaymentFormValues>;
  control: Control<PaymentFormValues>;
  setValue: UseFormSetValue<PaymentFormValues>;
  catalog: InventoryCatalogItem[];
  catalogLoading?: boolean;
  errors?: LineErrors;
  onRemove: () => void;
}

export function ProductContributionRow({
  index,
  register,
  control,
  setValue,
  catalog,
  catalogLoading,
  errors,
  onRemove,
}: Props) {
  const mode = useWatch({ control, name: `products.${index}.mode` });
  const unit = useWatch({ control, name: `products.${index}.unit` });

  const setMode = (m: 'catalog' | 'avulso') => {
    setValue(`products.${index}.mode`, m, { shouldValidate: false });
  };

  const itemField = register(`products.${index}.inventoryItemId`);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border bg-background p-0.5" role="group" aria-label="Tipo do produto">
          <button
            type="button"
            onClick={() => setMode('catalog')}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'catalog' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            Do catálogo
          </button>
          <button
            type="button"
            onClick={() => setMode('avulso')}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'avulso' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            Avulso
          </button>
        </div>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remover produto"
          className="h-8 w-8"
        >
          <Trash2 size={15} />
        </Button>
      </div>

      {mode === 'catalog' ? (
        <div className="space-y-2">
          <div>
            <Select
              aria-label="Produto do catálogo"
              {...itemField}
              onChange={(e) => {
                itemField.onChange(e);
                const item = catalog.find((i) => i.id === e.target.value);
                setValue(`products.${index}.unit`, item?.unit ?? '');
              }}
            >
              <option value="">{catalogLoading ? 'Carregando catálogo...' : 'Selecione um produto'}</option>
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </Select>
            {errors?.inventoryItemId?.message && (
              <p className="mt-1 text-xs text-destructive">{errors.inventoryItemId.message}</p>
            )}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Quantidade"
                aria-label="Quantidade"
                {...register(`products.${index}.quantity`)}
              />
            </div>
            <span className="pb-2.5 text-sm text-muted-foreground min-w-8">{unit || '—'}</span>
          </div>
          {errors?.quantity?.message && (
            <p className="text-xs text-destructive">{errors.quantity.message}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <Input
              placeholder="Descrição (ex: cesta básica)"
              aria-label="Descrição"
              {...register(`products.${index}.description`)}
            />
            {errors?.description?.message && (
              <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Qtd. (opcional)"
              aria-label="Quantidade"
              {...register(`products.${index}.quantity`)}
            />
            <Input
              placeholder="Unidade (opcional)"
              aria-label="Unidade"
              {...register(`products.${index}.unit`)}
            />
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Ficará pendente de detalhamento.
          </p>
        </div>
      )}
    </div>
  );
}
