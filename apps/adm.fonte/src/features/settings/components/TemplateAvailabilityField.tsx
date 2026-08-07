import type { UseFormRegisterReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { TEMPLATE_AVAILABILITY_HINT, TEMPLATE_AVAILABILITY_OPTIONS } from '../constants';

interface Props {
  // O mesmo retorno de `register('availableFor')` espalhado nos três rádios —
  // é assim que o react-hook-form controla um grupo de rádio (um nome, N values).
  field: UseFormRegisterReturn;
}

// Story 160 — "para quem este documento pode ser gerado". Extraído do
// TemplateEditor (que já passa de 150 linhas e fica fora da cobertura unitária
// por exigir contenteditable real) para o campo poder ser testado de verdade.
export function TemplateAvailabilityField({ field }: Props) {
  return (
    <fieldset className="pt-1">
      <legend className="text-xs mb-1 block text-muted-foreground">Disponível para</legend>
      <div className="flex items-center gap-3">
        {TEMPLATE_AVAILABILITY_OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center gap-1.5">
            <input
              id={`available-for-${option.value}`}
              type="radio"
              value={option.value}
              {...field}
              className="h-4 w-4 cursor-pointer"
            />
            <Label
              htmlFor={`available-for-${option.value}`}
              className="text-sm cursor-pointer whitespace-nowrap"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{TEMPLATE_AVAILABILITY_HINT}</p>
    </fieldset>
  );
}
