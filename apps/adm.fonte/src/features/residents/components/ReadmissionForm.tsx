import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FamilyInvestment, FollowUpType, FollowUpAccessLevel, Gender, MaritalStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { api } from '@/lib/api';
import { AvatarUpload } from '@/components/AvatarUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SectionTitle, FormField } from '@/components/shared/FormField';
import { getErrorMessage } from '@/lib/errors';
import { maskPhone, maskCPF, maskRG, withMask } from '../lib/masks';
import { FAMILY_INVESTMENT_LABELS } from '../constants';
import { useReadmitResident } from '../hooks/useResidents';
import { useHouses } from '@/features/houses/hooks/useHouses';

const readmitSchema = z.object({
  houseId: z.string().min(1, 'Casa é obrigatória'),
  entryDate: z.string().optional(),
  address: z.string().optional(),
  contactPhone: z.string().optional(),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
  maritalStatus: z.nativeEnum(MaritalStatus).or(z.literal('')).optional(),
  children: z.string().optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  religion: z.string().optional(),
  addiction: z.string().optional(),
  healthIssues: z.string().optional(),
  continuousMedication: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  familyInvestment: z.nativeEnum(FamilyInvestment).or(z.literal('')).optional().nullable(),
  familyInvestmentAmount: z.coerce.number().int().min(0).optional().nullable(),
});

type ReadmitFormData = z.infer<typeof readmitSchema>;

const today = new Date().toISOString().split('T')[0];

const genderLabel: Record<string, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
};

interface ReadmissionFormProps {
  resident: Resident;
  onBack: () => void;
  onSuccess: (id: string) => void;
}

