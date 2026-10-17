import { contextLabel, formatChangeValue } from '../constants';

interface Props {
  context: Record<string, unknown>;
}

/** Contexto de eventos sem diff (login, documentos, contagem) como lista legível. */
export function AuditContextList({ context }: Props) {
  const entries = Object.entries(context);
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{contextLabel(key)}</dt>
          <dd data-testid={`audit-context-${key}`}>{formatChangeValue(value, false)}</dd>
        </div>
      ))}
    </dl>
  );
}
