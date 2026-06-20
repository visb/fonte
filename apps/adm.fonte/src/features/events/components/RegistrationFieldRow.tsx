import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EventFormData } from '../lib/eventSchema';
import { REGISTRATION_FIELD_TYPE_LABELS } from '../constants';

interface Props {
  index: number;
  register: UseFormRegister<EventFormData>;
  control: Control<EventFormData>;
  errors: FieldErrors<EventFormData>;
  onRemove: () => void;
}

const OPTION_TYPES = ['select', 'multi_select'];

/**
 * Linha editável de um campo custom do formulário de inscrição (story 68):
 * rótulo, tipo, obrigatório e (p/ select/multi_select) opções.
 */
export function RegistrationFieldRow({ index, register, control, errors, onRemove }: Props) {
  const type = useWatch({ control, name: `registrationFields.${index}.type` });
  const fieldErrors = errors.registrationFields?.[index];

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="registration-field-row">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`rf-label-${index}`}>Rótulo *</Label>
          <Input
            id={`rf-label-${index}`}
            placeholder="Ex: Tamanho da camiseta"
            {...register(`registrationFields.${index}.label`)}
          />
          {fieldErrors?.label && (
            <p className="text-xs text-destructive">{fieldErrors.label.message}</p>
          )}
        </div>

        <div className="w-40 space-y-1">
          <Label htmlFor={`rf-type-${index}`}>Tipo</Label>
          <select
            id={`rf-type-${index}`}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            {...register(`registrationFields.${index}.type`)}
          >
            {Object.entries(REGISTRATION_FIELD_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remover campo"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          {...register(`registrationFields.${index}.required`)}
        />
        Obrigatório
      </label>

      {OPTION_TYPES.includes(type as string) && (
        <div className="space-y-1">
          <Label htmlFor={`rf-options-${index}`}>Opções (uma por linha)</Label>
          <Textarea
            id={`rf-options-${index}`}
            rows={3}
            placeholder={'P\nM\nG'}
            {...register(`registrationFields.${index}.optionsText`)}
          />
          {fieldErrors?.optionsText && (
            <p className="text-xs text-destructive">{fieldErrors.optionsText.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
