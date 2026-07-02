import type { ReactNode } from 'react';
import { type FieldErrors, type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';
import { Role } from '@fonte/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/shared/FormField';
import { StaffServiceSelector } from './StaffServiceSelector';
import { SERVANT_RANK_LABELS, SERVANT_RANK_ORDER } from '../constants';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  role: Role | undefined;
  servesInGroup: boolean;
  houses: { id: string; name: string }[];
  supportGroups: { id: string; name: string }[];
  onSelectHouse: () => void;
  onSelectGroup: () => void;
  /** Campo de senha (só na criação) renderizado abaixo do e-mail. */
  passwordSlot?: ReactNode;
}

// Aba Sistema/Acesso do form de servo (story 96): identidade de acesso (nome,
// e-mail, senha), papel/nível e vínculo de serviço. Única aba com obrigatórios.
export function StaffSystemTab<T extends FieldValues>({
  register,
  errors,
  role,
  servesInGroup,
  houses,
  supportGroups,
  onSelectHouse,
  onSelectGroup,
  passwordSlot,
}: Props<T>) {
  const f = (name: string) => register(name as Path<T>);
  const errMsg = (name: string): string | undefined =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message;

  return (
    <>
      <FormField label="Nome completo *" error={errMsg('name')} full>
        <Input {...f('name')} placeholder="Nome completo" />
      </FormField>

      <FormField label="E-mail" error={errMsg('email')} full>
        <Input {...f('email')} type="email" placeholder="exemplo@email.com" />
      </FormField>

      {passwordSlot}

      <div className="space-y-2">
        <Label htmlFor="role">Função *</Label>
        <select id="role" {...f('role')} className={SELECT_CLASS}>
          <option value="">Selecione...</option>
          <option value={Role.ADMIN}>Administrador</option>
          <option value={Role.COORDINATOR}>Coordenador</option>
          <option value={Role.SERVANT}>Servo</option>
        </select>
        {errMsg('role') && <p className="text-sm text-destructive">{errMsg('role')}</p>}
      </div>

      {role === Role.SERVANT && (
        <div className="space-y-2">
          <Label htmlFor="rank">Nível</Label>
          <select id="rank" {...f('rank')} className={SELECT_CLASS}>
            {SERVANT_RANK_ORDER.map((r) => (
              <option key={r} value={r}>{SERVANT_RANK_LABELS[r]}</option>
            ))}
          </select>
        </div>
      )}

      <StaffServiceSelector
        servesInGroup={servesInGroup}
        onSelectHouse={onSelectHouse}
        onSelectGroup={onSelectGroup}
        houses={houses}
        supportGroups={supportGroups}
        houseIdReg={f('houseId')}
        supportGroupIdReg={f('supportGroupId')}
        houseIdError={errMsg('houseId')}
        supportGroupIdError={errMsg('supportGroupId')}
      />
    </>
  );
}
