import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import {
  AuditAction,
  AuditChange,
  AuditOutcome,
  AuditTargetType,
  LoginFailureReason,
} from '@fonte/types';
import { AuditLog } from './audit-log.entity';
import { AuditFieldMap, AuditSnapshot, diffSnapshots, maskLoginIdentifier } from './audit-diff';
import { AuditRequestContext, currentAuditContext, stripQuery } from './audit-context';

/** Entrada livre (contrato antigo do `@Audit`, preservado). */
export interface AuditEntry {
  userId?: string | null;
  role?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  httpMethod?: string | null;
  path?: string | null;
  ipAddress?: string | null;
  outcome?: AuditOutcome | null;
  reason?: string | null;
  /** `undefined` = resolver pela ficha do filho (alvo ou pai `resident`). */
  houseId?: string | null;
  previousHouseId?: string | null;
  parentType?: string | null;
  parentId?: string | null;
  changes?: AuditChange[] | null;
  context?: Record<string, unknown> | null;
}

/** Onde o evento "mora": casa(s) e recurso principal relacionado. */
export interface AuditScope {
  houseId?: string | null;
  previousHouseId?: string | null;
  parentType?: string | null;
  parentId?: string | null;
  context?: Record<string, unknown> | null;
}

export interface TrackOptions<R> {
  action: string;
  targetType: string;
  /** Ausente na criação — vem de `resolveId(result)`. */
  targetId?: string;
  fields: AuditFieldMap;
  /** Lê o estado PERSISTIDO do alvo (antes e depois da escrita, na mesma transação). */
  load: (manager: EntityManager, id: string) => Promise<AuditSnapshot | null>;
  write: (manager: EntityManager) => Promise<R>;
  resolveId?: (result: R) => string;
  scope?: (state: { before: AuditSnapshot | null; after: AuditSnapshot | null; result: R }) => AuditScope;
  /** Tabela do alvo: trava a linha (`FOR UPDATE`) antes de ler o "antes". */
  lockTable?: string;
  /** Transação externa (ex.: commit do import). Sem ela, abre uma própria. */
  manager?: EntityManager;
}

/** Só o nome/código do erro: mensagem de banco pode carregar valores. */
export function describeAuditError(error: unknown): string {
  const e = error as { name?: string; code?: string } | null;
  return [e?.name ?? 'Error', e?.code].filter(Boolean).join(':');
}

/** Loader padrão: a linha da entidade pelo id (ignora soft-deletadas). */
export function loadById<E extends ObjectLiteral>(entity: EntityTarget<E>) {
  return async (manager: EntityManager, id: string): Promise<AuditSnapshot | null> =>
    ((await manager.getRepository(entity).findOne({ where: { id } as never })) as AuditSnapshot | null) ??
    null;
}

const RESIDENT_TYPE = AuditTargetType.RESIDENT;

