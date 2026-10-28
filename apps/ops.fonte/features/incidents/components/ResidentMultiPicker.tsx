import { View, Text } from "react-native";
import { ResidentChip } from "./ResidentChip";
import { ResidentCheckboxRow } from "./ResidentCheckboxRow";

type Resident = { id: string; name: string };

type Props = {
  value: string[];
  residents: Resident[];
  onChange: (ids: string[]) => void;
};

/**
 * Filhos envolvidos na ocorrência (story 227): lista com checkbox e, acima,
 * chips dos selecionados com "x". Nenhum selecionado = ocorrência da casa.
 */
export function ResidentMultiPicker({ value, residents, onChange }: Props) {
  const selected = new Set(value);
  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  const chips = value
    .map((id) => residents.find((r) => r.id === id))
    .filter((r): r is Resident => !!r);

  return (
    <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
      <View className="px-4 pt-3 pb-1">
        {chips.length ? (
          <View className="flex-row flex-wrap">
            {chips.map((r) => (
              <ResidentChip key={r.id} name={r.name} onRemove={() => toggle(r.id)} />
            ))}
          </View>
        ) : (
          <Text className="text-sm text-gray-400 mb-2">Nenhum filho selecionado</Text>
        )}
      </View>
      {residents.map((r) => (
        <ResidentCheckboxRow
          key={r.id}
          name={r.name}
          checked={selected.has(r.id)}
          onToggle={() => toggle(r.id)}
        />
      ))}
    </View>
  );
}
