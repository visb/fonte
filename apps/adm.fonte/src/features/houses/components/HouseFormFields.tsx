import { type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BR_STATES, SELECT_CLASS, type HouseFormData } from '../constants';
import type { HouseStaffSummary } from '@fonte/api-client';

interface HouseFormFieldsProps {
  register: UseFormRegister<HouseFormData>;
  errors: Partial<Record<keyof HouseFormData, { message?: string }>>;
  /**
   * Coordenadores DESTA casa (story 194): o titular sai da lista derivada, não
   * do staff inteiro da organização — a UI para de oferecer opção que o backend
   * recusaria com 400.
   */
  coordinators: HouseStaffSummary[];
  /** Na criação o titular ainda não pode existir (decisão 8): campo não renderizado. */
  isEdit: boolean;
}

export function HouseFormFields({ register, errors, coordinators, isEdit }: HouseFormFieldsProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" {...register('name')} placeholder="Ex: Casa da Paz" />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="generalCapacity">Cap. filhos</Label>
          <Input id="generalCapacity" type="number" min={1} {...register('generalCapacity')} placeholder="Ex: 15" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staffCapacity">Cap. servos</Label>
          <Input id="staffCapacity" type="number" min={1} {...register('staffCapacity')} placeholder="Ex: 5" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Endereço</Label>
        <Input id="address" {...register('address')} placeholder="Ex: Rua das Flores, 123" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="col-span-1 sm:col-span-2 space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" {...register('city')} placeholder="Ex: São Paulo" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">UF</Label>
          <select id="state" {...register('state')} className={SELECT_CLASS}>
            <option value="">—</option>
            {BR_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <Input id="phone" {...register('phone')} placeholder="Ex: (11) 99999-9999" />
      </div>

      {isEdit ? (
        <div className="space-y-2">
          <Label htmlFor="coordinatorId">Coordenador titular</Label>
          <select id="coordinatorId" {...register('coordinatorId')} className={SELECT_CLASS}>
            <option value="">Sem titular</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Só coordenadores lotados nesta casa podem ser titulares.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Defina o titular depois de lotar os coordenadores na casa.
        </p>
      )}

      <label htmlFor="isMotherHouse" className="flex items-center gap-2 cursor-pointer">
        <input
          id="isMotherHouse"
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          {...register('isMotherHouse')}
        />
        <span className="text-sm">Casa mãe (sede do curso bíblico)</span>
      </label>
    </div>
  );
}
