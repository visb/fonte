import { type UseFormRegister } from "react-hook-form";
import {
  FamilyInvestment,
  Gender,
  MaritalStatus,
  ResidentStatus,
} from "@fonte/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SectionTitle, FormField } from "@/components/shared/FormField";
import { maskCPF, maskRG, maskPhone, withMask } from "../lib/masks";
import { FAMILY_INVESTMENT_LABELS } from "../constants";
import type { ResidentFormData } from "../lib/residentSchema";
import type { House } from "@fonte/api-client";

interface ResidentFormSectionsProps {
  register: UseFormRegister<ResidentFormData>;
  errors: Partial<Record<keyof ResidentFormData, { message?: string }>>;
  houses: House[];
  showStatus?: boolean;
  watchFamilyInvestment?: string | null;
  showFirstPayment?: boolean;
  firstPaymentPaid?: boolean;
  onFirstPaymentChange?: (v: boolean) => void;
}

export function ResidentFormSections({
  register,
  errors,
  houses,
  showStatus = false,
  watchFamilyInvestment,
  showFirstPayment = false,
  firstPaymentPaid = false,
  onFirstPaymentChange,
}: ResidentFormSectionsProps) {
  const hasPayment =
    showFirstPayment &&
    watchFamilyInvestment &&
    watchFamilyInvestment !== FamilyInvestment.SOCIAL;
  return (
    <>
      <SectionTitle>Identificação</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Nome completo *" error={errors.name?.message} full>
          <Input {...register("name")} placeholder="Nome do acolhido" />
        </FormField>
        <FormField label="CPF">
          <Input
            {...withMask(register("cpf"), maskCPF)}
            placeholder="000.000.000-00"
          />
        </FormField>
        <FormField label="RG">
          <Input
            {...withMask(register("rg"), maskRG)}
            placeholder="00.000.000-0"
          />
        </FormField>
        <FormField label="Nacionalidade">
          <Input {...register("nationality")} placeholder="Ex: Brasileira" />
        </FormField>
        <FormField label="Data de nascimento">
          <Input type="date" {...register("birthDate")} />
        </FormField>
        <FormField label="Gênero">
          <Select {...register("gender")}>
            <option value="">Selecione</option>
            <option value={Gender.MALE}>Masculino</option>
            <option value={Gender.FEMALE}>Feminino</option>
          </Select>
        </FormField>
      </div>

      <SectionTitle>Admissão</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Casa *" error={errors.houseId?.message}>
          <Select {...register("houseId")}>
            <option value="">Selecione a casa</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Data de entrada">
          <Input type="date" {...register("entryDate")} />
        </FormField>
        {showStatus && (
          <FormField label="Status">
            <Select {...register("status")}>
              <option value={ResidentStatus.PRE_ADMISSION}>Pré-admissão</option>
              <option value={ResidentStatus.ACTIVE}>Ativo</option>
              <option value={ResidentStatus.DISCIPLINE}>Disciplina</option>
              <option value={ResidentStatus.TEMP_LEAVE}>
                Saída temporária
              </option>
              <option value={ResidentStatus.DISCHARGED}>Alta</option>
              <option value={ResidentStatus.EVADED}>Evasão</option>
            </Select>
          </FormField>
        )}
        <FormField label="Endereço" full>
          <Input {...register("address")} placeholder="Rua, número, bairro" />
        </FormField>
        <FormField label="Cidade">
          <Input {...register("city")} placeholder="Ex: São Paulo" />
        </FormField>
        <FormField label="UF">
          <Input
            {...register("state")}
            placeholder="Ex: SP"
            maxLength={2}
            className="uppercase"
          />
        </FormField>
        <FormField label="Telefone">
          <Input
            {...withMask(register("contactPhone"), maskPhone)}
            placeholder="(00) 00000-0000"
          />
        </FormField>
        <FormField label="E-mail" error={errors.email?.message}>
          <Input
            {...register("email")}
            type="email"
            placeholder="exemplo@email.com"
          />
        </FormField>
      </div>

      <SectionTitle>Perfil social</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Estado civil">
          <Select {...register("maritalStatus")}>
            <option value="">Selecione</option>
            <option value={MaritalStatus.SINGLE}>Solteiro(a)</option>
            <option value={MaritalStatus.MARRIED}>Casado(a)</option>
            <option value={MaritalStatus.DIVORCED}>Divorciado(a)</option>
          </Select>
        </FormField>
        <FormField label="Filhos">
          <Input
            type="number"
            min={0}
            {...register("children")}
            placeholder="0"
          />
        </FormField>
        <FormField label="Ocupação">
          <Input
            {...register("occupation")}
            placeholder="Profissão ou ocupação"
          />
        </FormField>
        <FormField label="Escolaridade">
          <Input
            {...register("education")}
            placeholder="Ex: Ensino médio completo"
          />
        </FormField>
        <FormField label="Religião">
          <Input
            {...register("religion")}
            placeholder="Ex: Evangélico, Católico..."
          />
        </FormField>
        <FormField label="Dependência química">
          <Input
            {...register("addiction")}
            placeholder="Ex: Álcool, crack..."
          />
        </FormField>
      </div>

      <SectionTitle>Saúde</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Problemas de saúde" full>
          <Textarea
            {...register("healthIssues")}
            placeholder="Descreva condições de saúde relevantes"
          />
        </FormField>
        <FormField label="Medicação contínua" full>
          <Textarea
            {...register("continuousMedication")}
            placeholder="Liste os medicamentos em uso"
          />
        </FormField>
        <FormField label="Peso (kg)">
          <Input
            type="number"
            min={0}
            {...register("weight")}
            placeholder="70"
          />
        </FormField>
        <FormField label="Altura (cm)">
          <Input
            type="number"
            min={0}
            {...register("height")}
            placeholder="175"
          />
        </FormField>
      </div>

      <SectionTitle>Família</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Investimento familiar">
          <Select {...register("familyInvestment")}>
            <option value="">Selecione a modalidade</option>
            {Object.values(FamilyInvestment).map((v) => (
              <option key={v} value={v}>
                {FAMILY_INVESTMENT_LABELS[v]}
              </option>
            ))}
          </Select>
        </FormField>
        {watchFamilyInvestment === FamilyInvestment.NEGOTIATED && (
          <FormField
            label="Valor negociado (R$)"
            error={errors.familyInvestmentAmount?.message}
          >
            <Input
              type="number"
              min={0}
              {...register("familyInvestmentAmount")}
              placeholder="Ex: 350"
            />
          </FormField>
        )}
        {hasPayment && (
          <label className="flex items-center gap-2 text-sm cursor-pointer col-span-full pt-1">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={firstPaymentPaid}
              onChange={(e) => onFirstPaymentChange?.(e.target.checked)}
            />
            Primeira mensalidade já foi paga
          </label>
        )}
      </div>
    </>
  );
}
