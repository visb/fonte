import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import type { StoreroomItem } from "@fonte/api-client";
import { formatQuantity } from "@/features/storeroom/utils";
import { NewItemForm } from "./NewItemForm";

type Props = {
  value: string;
  selectedItemId: string;
  selectedItem?: StoreroomItem;
  items: StoreroomItem[];
  onChangeText: (text: string) => void;
  onSelect: (item: StoreroomItem) => void;
  onConfirmNewItem: (unit: string) => void;
  isCreatingItem: boolean;
  error?: string;
};

export function ItemSearchInput({
  value,
  selectedItemId,
  selectedItem,
  items,
  onChangeText,
  onSelect,
  onConfirmNewItem,
  isCreatingItem,
  error,
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewItemForm, setShowNewItemForm] = useState(false);

  const filteredItems = value.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(value.toLowerCase()))
    : items;

  const showCreateOption = value.trim().length > 0 && filteredItems.length === 0;

  function handleSelect(item: StoreroomItem) {
    onSelect(item);
    setShowDropdown(false);
    setShowNewItemForm(false);
  }

  function handleChangeText(text: string) {
    onChangeText(text);
    setShowDropdown(true);
    setShowNewItemForm(false);
  }

  function handleConfirmNewItem(unit: string) {
    onConfirmNewItem(unit);
    setShowNewItemForm(false);
  }

  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">Item</Text>
      <TextInput
        className={`border rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50 ${
          selectedItemId ? "border-blue-400" : "border-gray-300"
        }`}
        placeholder="Buscar item..."
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setShowDropdown(true)}
      />
      {selectedItem && !showDropdown && (
        <Text className="text-xs text-gray-500 mt-1">
          {formatQuantity(selectedItem.currentQuantity)} {selectedItem.unit} em estoque
        </Text>
      )}
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
      {showDropdown && (
        <View className="border border-gray-200 rounded-lg mt-1 bg-white overflow-hidden">
          {filteredItems.map((i) => (
            <TouchableOpacity
              key={i.id}
              className="px-4 py-3 border-b border-gray-100"
              onPress={() => handleSelect(i)}
            >
              <Text className="text-sm text-gray-800">{i.name}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                {formatQuantity(i.currentQuantity)} {i.unit} em estoque
              </Text>
            </TouchableOpacity>
          ))}
          {showCreateOption && (
            <TouchableOpacity
              className="px-4 py-3"
              onPress={() => {
                setShowDropdown(false);
                setShowNewItemForm(true);
              }}
            >
              <Text className="text-sm text-blue-600 font-medium">
                + Cadastrar "{value.trim()}"
              </Text>
            </TouchableOpacity>
          )}
          {!showCreateOption && filteredItems.length === 0 && (
            <View className="px-4 py-3">
              <Text className="text-sm text-gray-400">Nenhum item encontrado.</Text>
            </View>
          )}
        </View>
      )}
      {showNewItemForm && (
        <View className="mt-3">
          <NewItemForm
            name={value.trim()}
            onConfirm={handleConfirmNewItem}
            onCancel={() => setShowNewItemForm(false)}
            isPending={isCreatingItem}
          />
        </View>
      )}
    </View>
  );
}
