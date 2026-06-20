import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EventFormData } from '../lib/eventSchema';
import { RegistrationFieldRow } from './RegistrationFieldRow';

interface Props {
  register: UseFormRegister<EventFormData>;
  control: Control<EventFormData>;
  errors: FieldErrors<EventFormData>;
}

/**
 * Construtor dos campos custom do formulário de inscrição (story 68). Lista
 * editável: adicionar/remover campos. Cada item é extraído em
 * RegistrationFieldRow (regra CLAUDE.md: nada de item inline complexo).
 */
export function RegistrationFieldsBuilder({ register, control, errors }: Props) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'registrationFields',
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Campos do formulário de inscrição</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="add-registration-field"
          onClick={() =>
            append({ label: '', type: 'short_text', required: false, optionsText: '' })
          }
        >
          <Plus size={14} className="mr-1.5" />
          Adicionar campo
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Apenas nome, contato e e-mail são pedidos. Adicione campos extras se precisar.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <RegistrationFieldRow
              key={field.id}
              index={index}
              register={register}
              control={control}
              errors={errors}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
