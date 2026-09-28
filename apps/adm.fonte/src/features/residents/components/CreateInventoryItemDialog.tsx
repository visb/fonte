import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SupplyRoomCategory } from '@fonte/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { getErrorMessage } from '@/lib/errors';
import { inventoryItemSchema, useCreateInventoryItem, type InventoryItemInput } from '../hooks/useCreateInventoryItem';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';

const categories: Record<SupplyRoomCategory, string> = {
  CLEANING: 'Limpeza', HYGIENE: 'Higiene', PPE: 'EPI', OFFICE: 'Escritório', OTHER: 'Outros',
};

export function CreateInventoryItemDialog({ name, houseId, onClose, onCreated }: {
  name: string; houseId: string; onClose: () => void; onCreated: (item: InventoryCatalogItem) => void;
}) {
  const mutation = useCreateInventoryItem(houseId);
  const { register, watch, handleSubmit, formState: { errors } } = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema), defaultValues: { name, unit: '', target: 'storeroom' },
  });
  const submit = handleSubmit(async (input) => {
    try {
      const item = await mutation.mutateAsync(input);
      onCreated(item);
      toast.success('Produto cadastrado.');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível cadastrar o produto.'));
    }
  });
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); onClose(); }}>
      <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
      <form onSubmit={(event) => { event.stopPropagation(); void submit(event); }} className="space-y-3">
        <FormField label="Nome" error={errors.name?.message}><Input aria-label="Nome do produto" {...register('name')} /></FormField>
        <FormField label="Unidade" error={errors.unit?.message}><Input aria-label="Unidade do produto" {...register('unit')} /></FormField>
        <FormField label="Destino"><Select aria-label="Destino" {...register('target')}>
          <option value="storeroom">Dispensa</option><option value="supply">Almoxarifado</option>
        </Select></FormField>
        {watch('target') === 'supply' && <FormField label="Categoria" error={'category' in errors ? errors.category?.message : undefined}>
          <Select aria-label="Categoria" {...register('category')}><option value="">Selecione uma categoria</option>
            {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar cadastro</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Cadastrando...' : 'Cadastrar produto'}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
