import type { Staff } from '@fonte/api-client';

interface Props {
  staff: Staff;
  checked: boolean;
  onToggle: (staffId: string) => void;
}

/** Linha selecionável de um servo no convite via WhatsApp (story 95). */
export function InviteStaffRow({ staff, checked, onToggle }: Props) {
  return (
    <label
      data-testid="invite-staff-row"
      className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(staff.id)}
        className="h-4 w-4"
      />
      <span className="min-w-0 flex-1 truncate font-medium">{staff.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {staff.house?.name ?? 'Sem casa'}
      </span>
      {!staff.whatsapp && (
        <span className="shrink-0 text-xs text-amber-600">sem WhatsApp</span>
      )}
    </label>
  );
}
