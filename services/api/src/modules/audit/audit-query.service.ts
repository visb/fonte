import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditChange, AuditTargetType } from '@fonte/types';
import { ListAuditEventsDto } from './dto/list-audit-events.dto';

export const AUDIT_DEFAULT_LIMIT = 50;
export const AUDIT_DEFAULT_PERIOD_DAYS = 30;

export interface AuditEventSummary {
  id: string;
  createdAt: string;
  action: string;
  outcome: string | null;
  reason: string | null;
  userId: string | null;
  userName: string | null;
  role: string | null;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  houseId: string | null;
  houseName: string | null;
  previousHouseId: string | null;
  previousHouseName: string | null;
  parentType: string | null;
  parentId: string | null;
  parentName: string | null;
  changedFields: string[] | null;
  /** `false` = evento legado (antes da story 199): sem diff nem contexto. */
  hasDetail: boolean;
}

export interface AuditEventDetail extends AuditEventSummary {
  changes: AuditChange[] | null;
  context: Record<string, unknown> | null;
  httpMethod: string | null;
  path: string | null;
  ipAddress: string | null;
  correlationId: string | null;
}

export interface AuditEventPage {
  items: AuditEventSummary[];
  nextCursor: string | null;
}

interface AuditRow {
  id: string;
  cursor_at: string;
  created_iso: string;
  action: string;
  outcome: string | null;
  reason: string | null;
  user_id: string | null;
  role: string | null;
  target_type: string | null;
  target_id: string | null;
  house_id: string | null;
  previous_house_id: string | null;
  parent_type: string | null;
  parent_id: string | null;
  changed_fields: string[] | null;
  changes: AuditChange[] | null;
  context: Record<string, unknown> | null;
  http_method: string | null;
  path: string | null;
  ip_address: string | null;
  correlation_id: string | null;
}

/** Tabelas cujo nome é resolvido na consulta (fallback: só o id). */
const NAMED_TABLES: Record<string, string> = {
  [AuditTargetType.RESIDENT]: 'residents',
  [AuditTargetType.STAFF]: 'staff',
  [AuditTargetType.HOUSE]: 'houses',
  [AuditTargetType.MINISTRY]: 'ministries',
  [AuditTargetType.RESIDENT_RELATIVE]: 'relatives',
};

/**
 * Instantes formatados pelo banco: `cursor_at` com microssegundos (cursor
 * estável mesmo com datas iguais no milissegundo) e `created_iso` em UTC
 * (independe do type parser do pg para TIMESTAMP sem fuso).
 */
const SELECT_COLUMNS = `a.*,
  to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS cursor_at,
  to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_iso`;

const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;

