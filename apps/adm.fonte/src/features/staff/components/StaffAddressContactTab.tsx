import { type FieldErrors, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import { maskPhone, withMask } from '@/lib/masks';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}

// Aba Endereço e contato do form de servo (story 96). Todos opcionais.
// O whatsapp (story 97) é também o identificador de login do servo.
export function StaffAddressContactTab<T extends FieldValues>({ register, errors }: Props<T>) {
  const f = (name: string) => register(name as Path<T>);
  const errMsg = (name: string): string | undefined =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="Endereço" error={errMsg('address')} full>
        <Input {...f('address')} placeholder="Rua, número, bairro" />
      </FormField>
      <FormField label="Cidade" error={errMsg('city')}>
        <Input {...f('city')} placeholder="Ex: São Paulo" />
      </FormField>
      <FormField label="UF" error={errMsg('state')}>
        <Input {...f('state')} placeholder="Ex: SP" maxLength={2} className="uppercase" />
      </FormField>
      <FormField label="WhatsApp" error={errMsg('whatsapp')}>
        <Input {...withMask(f('whatsapp'), maskPhone)} placeholder="(00) 00000-0000" />
      </FormField>
    </div>
  );
}
