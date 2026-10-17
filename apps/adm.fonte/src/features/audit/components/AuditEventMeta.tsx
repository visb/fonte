import { Link } from 'react-router-dom';
import type { AuditEventDetail } from '@fonte/api-client';
import { OUTCOME_LABELS, reasonLabel, ROLE_LABELS, targetTypeLabel } from '../constants';
import { shortId } from '../utils';

interface Props {
  event: AuditEventDetail;
  onNavigate: () => void;
}

/** Rotas de detalhe que existem no adm, por tipo de recurso. */
const RESOURCE_ROUTES: Record<string, (id: string) => string> = {
  resident: (id) => `/residents/${id}`,
  staff: (id) => `/staff/${id}`,
  house: (id) => `/houses/${id}`,
};

function Resource({ type, id, name, onNavigate }: {
  type: string | null;
  id: string | null;
  name: string | null;
  onNavigate: () => void;
}) {
  if (!id) return <span>—</span>;
  const label = `${targetTypeLabel(type)} · ${name ?? shortId(id)}`;
  // Navega só quando o recurso ainda existe (nome resolvido) e tem tela própria.
  const route = type && name ? RESOURCE_ROUTES[type] : undefined;
  if (!route) return <span title={id}>{label}</span>;
  return (
    <Link to={route(id)} onClick={onNavigate} className="underline" title={id}>
      {label}
    </Link>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Quem, o quê, onde: cabeçalho do detalhe do evento. */
export function AuditEventMeta({ event, onNavigate }: Props) {
  const author = event.userName ?? (event.userId ? shortId(event.userId) : 'Tentativa não autenticada');
  const house = event.houseName ?? (event.houseId ? shortId(event.houseId) : '—');
  const previous = event.previousHouseId ? (event.previousHouseName ?? shortId(event.previousHouseId)) : null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <Row label="Usuário">
        {author}
        {event.role ? ` (${ROLE_LABELS[event.role] ?? event.role})` : ''}
      </Row>
      <Row label="Resultado">
        {event.outcome ? OUTCOME_LABELS[event.outcome] : '—'}
        {event.reason ? ` · ${reasonLabel(event.reason)}` : ''}
      </Row>
      <Row label="Recurso">
        <Resource type={event.targetType} id={event.targetId} name={event.targetName} onNavigate={onNavigate} />
      </Row>
      {event.parentId && (
        <Row label="Relacionado a">
          <Resource type={event.parentType} id={event.parentId} name={event.parentName} onNavigate={onNavigate} />
        </Row>
      )}
      <Row label="Casa">{previous ? `${previous} → ${house}` : house}</Row>
      {event.path && (
        <Row label="Origem">
          <span className="font-mono text-xs">
            {event.httpMethod} {event.path}
            {event.ipAddress ? ` · ${event.ipAddress}` : ''}
          </span>
        </Row>
      )}
    </dl>
  );
}
