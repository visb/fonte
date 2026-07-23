import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { FamilyInvestment, Gender, MaritalStatus } from '@fonte/types';
import { RESIDENT_APP_ENABLED } from '@/config/features';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { displayCpf, displayRg, maskPhone } from '@/lib/masks';
import { useResidentExternalCompletion } from '@/features/bible-courses/hooks/useBibleCourses';
import { FAMILY_INVESTMENT_LABELS } from '../../constants';
import { GenerateResidentAccessDialog } from '../GenerateResidentAccessDialog';
import { ResetResidentPasswordDialog } from '../ResetResidentPasswordDialog';
import { ResidentBibleCourseField } from '../ResidentBibleCourseField';
import type { Resident } from '@fonte/api-client';

const GENDER_LABELS: Record<string, string> = {
  [Gender.MALE]: 'Masculino',
  [Gender.FEMALE]: 'Feminino',
};

const MARITAL_LABELS: Record<string, string> = {
  [MaritalStatus.SINGLE]: 'Solteiro(a)',
  [MaritalStatus.MARRIED]: 'Casado(a)',
  [MaritalStatus.DIVORCED]: 'Divorciado(a)',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function computeAge(birthDate: string | null): string {
  if (!birthDate) return '';
  const today = new Date();
  const [y, m, d] = birthDate.split('T')[0].split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 - m < 0 || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return ` (${age} anos)`;
}

function val(v: string | number | null | undefined, format?: (s: string) => string): string {
  if (v == null || v === '') return '—';
  return format ? format(String(v)) : String(v);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-2 border-b mb-3">
      {children}
    </h3>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
      {children}
    </div>
  );
}

function InfoRow({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <>
      <span className={cn('text-muted-foreground', full && 'sm:col-span-2')}>{label}</span>
      <span className={cn(full && 'sm:col-span-2')}>{value || '—'}</span>
    </>
  );
}

interface Props {
  resident: Resident;
  /** ADMIN/COORDINATOR — libera o campo "Curso bíblico" (story 127). */
  canManage?: boolean;
}

