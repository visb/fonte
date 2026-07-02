import { type ReactNode, useState } from 'react';
import { type FieldErrors, type FieldValues, type UseFormRegister } from 'react-hook-form';
import { Role } from '@fonte/types';
import { StaffFormTabs, type StaffTabDef } from './StaffFormTabs';
import { StaffSystemTab } from './StaffSystemTab';
import { StaffPersonalTab } from './StaffPersonalTab';
import { StaffAddressContactTab } from './StaffAddressContactTab';
import { staffTabsWithError, type StaffTabId } from '../lib/staffSchema';

interface Props<T extends FieldValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  role: Role | undefined;
  servesInGroup: boolean;
  houses: { id: string; name: string }[];
  supportGroups: { id: string; name: string }[];
  onSelectHouse: () => void;
  onSelectGroup: () => void;
  passwordSlot?: ReactNode;
}

// Orquestra as três abas do form de servo (Sistema, Pessoal, Endereço e
// contato) sobre o <StaffFormTabs>. Sinaliza a aba com erro de validação e
// preserva valores ao trocar de aba (todas montadas). Story 96.
export function StaffFormSection<T extends FieldValues>({
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
  const [activeTab, setActiveTab] = useState<StaffTabId>('system');
  const tabErrors = staffTabsWithError(Object.keys(errors));

  const tabs: StaffTabDef[] = [
    {
      id: 'system',
      label: 'Sistema',
      hasError: tabErrors.system,
      content: (
        <StaffSystemTab
          register={register}
          errors={errors}
          role={role}
          servesInGroup={servesInGroup}
          houses={houses}
          supportGroups={supportGroups}
          onSelectHouse={onSelectHouse}
          onSelectGroup={onSelectGroup}
          passwordSlot={passwordSlot}
        />
      ),
    },
    {
      id: 'personal',
      label: 'Pessoal',
      hasError: tabErrors.personal,
      content: <StaffPersonalTab register={register} errors={errors} />,
    },
    {
      id: 'address',
      label: 'Endereço e contato',
      hasError: tabErrors.address,
      content: <StaffAddressContactTab register={register} errors={errors} />,
    },
  ];

  return <StaffFormTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />;
}