/** Recursos que pertencem a uma casa — de onde sai o `house_id` do evento. */
const HOUSE_OWNER_TABLES: Record<string, string> = {
  [AuditTargetType.RESIDENT]: 'residents',
  [AuditTargetType.STAFF]: 'staff',
  [AuditTargetType.MINISTRY]: 'ministries',
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Escrita ──────────────────────────────────────────────────────────────

  /**
   * Contrato transacional (story 199): lê o "antes" com a linha travada, executa
   * a escrita, lê o "depois" e grava o evento — TUDO na mesma transação. Se a
   * gravação da auditoria falhar, a alteração não é confirmada. Edição sem
   * mudança efetiva não gera evento.
   */
  async track<R>(options: TrackOptions<R>): Promise<R> {
    const run = async (manager: EntityManager): Promise<R> => {
      if (options.lockTable && options.targetId) {
        await manager.query(`SELECT 1 FROM "${options.lockTable}" WHERE id = $1 FOR UPDATE`, [
          options.targetId,
        ]);
      }
      const before = options.targetId ? await options.load(manager, options.targetId) : null;
      const result = await options.write(manager);
      const targetId = options.targetId ?? options.resolveId?.(result) ?? null;
      const after = targetId ? await options.load(manager, targetId) : null;
      const changes = diffSnapshots(options.fields, before, after);
      if (changes.length === 0) return result;

      const scope = options.scope?.({ before, after, result }) ?? defaultScope(before, after);
      const entry: AuditEntry = {
        action: options.action,
        targetType: options.targetType,
        targetId,
        changes,
        ...scope,
      };
      if (entry.houseId === undefined) entry.houseId = await this.resolveResidentHouse(entry, manager);
      await this.recordChange(manager, entry);
      return result;
    };
    return this.inTransaction(run, options.manager);
  }

  /** Roda `work` na transação do chamador ou numa nova (escritas em lote). */
  inTransaction<R>(work: (manager: EntityManager) => Promise<R>, manager?: EntityManager): Promise<R> {
    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  /**
   * Grava um evento DENTRO da transação do chamador. Lança em caso de falha —
   * quem chama dentro de transação perde a alteração junto (é o objetivo).
   */
  async recordChange(manager: EntityManager, entry: AuditEntry): Promise<void> {
    await manager.getRepository(AuditLog).insert(this.buildRow(entry));
  }

  /**
   * Evento sem transação de negócio (documentos gerados, conclusão de contagem,
   * leituras do `@Audit`). Gravação AGUARDADA; falha vira aviso sanitizado e não
   * derruba a requisição (limitação documentada: sem fila durável, não há
   * garantia absoluta para estes eventos).
   */
  async recordEvent(entry: AuditEntry): Promise<void> {
    try {
      const houseId =
        entry.houseId !== undefined ? entry.houseId : await this.resolveResidentHouse(entry);
      await this.repo.insert(this.buildRow({ ...entry, houseId }));
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar audit log (${entry.action}, requestId=${currentAuditContext()?.requestId ?? '-'}): ${describeAuditError(error)}`,
      );
    }
  }

  /** Contrato antigo (best-effort). Mantido para consumidores existentes. */
  record(entry: AuditEntry): Promise<void> {
    return this.recordEvent(entry);
  }

  /**
   * Uma ocorrência por tentativa de login, a partir do status FINAL da resposta
   * (inclui rejeição de DTO e throttle, que não chegam ao handler). Falha não
   * atribui identidade: autor nulo + identificador mascarado.
   */
  async recordLogin(ctx: AuditRequestContext, status: number, identifier: unknown): Promise<void> {
    const success = status >= 200 && status < 300;
    const reason = success ? null : loginReasonFor(status, ctx.login?.reason ?? null);
    try {
      await this.repo.insert({
        ...this.buildRow(
          {
            action: AuditAction.LOGIN,
            outcome: success ? AuditOutcome.SUCCESS : AuditOutcome.FAILURE,
            reason,
            targetType: success ? AuditTargetType.USER : null,
            targetId: success ? (ctx.login?.userId ?? null) : null,
            houseId: null,
            context: { identifier: maskLoginIdentifier(identifier), status },
          },
          ctx,
        ),
        userId: success ? (ctx.login?.userId ?? null) : null,
        role: success ? (ctx.login?.role ?? null) : null,
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar auditoria de login (requestId=${ctx.requestId}): ${describeAuditError(error)}`,
      );
    }
  }

  /**
   * LGPD — anonimização do titular: zera os valores dos diffs ligados a ele
   * (alvo ou recurso principal), preservando só QUE houve alteração e em quais
   * campos. Roda na transação da anonimização.
   */
  async redactForResident(manager: EntityManager, residentId: string): Promise<void> {
    await manager.query(
      `UPDATE audit_logs SET changes = (
         SELECT jsonb_agg(jsonb_build_object('field', c->>'field', 'before', NULL, 'after', NULL, 'redacted', true))
           FROM jsonb_array_elements(audit_logs.changes) c)
       WHERE changes IS NOT NULL AND jsonb_array_length(changes) > 0
         AND ((target_type = $2 AND target_id = $1) OR (parent_type = $2 AND parent_id = $1))`,
      [residentId, RESIDENT_TYPE],
    );
  }

  // ── Leitura legada ───────────────────────────────────────────────────────

  // Consulta de trilha por alvo (ex. histórico de acessos a um interno).
  findByTarget(targetType: string, targetId: string): Promise<AuditLog[]> {
    return this.repo.find({
      where: { targetType, targetId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private buildRow(entry: AuditEntry, ctx: AuditRequestContext | undefined = currentAuditContext()) {
    const changes = entry.changes ?? null;
    return {
      userId: entry.userId !== undefined ? entry.userId : (ctx?.userId ?? null),
      role: entry.role !== undefined ? entry.role : (ctx?.role ?? null),
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      httpMethod: entry.httpMethod ?? ctx?.httpMethod ?? null,
      path: stripQuery(entry.path ?? ctx?.path ?? null),
      ipAddress: entry.ipAddress ?? ctx?.ipAddress ?? null,
      outcome: entry.outcome ?? AuditOutcome.SUCCESS,
      reason: entry.reason ?? null,
      houseId: entry.houseId ?? null,
      previousHouseId: entry.previousHouseId ?? null,
      parentType: entry.parentType ?? null,
      parentId: entry.parentId ?? null,
      correlationId: ctx?.requestId ?? null,
      changedFields: changes ? changes.map((c) => c.field) : null,
      changes: changes as never,
      context: (entry.context ?? null) as never,
    };
  }

  /** Casa atual do filho (alvo ou recurso principal) para eventos sem diff. */
  private async resolveResidentHouse(
    entry: AuditEntry,
    runner: Pick<EntityManager, 'query'> = this.dataSource,
  ): Promise<string | null> {
    // Recurso principal primeiro (ex.: o filho da parcela), depois o próprio alvo.
    const candidates: Array<[string | null | undefined, string | null | undefined]> = [
      [entry.parentType, entry.parentId],
      [entry.targetType, entry.targetId],
    ];
    for (const [type, id] of candidates) {
      const table = type ? HOUSE_OWNER_TABLES[type] : undefined;
      if (!table || !id) continue;
      const rows = await runner.query<Array<{ house_id: string | null }>>(
        `SELECT house_id FROM ${table} WHERE id::text = $1`,
        [id],
      );
      return rows?.[0]?.house_id ?? null;
    }
    return null;
  }
}

/** Casa padrão: a do estado novo (ou do antigo, na exclusão); transferência guarda as duas. */
export function defaultScope(before: AuditSnapshot | null, after: AuditSnapshot | null): AuditScope {
  // Snapshot sem coluna de casa: `undefined` → o track resolve pela ficha do filho.
  if (!('houseId' in (after ?? before ?? {}))) return {};
  const beforeHouse = (before?.houseId as string | null | undefined) ?? null;
  const afterHouse = (after?.houseId as string | null | undefined) ?? null;
  return {
    houseId: after ? afterHouse : beforeHouse,
    previousHouseId: before && after && beforeHouse !== afterHouse ? beforeHouse : null,
  };
}

export function loginReasonFor(
  status: number,
  noted: LoginFailureReason | null,
): LoginFailureReason {
  if (status === 429) return LoginFailureReason.RATE_LIMITED;
  if (status >= 500) return LoginFailureReason.INTERNAL_ERROR;
  if (status === 401) return noted ?? LoginFailureReason.INVALID_CREDENTIALS;
  return LoginFailureReason.INVALID_INPUT;
}
