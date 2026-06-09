import { type FieldErrors, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";
import { Gender, MaritalStatus } from "@fonte/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle, FormField } from "@/components/shared/FormField";
import { maskCPF, maskRG, maskPhone, withMask } from "@/lib/masks";

// Campos pessoais compartilhados entre filho (resident) e servo (staff).
// O formulário consumidor precisa expor estes nomes de campo:
export interface PersonalDataFormValues {
  name?: string;
  cpf?: string;
  rg?: string;
  nationality?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  contactPhone?: string;
  email?: string;
  maritalStatus?: string;
  children?: string;
  occupation?: string;
  education?: string;
  religion?: string;
  addiction?: string;
  healthIssues?: string;
  continuousMedication?: string;
  weight?: string;
  height?: string;
}

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  /** Renderiza o campo Nome dentro da seção de identificação. */
  includeName?: boolean;
  nameLabel?: string;
  namePlaceholder?: string;
}

export function PersonalDataFields<T extends FieldValues>({
  register,
  errors,
  includeName = true,
  nameLabel = "Nome completo *",
  namePlaceholder = "Nome completo",
}: Props<T>) {
  const f = (name: keyof PersonalDataFormValues) => register(name as Path<T>);
  // Acesso por chave dinâmica: os nomes vivem em PersonalDataFormValues, não
  // necessariamente como chaves estáticas de T.
  const errMsg = (name: keyof PersonalDataFormValues): string | undefined =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message;

  return (
    <>
      <SectionTitle>Identificação</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {includeName && (
          <FormField label={nameLabel} error={errMsg("name")} full>
            <Input {...f("name")} placeholder={namePlaceholder} />
          </FormField>
        )}
        <FormField label="CPF">
          <Input {...withMask(f("cpf"), maskCPF)} placeholder="000.000.000-00" />
        </FormField>
        <FormField label="RG">
          <Input {...withMask(f("rg"), maskRG)} placeholder="00.000.000-0" />
        </FormField>
        <FormField label="Nacionalidade">
          <Input {...f("nationality")} placeholder="Ex: Brasileira" />
        </FormField>
        <FormField label="Data de nascimento">
          <Input type="date" {...f("birthDate")} />
        </FormField>
        <FormField label="Gênero">
          <Select {...f("gender")}>
            <option value="">Selecione</option>
            <option value={Gender.MALE}>Masculino</option>
            <option value={Gender.FEMALE}>Feminino</option>
          </Select>
        </FormField>
      </div>

      <SectionTitle>Contato</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Endereço" full>
          <Input {...f("address")} placeholder="Rua, número, bairro" />
        </FormField>
        <FormField label="Cidade">
          <Input {...f("city")} placeholder="Ex: São Paulo" />
        </FormField>
        <FormField label="UF">
          <Input {...f("state")} placeholder="Ex: SP" maxLength={2} className="uppercase" />
        </FormField>
        <FormField label="Telefone">
          <Input {...withMask(f("contactPhone"), maskPhone)} placeholder="(00) 00000-0000" />
        </FormField>
        <FormField label="E-mail" error={errMsg("email")}>
          <Input {...f("email")} type="email" placeholder="exemplo@email.com" />
        </FormField>
      </div>

      <SectionTitle>Perfil social</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Estado civil">
          <Select {...f("maritalStatus")}>
            <option value="">Selecione</option>
            <option value={MaritalStatus.SINGLE}>Solteiro(a)</option>
            <option value={MaritalStatus.MARRIED}>Casado(a)</option>
            <option value={MaritalStatus.DIVORCED}>Divorciado(a)</option>
          </Select>
        </FormField>
        <FormField label="Filhos">
          <Input type="number" min={0} {...f("children")} placeholder="0" />
        </FormField>
        <FormField label="Ocupação">
          <Input {...f("occupation")} placeholder="Profissão ou ocupação" />
        </FormField>
        <FormField label="Escolaridade">
          <Input {...f("education")} placeholder="Ex: Ensino médio completo" />
        </FormField>
        <FormField label="Religião">
          <Input {...f("religion")} placeholder="Ex: Evangélico, Católico..." />
        </FormField>
        <FormField label="Dependência química">
          <Input {...f("addiction")} placeholder="Ex: Álcool, crack..." />
        </FormField>
      </div>

      <SectionTitle>Saúde</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Problemas de saúde" full>
          <Textarea {...f("healthIssues")} placeholder="Descreva condições de saúde relevantes" />
        </FormField>
        <FormField label="Medicação contínua" full>
          <Textarea {...f("continuousMedication")} placeholder="Liste os medicamentos em uso" />
        </FormField>
        <FormField label="Peso (kg)">
          <Input type="number" min={0} {...f("weight")} placeholder="70" />
        </FormField>
        <FormField label="Altura (cm)">
          <Input type="number" min={0} {...f("height")} placeholder="175" />
        </FormField>
      </div>
    </>
  );
}
