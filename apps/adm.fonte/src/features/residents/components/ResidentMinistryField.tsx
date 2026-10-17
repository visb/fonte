import { useEffect } from "react";
import { useController, useWatch, type Control } from "react-hook-form";
import { REMOVABLE_RESIDENT_STATUSES, type ResidentStatus } from "@fonte/types";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/shared/FormField";
import { useHouseMinistriesList } from "@/features/houses/hooks/useHouseMinistries";
import type { ResidentFormData } from "../lib/residentSchema";

/**
 * Ministério no acolhimento/ficha (story 205). Lista só os ministérios da casa
 * escolhida e só aparece para filho em acolhimento (status vazio no wizard, que
 * cria ACTIVE). Trocar a casa — ou sair do acolhimento — limpa a escolha: o
 * backend recusaria (400) ministério de outra casa ou filho que já saiu.
 */
export function ResidentMinistryField({ control }: { control: Control<ResidentFormData> }) {
  const houseId = useWatch({ control, name: "houseId" });
  const status = useWatch({ control, name: "status" });
  const { field } = useController({ control, name: "ministryId" });
  const inCare = !status || REMOVABLE_RESIDENT_STATUSES.includes(status as ResidentStatus);
  const enabled = !!houseId && inCare;
  const { data: ministries = [], isSuccess } = useHouseMinistriesList(houseId ?? "", { enabled });

  const { value, onChange } = field;
  useEffect(() => {
    if (!value) return;
    const stale = !enabled || (isSuccess && !ministries.some((m) => m.id === value));
    if (stale) onChange("");
  }, [enabled, isSuccess, ministries, value, onChange]);

  if (!enabled) return null;

  return (
    <FormField label="Ministério">
      <Select
        name={field.name}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={field.onBlur}
        aria-label="Ministério"
      >
        <option value="">Sem ministério</option>
        {ministries.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
