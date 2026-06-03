import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Role } from '@fonte/types';
import type { Staff } from '@fonte/api-client';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { maskPhone } from '@/features/residents/lib/masks';
import { SERVANT_RANK_LABELS, SERVANT_RANK_VARIANT } from '../constants';

const ROLE_LABELS: Record<string, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.SERVANT]: 'Servo',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-2 border-b mb-3">
      {children}
    </h3>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">{children}</div>;
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
  staff: Staff;
}

export function StaffOverviewTab({ staff }: Props) {
  return (
    <div className="space-y-1">
      <SectionTitle>Identificação</SectionTitle>
      <InfoGrid>
        <InfoRow label="Nome" value={staff.name} full />
        <InfoRow label="Função" value={ROLE_LABELS[staff.user.role] ?? staff.user.role} />
        <InfoRow
          label="Nível"
          value={staff.user.role === Role.SERVANT && staff.rank
            ? <Badge variant={SERVANT_RANK_VARIANT[staff.rank]}>{SERVANT_RANK_LABELS[staff.rank]}</Badge>
            : '—'}
        />
        <InfoRow label="Telefone" value={staff.phone ? maskPhone(staff.phone) : '—'} />
        <InfoRow label="E-mail" value={staff.user.email} />
      </InfoGrid>

      <SectionTitle>Serviço</SectionTitle>
      <InfoGrid>
        <InfoRow label="Casa" value={staff.house?.name ?? '—'} />
        <InfoRow label="Grupo de apoio" value={staff.supportGroup?.name ?? '—'} />
      </InfoGrid>

      {staff.formerResidentId && (
        <>
          <SectionTitle>Origem</SectionTitle>
          <InfoGrid>
            <InfoRow label="Promovido a servo em" value={formatDate(staff.promotedAt)} />
            <InfoRow
              label="Cadastro de filho"
              value={
                <Link
                  to={`/residents/${staff.formerResidentId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ver acolhimento
                  <ExternalLink size={13} />
                </Link>
              }
            />
          </InfoGrid>
        </>
      )}
    </div>
  );
}