export function ReadmissionForm({ resident, onBack, onSuccess }: ReadmissionFormProps) {
  const pendingPhotoRef = useRef<Blob | null>(null);
  const [firstPaymentPaid, setFirstPaymentPaid] = useState(false);
  const { data: houses = [] } = useHouses();
  const mutation = useReadmitResident(resident.id);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReadmitFormData>({
    resolver: zodResolver(readmitSchema),
    defaultValues: {
      houseId: '',
      entryDate: today,
      address: resident.address ?? '',
      contactPhone: maskPhone(resident.contactPhone ?? ''),
      email: resident.email ?? '',
      maritalStatus: (resident.maritalStatus as MaritalStatus) ?? '',
      children: resident.children != null ? String(resident.children) : '0',
      occupation: resident.occupation ?? '',
      education: resident.education ?? '',
      religion: resident.religion ?? '',
      addiction: resident.addiction ?? '',
      healthIssues: '',
      continuousMedication: '',
      weight: '',
      height: '',
      familyInvestment: '',
    },
  });

  const onSubmit = (data: ReadmitFormData) => {
    const toNullable = (v?: string) => (v && v.trim() !== '' ? v.trim() : null);
    const toInt = (v?: string) => (v && v.trim() !== '' ? parseInt(v, 10) : null);

    const payload = {
      houseId: data.houseId,
      entryDate: data.entryDate || today,
      address: toNullable(data.address),
      contactPhone: toNullable(data.contactPhone),
      email: toNullable(data.email),
      maritalStatus: (data.maritalStatus || null) as MaritalStatus | null,
      children: data.children ? parseInt(data.children, 10) : 0,
      occupation: toNullable(data.occupation),
      education: toNullable(data.education),
      religion: toNullable(data.religion),
      addiction: toNullable(data.addiction),
      healthIssues: toNullable(data.healthIssues),
      continuousMedication: toNullable(data.continuousMedication),
      weight: toInt(data.weight),
      height: toInt(data.height),
      familyInvestment: (data.familyInvestment || null) as FamilyInvestment | null,
      familyInvestmentAmount: data.familyInvestmentAmount ?? null,
    };

    mutation.mutate(
      { data: payload, photo: pendingPhotoRef.current },
      {
        onSuccess: async (updated) => {
          if (firstPaymentPaid) {
            try {
              await api.residents.createFollowUp(updated.id, {
                type: FollowUpType.MONTHLY_CONTRIBUTION,
                date: data.entryDate || today,
                accessLevel: FollowUpAccessLevel.ALL,
              });
            } catch {
              // non-critical
            }
          }
          onSuccess(updated.id);
        },
      },
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Voltar
        </Button>
        <h1 className="text-2xl font-bold">Reintrodução de acolhido</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        {/* Banner de identidade imutável */}
        <div className="rounded-lg border bg-muted/40 p-4 mb-2">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
            Dados de identificação — não editáveis
          </p>
          <div className="flex items-start gap-4">
            <AvatarUpload
              currentUrl={resident.photoUrl ? api.photoUrl(resident.photoUrl) : null}
              onBlobChange={(blob) => { pendingPhotoRef.current = blob; }}
            />
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm flex-1">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{resident.name}</span>
              {resident.cpf && (
                <>
                  <span className="text-muted-foreground">CPF</span>
                  <span>{maskCPF(resident.cpf)}</span>
                </>
              )}
              {resident.rg && (
                <>
                  <span className="text-muted-foreground">RG</span>
                  <span>{maskRG(resident.rg)}</span>
                </>
              )}
              {resident.birthDate && (
                <>
                  <span className="text-muted-foreground">Nascimento</span>
                  <span>{new Date(resident.birthDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                </>
              )}
              {resident.gender && (
                <>
                  <span className="text-muted-foreground">Gênero</span>
                  <span>{genderLabel[resident.gender] ?? resident.gender}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <SectionTitle>Nova admissão</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Casa *" error={errors.houseId?.message}>
            <Select {...register('houseId')}>
              <option value="">Selecione a casa</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Data de entrada">
            <Input type="date" {...register('entryDate')} />
          </FormField>
        </div>

        <SectionTitle>Contato e endereço</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Endereço" full>
            <Input {...register('address')} placeholder="Rua, número, bairro, cidade" />
          </FormField>
          <FormField label="Telefone">
            <Input {...withMask(register('contactPhone'), maskPhone)} placeholder="(00) 00000-0000" />
          </FormField>
          <FormField label="E-mail" error={errors.email?.message}>
            <Input {...register('email')} type="email" placeholder="exemplo@email.com" />
          </FormField>
        </div>

        <SectionTitle>Perfil social</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Estado civil">
            <Select {...register('maritalStatus')}>
              <option value="">Selecione</option>
              <option value={MaritalStatus.SINGLE}>Solteiro(a)</option>
              <option value={MaritalStatus.MARRIED}>Casado(a)</option>
              <option value={MaritalStatus.DIVORCED}>Divorciado(a)</option>
            </Select>
          </FormField>
          <FormField label="Filhos">
            <Input type="number" min={0} {...register('children')} placeholder="0" />
          </FormField>
          <FormField label="Ocupação">
            <Input {...register('occupation')} placeholder="Profissão ou ocupação" />
          </FormField>
          <FormField label="Escolaridade">
            <Input {...register('education')} placeholder="Ex: Ensino médio completo" />
          </FormField>
          <FormField label="Religião">
            <Input {...register('religion')} placeholder="Ex: Evangélico, Católico..." />
          </FormField>
          <FormField label="Dependência química">
            <Input {...register('addiction')} placeholder="Ex: Álcool, crack..." />
          </FormField>
        </div>

        <SectionTitle>Saúde</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Problemas de saúde" full>
            <Textarea {...register('healthIssues')} placeholder="Descreva condições de saúde relevantes" />
          </FormField>
          <FormField label="Medicação contínua" full>
            <Textarea {...register('continuousMedication')} placeholder="Liste os medicamentos em uso" />
          </FormField>
          <FormField label="Peso (kg)">
            <Input type="number" min={0} {...register('weight')} placeholder="70" />
          </FormField>
          <FormField label="Altura (cm)">
            <Input type="number" min={0} {...register('height')} placeholder="175" />
          </FormField>
        </div>

        <SectionTitle>Família</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Investimento familiar">
            <Select {...register('familyInvestment')}>
              <option value="">Selecione a modalidade</option>
              {Object.values(FamilyInvestment).map((v) => (
                <option key={v} value={v}>{FAMILY_INVESTMENT_LABELS[v]}</option>
              ))}
            </Select>
          </FormField>
          {watch('familyInvestment') === FamilyInvestment.NEGOTIATED && (
            <FormField label="Valor negociado (R$)" error={errors.familyInvestmentAmount?.message}>
              <Input
                type="number"
                min={0}
                {...register('familyInvestmentAmount')}
                placeholder="Ex: 350"
              />
            </FormField>
          )}
          {watch('familyInvestment') && watch('familyInvestment') !== FamilyInvestment.SOCIAL && (
            <label className="flex items-center gap-2 text-sm cursor-pointer col-span-full pt-1">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={firstPaymentPaid}
                onChange={(e) => setFirstPaymentPaid(e.target.checked)}
              />
              Primeira mensalidade já foi paga
            </label>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive text-right">
            {getErrorMessage(mutation.error, 'Erro ao reintroduzir acolhido.')}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {isSubmitting || mutation.isPending ? 'Salvando...' : 'Reintroduzir acolhido'}
          </Button>
        </div>
      </form>
    </div>
  );
}