/** Cursor opaco: instante com microssegundos (texto do banco) + id. */
export function encodeCursor(cursorAt: string, id: string): string {
  return Buffer.from(`${cursorAt}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { at: string; id: string } {
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!at || !id || !CURSOR_AT_RE.test(at) || !UUID_RE.test(id)) {
    throw new BadRequestException('Cursor inválido');
  }
  return { at, id };
}

/**
 * Consulta da trilha de auditoria (story 199) — exclusiva de ADMIN (o guard
 * fica no controller). Paginação por cursor com ordenação estável
 * `created_at DESC, id DESC`; nada é carregado inteiro em memória.
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly dataSource: DataSource) {}

  async list(dto: ListAuditEventsDto, now: Date = new Date()): Promise<AuditEventPage> {
    const to = dto.to ? new Date(dto.to) : now;
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - AUDIT_DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('O início do período deve ser anterior ao fim.');
    }
    const limit = dto.limit ?? AUDIT_DEFAULT_LIMIT;

    // created_at é TIMESTAMP sem fuso gravado em UTC (ver main.ts).
    const params: unknown[] = [from.toISOString(), to.toISOString()];
    const where = [
      `a.created_at >= ($1::timestamptz AT TIME ZONE 'UTC')`,
      `a.created_at < ($2::timestamptz AT TIME ZONE 'UTC')`,
    ];
    const add = (sql: (p: string) => string, value: unknown) => {
      params.push(value);
      where.push(sql(`$${params.length}`));
    };
    if (dto.userId) add((p) => `a.user_id = ${p}::uuid`, dto.userId);
    if (dto.houseId) add((p) => `(a.house_id = ${p}::uuid OR a.previous_house_id = ${p}::uuid)`, dto.houseId);
    if (dto.action) add((p) => `a.action = ${p}`, dto.action);
    if (dto.targetType) add((p) => `a.target_type = ${p}`, dto.targetType);
    if (dto.targetId) add((p) => `(a.target_id = ${p} OR a.parent_id = ${p})`, dto.targetId);
    if (dto.outcome) add((p) => `a.outcome = ${p}`, dto.outcome);
    if (dto.cursor) {
      const { at, id } = decodeCursor(dto.cursor);
      params.push(at, id);
      where.push(`(a.created_at, a.id) < ($${params.length - 1}::timestamp, $${params.length}::uuid)`);
    }
    params.push(limit + 1);

    const rows = await this.dataSource.query<AuditRow[]>(
      `SELECT ${SELECT_COLUMNS}
         FROM audit_logs a
        WHERE ${where.join(' AND ')}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $${params.length}`,
      params,
    );

    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.cursor_at, last.id) : null;
    const names = await this.resolveNames(page);
    return { items: page.map((row) => this.toSummary(row, names)), nextCursor };
  }

  async findOne(id: string): Promise<AuditEventDetail> {
    const rows = await this.dataSource.query<AuditRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM audit_logs a WHERE a.id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`Evento de auditoria ${id} não encontrado`);
    const names = await this.resolveNames([row]);
    return {
      ...this.toSummary(row, names),
      changes: row.changes ?? null,
      context: row.context ?? null,
      httpMethod: row.http_method,
      path: row.path,
      ipAddress: row.ip_address,
      correlationId: row.correlation_id,
    };
  }

  private toSummary(row: AuditRow, names: ResolvedNames): AuditEventSummary {
    return {
      id: row.id,
      createdAt: row.created_iso,
      action: row.action,
      outcome: row.outcome,
      reason: row.reason,
      userId: row.user_id,
      userName: row.user_id ? (names.users.get(row.user_id) ?? null) : null,
      role: row.role,
      targetType: row.target_type,
      targetId: row.target_id,
      targetName: nameOf(names, row.target_type, row.target_id),
      houseId: row.house_id,
      houseName: row.house_id ? (names.houses.get(row.house_id) ?? null) : null,
      previousHouseId: row.previous_house_id,
      previousHouseName: row.previous_house_id ? (names.houses.get(row.previous_house_id) ?? null) : null,
      parentType: row.parent_type,
      parentId: row.parent_id,
      parentName: nameOf(names, row.parent_type, row.parent_id),
      changedFields: row.changed_fields ?? null,
      hasDetail: row.changes != null || row.context != null,
    };
  }

  /** Nomes atuais pelo banco (inclusive excluídos); ausentes ficam `null` → UI mostra o id. */
  private async resolveNames(rows: AuditRow[]): Promise<ResolvedNames> {
    const users = new Set<string>();
    const houses = new Set<string>();
    const byType = new Map<string, Set<string>>();
    const addTarget = (type: string | null, id: string | null) => {
      if (!type || !id || !NAMED_TABLES[type] || !UUID_RE.test(id)) return;
      if (!byType.has(type)) byType.set(type, new Set());
      byType.get(type)!.add(id);
    };
    for (const row of rows) {
      if (row.user_id) users.add(row.user_id);
      if (row.house_id) houses.add(row.house_id);
      if (row.previous_house_id) houses.add(row.previous_house_id);
      addTarget(row.target_type, row.target_id);
      addTarget(row.parent_type, row.parent_id);
    }
    if (houses.size) {
      byType.set(AuditTargetType.HOUSE, new Set([...(byType.get(AuditTargetType.HOUSE) ?? []), ...houses]));
    }

    const result: ResolvedNames = { users: new Map(), houses: new Map(), targets: new Map() };
    if (users.size) {
      const userRows = await this.dataSource.query<Array<{ id: string; name: string | null }>>(
        `SELECT u.id, COALESCE(s.name, rel.name, r.name) AS name
           FROM users u
           LEFT JOIN staff s ON s.user_id = u.id
           LEFT JOIN relatives rel ON rel.user_id = u.id
           LEFT JOIN residents r ON r.user_id = u.id
          WHERE u.id = ANY($1::uuid[])`,
        [[...users]],
      );
      for (const u of userRows) if (u.name) result.users.set(u.id, u.name);
    }
    for (const [type, ids] of byType) {
      const table = NAMED_TABLES[type];
      const named = await this.dataSource.query<Array<{ id: string; name: string }>>(
        `SELECT id, name FROM ${table} WHERE id = ANY($1::uuid[])`,
        [[...ids]],
      );
      for (const n of named) {
        result.targets.set(`${type}:${n.id}`, n.name);
        if (type === AuditTargetType.HOUSE) result.houses.set(n.id, n.name);
      }
    }
    return result;
  }
}

interface ResolvedNames {
  users: Map<string, string>;
  houses: Map<string, string>;
  targets: Map<string, string>;
}

function nameOf(names: ResolvedNames, type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  return names.targets.get(`${type}:${id}`) ?? null;
}

