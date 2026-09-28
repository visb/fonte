import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';
import { CreateInventoryItemDialog } from './CreateInventoryItemDialog';

export function CatalogProductPicker({ value, items, houseId, loading, onSelect }: {
  value: string; items: InventoryCatalogItem[]; houseId?: string; loading?: boolean;
  onSelect: (item: InventoryCatalogItem) => void;
}) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = items.filter((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) || item.id === value);
  const close = () => { setCreating(false); searchRef.current?.focus(); };
  return <div className="space-y-2">
    <Input ref={searchRef} aria-label="Buscar produto" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
    <Select aria-label="Produto do catálogo" value={value} onChange={(e) => {
      const item = items.find((row) => row.id === e.target.value);
      if (item) onSelect(item);
    }}>
      <option value="">{loading ? 'Carregando catálogo...' : 'Selecione um produto'}</option>
      {filtered.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
    </Select>
    {!!houseId && !!search.trim() && !items.some((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) &&
      <Button type="button" variant="outline" onClick={() => setCreating(true)}>Cadastrar «{search.trim()}»</Button>}
    {creating && houseId && <CreateInventoryItemDialog name={search.trim()} houseId={houseId} onClose={close}
      onCreated={(item) => { onSelect(item); setSearch(''); }} />}
  </div>;
}
