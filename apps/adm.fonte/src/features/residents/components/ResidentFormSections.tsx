import { type ReactNode } from "react";
import { useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import {
  FamilyInvestment,
  ResidentStatus,
  todayInSaoPaulo,
} from "@fonte/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionTitle, FormField } from "@/components/shared/FormField";
import { PersonalDataFields } from "@/components/shared/PersonalDataFields";
import { ControlledDateInput } from "@/components/shared/ControlledDateInput";
import { FAMILY_INVESTMENT_LABELS } from "../constants";
import type { ResidentFormData } from "../lib/residentSchema";
import type { House } from "@fonte/api-client";

interface ResidentFormSectionsProps {
  register: UseFormRegister<ResidentFormData>;
  control: Control<ResidentFormData>;
  errors: FieldErrors<ResidentFormData>;
  houses: House[];
  showStatus?: boolean;
  showExitDate?: boolean;
  watchFamilyInvestment?: string | null;
  showFirstPayment?: boolean;
  firstPaymentPaid?: boolean;
  onFirstPaymentChange?: (v: boolean) => void;
  firstPaymentSlot?: ReactNode;
}

type FormBindings = "register" | "control" | "errors";
type FichaSectionsProps = Pick<ResidentFormSectionsProps, FormBindings>;

export function ResidentFichaSections({ register, control, errors }: FichaSectionsProps) {
  return (
    <PersonalDataFields
      register={register}
      control={control}
      errors={errors}
      namePlaceholder="Nome do acolhido"
    />
  );
}

type AdmissionSectionsProps = Omit<ResidentFormSectionsProps, FormBindings> &
  Pick<ResidentFormSectionsProps, FormBindings>;

export function ResidentAdmissionSections({
  register,
  control,
  errors,
  houses,
  showStatus = false,
  showExitDate = false,
  watchFamilyInvestment,
  showFirstPayment = false,
  firstPaymentPaid = false,
  onFirstPaymentChange,
  firstPaymentSlot,
}: AdmissionSectionsProps) {
  const hasPayment =
    showFirstPayment &&
    watchFamilyInvestment &&
    watchFamilyInvestment !== FamilyInvestment.SOCIAL;
  // Story 203: entrada e saída até hoje; saída a partir da entrada.
  const today = todayInSaoPaulo();
  const entryDate = useWatch({ control, name: "entryDate" });
  return (
    <>
      <SectionTitle>Investimento</SectionTitle>
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
        {watchFamilyInvestment !== FamilyInvestment.SOCIAL && (
          <FormField label="Dia de vencimento da contribuição">
            <Select {...register("contributionDueDay")}>
              <option value="">Mesmo dia do acolhimento</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Use quando a família paga em data diferente da entrada.
            </p>
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
        {hasPayment && firstPaymentPaid && firstPaymentSlot && (
          <div className="col-span-full">{firstPaymentSlot}</div>
        )}
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
        <FormField label="Data de entrada" error={errors.entryDate?.message}>
          <ControlledDateInput control={control} name="entryDate" max={today} />
        </FormField>
        {showExitDate && (
          <FormField label="Data de saída" error={errors.exitDate?.message}>
            <ControlledDateInput
              control={control}
              name="exitDate"
              min={entryDate || undefined}
              max={today}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Preencha para importar um filho que já saiu — o status Alta/Evasão
              é definido pela permanência.
            </p>
          </FormField>
        )}
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
              <option value={ResidentStatus.ARCHIVED}>Arquivado</option>
            </Select>
          </FormField>
        )}
      </div>
    </>
  );
}

export function ResidentFormSections(props: ResidentFormSectionsProps) {
  return (
    <>
      <ResidentFichaSections
        register={props.register}
        control={props.control}
        errors={props.errors}
      />
      <ResidentAdmissionSections {...props} />
    </>
  );
}
