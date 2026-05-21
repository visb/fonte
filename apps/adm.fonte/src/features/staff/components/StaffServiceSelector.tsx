import type { UseFormRegisterReturn } from 'react-hook-form';
import { Label } from '@/components/ui/label';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

interface Props {
  servesInGroup: boolean;
  onSelectHouse: () => void;
  onSelectGroup: () => void;
  houses: { id: string; name: string }[];
  supportGroups: { id: string; name: string }[];
  houseIdReg: UseFormRegisterReturn;
  supportGroupIdReg: UseFormRegisterReturn;
  houseIdError?: string;
  supportGroupIdError?: string;
}

export function StaffServiceSelector({
  servesInGroup,
  onSelectHouse,
  onSelectGroup,
  houses,
  supportGroups,
  houseIdReg,
  supportGroupIdReg,
  houseIdError,
  supportGroupIdError,
}: Props) {
  return (
    <>
      <div className="space-y-3">
        <Label>Tipo de serviço *</Label>
        <div className="flex rounded-lg border border-input overflow-hidden">
          <button
            type="button"
            onClick={onSelectHouse}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${!servesInGroup ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-accent'}`}
          >
            Serve na Casa
          </button>
          <button
            type="button"
            onClick={onSelectGroup}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${servesInGroup ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-accent'}`}
          >
            Serve no Grupo de Apoio
          </button>
        </div>
      </div>

      {!servesInGroup && (
        <div className="space-y-2">
          <Label htmlFor="houseId">Casa *</Label>
          <select id="houseId" {...houseIdReg} className={SELECT_CLASS}>
            <option value="">Selecione...</option>
            {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {houseIdError && <p className="text-sm text-destructive">{houseIdError}</p>}
        </div>
      )}

      {servesInGroup && (
        <div className="space-y-2">
          <Label htmlFor="supportGroupId">Grupo de Apoio *</Label>
          <select id="supportGroupId" {...supportGroupIdReg} className={SELECT_CLASS}>
            <option value="">Selecione...</option>
            {supportGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {supportGroupIdError && <p className="text-sm text-destructive">{supportGroupIdError}</p>}
        </div>
      )}
    </>
  );
}
