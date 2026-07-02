import { type FieldErrors, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { Gender, MaritalStatus } from '@fonte/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { maskCPF, maskRG, withMask } from '@/lib/masks';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}

// Aba Pessoal do form de servo (story 96): documentos e perfil social. Todos os
// campos são opcionais — nada aqui bloqueia o cadastro.
export function StaffPersonalTab<T extends FieldValues>({ register, errors }: Props<T>) {
  const f = (name: string) => register(name as Path<T>);
  const errMsg = (name: string): string | undefined =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="CPF" error={errMsg('cpf')}>
        <Input {...withMask(f('cpf'), maskCPF)} placeholder="000.000.000-00" />
      </FormField>
      <FormField label="RG" error={errMsg('rg')}>
        <Input {...withMask(f('rg'), maskRG)} placeholder="00.000.000-0" />
      </FormField>
      <FormField label="Nacionalidade" error={errMsg('nationality')}>
        <Input {...f('nationality')} placeholder="Ex: Brasileira" />
      </FormField>
      <FormField label="Data de nascimento" error={errMsg('birthDate')}>
        <Input type="date" {...f('birthDate')} />
      </FormField>
      <FormField label="Gênero" error={errMsg('gender')}>
        <Select {...f('gender')}>
          <option value="">Selecione</option>
          <option value={Gender.MALE}>Masculino</option>
          <option value={Gender.FEMALE}>Feminino</option>
        </Select>
      </FormField>
      <FormField label="Estado civil" error={errMsg('maritalStatus')}>
        <Select {...f('maritalStatus')}>
          <option value="">Selecione</option>
          <option value={MaritalStatus.SINGLE}>Solteiro(a)</option>
          <option value={MaritalStatus.MARRIED}>Casado(a)</option>
          <option value={MaritalStatus.DIVORCED}>Divorciado(a)</option>
        </Select>
      </FormField>
      <FormField label="Filhos" error={errMsg('children')}>
        <Input type="number" min={0} {...f('children')} placeholder="0" />
      </FormField>
      <FormField label="Ocupação" error={errMsg('occupation')}>
        <Input {...f('occupation')} placeholder="Profissão ou ocupação" />
      </FormField>
      <FormField label="Escolaridade" error={errMsg('education')}>
        <Input {...f('education')} placeholder="Ex: Ensino médio completo" />
      </FormField>
      <FormField label="Religião" error={errMsg('religion')}>
        <Input {...f('religion')} placeholder="Ex: Evangélico, Católico..." />
      </FormField>
    </div>
  );
}
