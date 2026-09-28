import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';
import type { CreateCatalogItem } from '../hooks/useCreateCatalogItem';
import { NewInventoryItemForm } from './NewInventoryItemForm';

interface Props {
  /** Id do item atualmente selecionado (`inventoryItemId`). */
  value: string;
  items: InventoryCatalogItem[];
  loading?: boolean;
  error?: string;
  onSelect: (item: InventoryCatalogItem) => void;
  onCreate?: CreateCatalogItem;
  creating?: boolean;
}

/**
 * Seletor de produto do catálogo (story 114): busca por nome com dropdown de
 * itens da casa. Ao escolher, devolve o item ao pai (que grava id + unidade no
 * form). Espelha o `<Select>` do adm num padrão RN (busca + lista tocável).
 */
export function CatalogProductPicker({ value, items, loading, error, onSelect, onCreate, creating }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = items.find((i) => i.id === value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  function handleSelect(item: InventoryCatalogItem) {
    onSelect(item);
    setSearch('');
    setOpen(false);
    setCreateOpen(false);
  }

  return (
    <View>
      {selected && !open ? (
        <TouchableOpacity
          accessibilityLabel="Produto selecionado"
          className="border border-blue-400 rounded-lg px-4 py-3 bg-blue-50 flex-row items-center justify-between"
          onPress={() => setOpen(true)}
        >
          <Text className="text-sm text-gray-900">
            {selected.name} ({selected.unit})
          </Text>
          <Text className="text-xs text-blue-600 font-medium">Trocar</Text>
        </TouchableOpacity>
      ) : (
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
          placeholder={loading ? 'Carregando catálogo...' : 'Buscar produto...'}
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      )}

      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}

      {open && (
        <View className="border border-gray-200 rounded-lg mt-1 bg-white overflow-hidden">
          {filtered.length === 0 ? (
            <View className="px-4 py-3">
              <Text className="text-sm text-gray-400">Nenhum produto encontrado.</Text>
              {!!search.trim() && onCreate && <TouchableOpacity onPress={() => setCreateOpen(true)}>
                <Text className="text-blue-600 py-2">Cadastrar «{search.trim()}»</Text>
              </TouchableOpacity>}
            </View>
          ) : (
            filtered.map((item) => (
              // Story 183: alvo nomeado da linha. Sem ele o e2e só tem o nome do
              // item para mirar, que é exatamente o texto já digitado no campo de
              // busca — o tap cai no TextInput e nada é selecionado.
              <TouchableOpacity
                key={item.id}
                accessibilityLabel={`Selecionar ${item.name}`}
                className="px-4 py-3 border-b border-gray-100"
                onPress={() => handleSelect(item)}
              >
                <Text className="text-sm text-gray-800">
                  {item.name} ({item.unit})
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
      {createOpen && onCreate && <NewInventoryItemForm name={search.trim()} pending={creating}
        onCancel={() => setCreateOpen(false)} onSubmit={(input) => onCreate(input, handleSelect)} />}
    </View>
  );
}
