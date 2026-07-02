import type { EventInviteResult, EventInviteSkipReason } from '@fonte/api-client';

interface Props {
  result: EventInviteResult;
  /** Nome do servo por staffId, para exibir os pulados de forma legível. */
  staffNames: Map<string, string>;
}

const SKIP_REASON_LABELS: Record<EventInviteSkipReason, string> = {
  NOT_FOUND: 'servo não encontrado',
  NO_WHATSAPP: 'sem WhatsApp cadastrado',
  SEND_FAILED: 'falha no envio',
};

/** Resumo do disparo de convites: enviados e pulados com motivo (story 95). */
export function InviteStaffSummary({ result, staffNames }: Props) {
  return (
    <div data-testid="invite-summary" className="space-y-3 text-sm">
      <p className="font-medium">
        {result.sent.length} convite(s) enviado(s), {result.skipped.length} pulado(s).
      </p>

      {result.skipped.length > 0 && (
        <ul className="space-y-1 text-muted-foreground">
          {result.skipped.map((item) => (
            <li key={item.staffId} data-testid="invite-skipped-item">
              {staffNames.get(item.staffId) ?? item.staffId} —{' '}
              {SKIP_REASON_LABELS[item.reason]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