export function OverviewTab({ resident, canManage = false }: Props) {
  const [generateAccessOpen, setGenerateAccessOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  // O endpoint da marcação é ADMIN/COORDINATOR: sem `canManage` a query fica
  // ociosa em vez de tomar 403 ao abrir a ficha.
  const { data: bibleCourseCompletion } = useResidentExternalCompletion(resident.id, {
    enabled: canManage,
  });

  return (
    <div className="space-y-1">
      <SectionTitle>Identificação</SectionTitle>
      <InfoGrid>
        <InfoRow label="Nome" value={resident.name} full />
        <InfoRow label="CPF" value={val(resident.cpf, displayCpf)} />
        <InfoRow label="RG" value={val(resident.rg, displayRg)} />
        <InfoRow label="Nacionalidade" value={val(resident.nationality)} />
        <InfoRow
          label="Data de nascimento"
          value={resident.birthDate ? `${formatDate(resident.birthDate)}${computeAge(resident.birthDate)}` : '—'}
        />
        <InfoRow
          label="Gênero"
          value={resident.gender ? (GENDER_LABELS[resident.gender] ?? resident.gender) : '—'}
        />
      </InfoGrid>

      <SectionTitle>Admissão</SectionTitle>
      <InfoGrid>
        <InfoRow label="Casa" value={resident.house?.name ?? '—'} />
        <InfoRow label="Ministério" value={resident.ministry?.name ?? '—'} />
        <InfoRow label="Data de entrada" value={formatDate(resident.entryDate)} />
        <InfoRow label="Data de saída" value={formatDate(resident.exitDate)} />
        <InfoRow label="Telefone" value={val(resident.contactPhone, maskPhone)} />
        <InfoRow label="E-mail" value={val(resident.email)} />
        <InfoRow label="Cidade" value={val(resident.city)} />
        <InfoRow label="UF" value={val(resident.state)} />
        <InfoRow label="Endereço" value={val(resident.address)} full />
        {/* Só quando marcado: sem marcação o sistema não sabe se o filho fez o
            curso fora daqui — a linha some em vez de afirmar "não fez". */}
        {bibleCourseCompletion && (
          <InfoRow
            label="Curso bíblico"
            value={
              <ResidentBibleCourseField
                residentId={resident.id}
                residentName={resident.name}
                completion={bibleCourseCompletion}
                canManage={canManage}
              />
            }
            full
          />
        )}
      </InfoGrid>

      <SectionTitle>Perfil Social</SectionTitle>
      <InfoGrid>
        <InfoRow
          label="Estado civil"
          value={resident.maritalStatus ? (MARITAL_LABELS[resident.maritalStatus] ?? resident.maritalStatus) : '—'}
        />
        <InfoRow label="Filhos" value={String(resident.children ?? 0)} />
        <InfoRow label="Ocupação" value={val(resident.occupation)} />
        <InfoRow label="Escolaridade" value={val(resident.education)} />
        <InfoRow label="Religião" value={val(resident.religion)} />
        <InfoRow label="Dependência química" value={val(resident.addiction)} />
      </InfoGrid>

      <SectionTitle>Saúde</SectionTitle>
      <InfoGrid>
        <InfoRow label="Problemas de saúde" value={val(resident.healthIssues)} full />
        <InfoRow label="Medicação contínua" value={val(resident.continuousMedication)} full />
        <InfoRow label="Peso" value={resident.weight != null ? `${resident.weight} kg` : '—'} />
        <InfoRow label="Altura" value={resident.height != null ? `${resident.height} cm` : '—'} />
      </InfoGrid>

      <SectionTitle>Família</SectionTitle>
      <InfoGrid>
        <InfoRow
          label="Investimento familiar"
          value={resident.familyInvestment
            ? `${FAMILY_INVESTMENT_LABELS[resident.familyInvestment]}${
                resident.familyInvestment === FamilyInvestment.NEGOTIATED && resident.familyInvestmentAmount != null
                  ? ` — R$ ${resident.familyInvestmentAmount}`
                  : ''
              }`
            : '—'}
          full
        />
        {resident.familyInvestment !== FamilyInvestment.SOCIAL && (
          <InfoRow
            label="Dia de vencimento da contribuição"
            value={resident.contributionDueDay ? `Dia ${resident.contributionDueDay}` : 'Mesmo dia do acolhimento'}
          />
        )}
      </InfoGrid>

      {/* Acesso do interno (RESIDENT): oculto enquanto o app `resident.fonte`
          não está em produção (RESIDENT_APP_ENABLED). Reativar é flipar a flag;
          o hook e os dialogs seguem intactos. Não afeta o acesso de familiar. */}
      {RESIDENT_APP_ENABLED && (
        <>
          <SectionTitle>Acesso Digital</SectionTitle>
          <div className="flex items-center justify-between py-2">
            {resident.userId ? (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">E-mail: </span>
                  <span>{resident.user?.email ?? '—'}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setResetPasswordOpen(true)}>
                  <KeyRound size={14} className="mr-2" />
                  Resetar Senha
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Sem acesso gerado.</p>
                <Button variant="outline" size="sm" onClick={() => setGenerateAccessOpen(true)}>
                  <KeyRound size={14} className="mr-2" />
                  Gerar Acesso
                </Button>
              </>
            )}
          </div>

          <GenerateResidentAccessDialog
            open={generateAccessOpen}
            onClose={() => setGenerateAccessOpen(false)}
            resident={{ id: resident.id, name: resident.name }}
          />
          <ResetResidentPasswordDialog
            open={resetPasswordOpen}
            onClose={() => setResetPasswordOpen(false)}
            resident={{ id: resident.id, name: resident.name }}
          />
        </>
      )}
    </div>
  );
}
