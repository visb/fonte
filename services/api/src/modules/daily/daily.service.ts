import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import {
  ApplyDailyResult,
  ApplyDailySkipped,
  DAILY_SKIP_REASONS,
  DAILY_STAFF_ROLE_LABELS,
  DailyBoard,
  DailyPerson,
  DailyPersonType,
  DailySessionStatus,
  MoveDailyPersonResult,
  Role,
  todayInSaoPaulo,
} from '@fonte/types';
import { DailySession } from './daily-session.entity';
import { DailySessionAssignment } from './daily-session-assignment.entity';
import { DailyMinistryRow, DailyPersonRow, DailyRepository } from './daily.repository';
import {
  DAILY_APPLIED_EVENT,
  DAILY_MOVED_EVENT,
  DAILY_RESET_EVENT,
  DailyAppliedEvent,
  DailyMovedEvent,
  DailyResetEvent,
} from './daily.events';
import { MoveDailyPersonDto } from './dto/move-daily-person.dto';
import { MinistryService } from '../ministry/ministry.service';

/** Identidade autenticada que o service precisa (JWT não carrega houseId). */
export interface DailyUser {
  userId: string;
  role: string;
}

/** Decisão 3: só ADMIN e COORDINATOR abrem e editam a daily. */
export const DAILY_ROLES: readonly string[] = [Role.ADMIN, Role.COORDINATOR];

export const DAILY_FORBIDDEN_MESSAGE = 'Só coordenadores da casa acessam a daily.';
export const DAILY_CLOSED_MESSAGE = 'Esta daily já foi encerrada.';
export const DAILY_INVALID_MINISTRY_MESSAGE = 'Ministério inválido para esta casa.';
export const DAILY_PERSON_NOT_ON_BOARD_MESSAGE = 'Pessoa fora do board desta daily.';

interface BoardState {
  ministries: DailyMinistryRow[];
  people: DailyPersonRow[];
  assignments: DailySessionAssignment[];
}

const keyOf = (type: string, id: string) => `${type}:${id}`;
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

/**
 * Story 225 — Daily: rascunho compartilhado do board de ministérios da casa.
 * Arrastar só mexe no rascunho; "Aplicar" grava nos ministérios reais numa
 * transação, com a auditoria do `MinistryService`.
 */
@Injectable()
export class DailyService {
  constructor(
    private readonly repo: DailyRepository,
    private readonly dataSource: DataSource,
    private readonly ministries: MinistryService,
    private readonly events: EventEmitter2,
  ) {}

  // ─── Acesso ──────────────────────────────────────────────────────────────────

  /** Casa da daily: ADMIN escolhe (ou usa a lotação); coordenador só a própria. */
  async resolveHouse(user: DailyUser, requestedHouseId?: string): Promise<string> {
    if (!DAILY_ROLES.includes(user.role)) throw new ForbiddenException(DAILY_FORBIDDEN_MESSAGE);
    const own = await this.repo.staffHouseId(user.userId);
    let houseId: string | null;
    if (user.role === Role.ADMIN) {
      houseId = requestedHouseId ?? own;
      if (!houseId) throw new BadRequestException('Informe a casa (houseId).');
    } else {
      if (!own || (requestedHouseId && requestedHouseId !== own)) {
        throw new ForbiddenException(DAILY_FORBIDDEN_MESSAGE);
      }
      houseId = own;
    }
    if (!(await this.repo.houseExists(houseId))) throw new NotFoundException('Casa não encontrada.');
    return houseId;
  }

  /** Sessão visível ao usuário (usado também pelo gateway no `daily:join`). */
  async findSessionForUser(user: DailyUser, sessionId: string): Promise<DailySession> {
    if (!DAILY_ROLES.includes(user.role)) throw new ForbiddenException(DAILY_FORBIDDEN_MESSAGE);
    const session = await this.repo.findSession(sessionId);
    if (!session) throw new NotFoundException('Daily não encontrada.');
    if (user.role !== Role.ADMIN) {
      const own = await this.repo.staffHouseId(user.userId);
      if (!own || own !== session.houseId) throw new ForbiddenException(DAILY_FORBIDDEN_MESSAGE);
    }
    return session;
  }

  // ─── Abertura (decisões 4 e 5) ───────────────────────────────────────────────

  /**
   * Sessão OPEN do dia (sincronizada com o estado da casa); sem ela, a APLICADA
   * de hoje (somente leitura); sem nenhuma, abre uma nova pré-preenchida. OPEN
   * de dia anterior é descartada.
   */
  async current(user: DailyUser, requestedHouseId?: string): Promise<DailyBoard> {
    const houseId = await this.resolveHouse(user, requestedHouseId);
    const { board, previousSessionId } = await this.withUniqueRetry(() =>
      this.dataSource.transaction(async (m) => {
        const today = todayInSaoPaulo();
        const { open, discardedId } = await this.openOfToday(m, houseId, today);
        if (open) return { board: await this.syncedBoard(m, open), previousSessionId: null };
        const applied = await this.repo.findAppliedOn(m, houseId, today);
        if (applied && !discardedId) {
          return { board: await this.boardOf(m, applied), previousSessionId: null };
        }
        const created = await this.openSession(m, houseId, today, user.userId);
        return { board: await this.boardOf(m, created), previousSessionId: discardedId };
      }),
    );
    this.emitReset(previousSessionId, board);
    return board;
  }

  /** "Nova daily" depois de aplicar: nova sessão pré-preenchida do estado real. */
  async start(user: DailyUser, requestedHouseId?: string): Promise<DailyBoard> {
    const houseId = await this.resolveHouse(user, requestedHouseId);
    const { board, previousSessionId } = await this.withUniqueRetry(() =>
      this.dataSource.transaction(async (m) => {
        const today = todayInSaoPaulo();
        const { open, discardedId } = await this.openOfToday(m, houseId, today);
        // Já há uma aberta (outro coordenador tocou antes): devolve a mesma.
        if (open) return { board: await this.syncedBoard(m, open), previousSessionId: null };
        const applied = await this.repo.findAppliedOn(m, houseId, today);
        const created = await this.openSession(m, houseId, today, user.userId);
        return {
          board: await this.boardOf(m, created),
          previousSessionId: discardedId ?? applied?.id ?? null,
        };
      }),
    );
    this.emitReset(previousSessionId, board);
    return board;
  }

  private async openOfToday(
    m: EntityManager,
    houseId: string,
    today: string,
  ): Promise<{ open: DailySession | null; discardedId: string | null }> {
    const open = await this.repo.lockOpenSession(m, houseId);
    if (open && String(open.sessionDate) < today) {
      open.status = DailySessionStatus.DISCARDED;
      await this.repo.saveSession(m, open);
      return { open: null, discardedId: open.id };
    }
    return { open, discardedId: null };
  }

  /** Pré-preenche: filho no ministério atual, servo no vínculo mais antigo. */
  private async openSession(
    m: EntityManager,
    houseId: string,
    today: string,
    userId: string,
  ): Promise<DailySession> {
    const session = await this.repo.createSession(m, {
      houseId,
      status: DailySessionStatus.OPEN,
      sessionDate: today,
      version: 0,
      createdByUserId: userId,
    });
    const people = await this.repo.listEligiblePeople(m, houseId);
    await this.repo.insertAssignments(
      m,
      people.map((p) => ({
        sessionId: session.id,
        personType: p.type,
        personId: p.id,
        ministryId: p.ministryIds[0] ?? null,
        updatedByUserId: userId,
      })),
    );
    return session;
  }

  private async loadState(m: EntityManager, session: DailySession): Promise<BoardState> {
    // Sequencial de propósito: dentro da transação é uma conexão só (o pg
    // depreca query concorrente no mesmo client).
    const ministries = await this.repo.listMinistries(m, session.houseId);
    const people = await this.repo.listEligiblePeople(m, session.houseId);
    const assignments = await this.repo.listAssignments(m, session.id);
    return { ministries, people, assignments };
  }

  /**
   * Sync a cada GET (decisão 5): pessoa nova entra em "Sem ministério", quem
   * deixou de ser elegível sai, membro de ministério excluído vai para "Sem
   * ministério". Mudou algo → `version` sobe (os outros aparelhos refazem o GET).
   */
  private async syncedBoard(m: EntityManager, session: DailySession): Promise<DailyBoard> {
    const state = await this.loadState(m, session);
    const peopleKeys = new Set(state.people.map((p) => keyOf(p.type, p.id)));
    const assignedKeys = new Set(state.assignments.map((a) => keyOf(a.personType, a.personId)));
    const validMinistries = new Set(state.ministries.map((mi) => mi.id));

    const gone = state.assignments.filter((a) => !peopleKeys.has(keyOf(a.personType, a.personId)));
    const orphaned = state.assignments.filter(
      (a) => peopleKeys.has(keyOf(a.personType, a.personId)) && a.ministryId && !validMinistries.has(a.ministryId),
    );
    const added = state.people
      .filter((p) => !assignedKeys.has(keyOf(p.type, p.id)))
      .map((p) => ({ sessionId: session.id, personType: p.type, personId: p.id, ministryId: null }));

    if (gone.length + orphaned.length + added.length > 0) {
      await this.repo.deleteAssignments(m, gone.map((a) => a.id));
      await this.repo.clearAssignmentMinistry(m, orphaned.map((a) => a.id));
      await this.repo.insertAssignments(m, added);
      session.version = await this.repo.bumpVersion(m, session.id);
      const goneIds = new Set(gone.map((a) => a.id));
      const orphanIds = new Set(orphaned.map((a) => a.id));
      state.assignments = [
        ...state.assignments
          .filter((a) => !goneIds.has(a.id))
          .map((a) => (orphanIds.has(a.id) ? { ...a, ministryId: null } : a)),
        ...(added as DailySessionAssignment[]),
      ];
    }
    return this.toBoard(m, session, state);
  }

  private async boardOf(m: EntityManager, session: DailySession): Promise<DailyBoard> {
    return this.toBoard(m, session, await this.loadState(m, session));
  }

  private async toBoard(m: EntityManager, session: DailySession, state: BoardState): Promise<DailyBoard> {
    const people = new Map(state.people.map((p) => [keyOf(p.type, p.id), p]));
    const buckets = new Map<string | null, DailyPerson[]>(state.ministries.map((mi) => [mi.id, []]));
    const unassigned: DailyPerson[] = [];
    for (const a of state.assignments) {
      const row = people.get(keyOf(a.personType, a.personId));
      if (!row) continue;
      const bucket = (a.ministryId && buckets.get(a.ministryId)) || unassigned;
      bucket.push(toPerson(row));
    }
    return {
      session: {
        id: session.id,
        houseId: session.houseId,
        status: session.status,
        sessionDate: String(session.sessionDate),
        version: session.version,
        appliedAt: session.appliedAt ? new Date(session.appliedAt).toISOString() : null,
        appliedByUserId: session.appliedByUserId ?? null,
        appliedByName: await this.repo.userName(m, session.appliedByUserId ?? null),
      },
      ministries: state.ministries.map((mi) => ({
        id: mi.id,
        name: mi.name,
        members: (buckets.get(mi.id) ?? []).sort(byName),
      })),
      unassigned: unassigned.sort(byName),
    };
  }

  // ─── Movimento (decisão 7) ───────────────────────────────────────────────────

  async move(user: DailyUser, sessionId: string, dto: MoveDailyPersonDto): Promise<MoveDailyPersonResult> {
    await this.findSessionForUser(user, sessionId);
    const toMinistryId = dto.toMinistryId ?? null;
    const version = await this.dataSource.transaction(async (m) => {
      const session = await this.repo.lockSession(m, sessionId);
      if (!session || session.status !== DailySessionStatus.OPEN) {
        throw new ConflictException(DAILY_CLOSED_MESSAGE);
      }
      if (toMinistryId && !(await this.repo.isHouseMinistry(m, toMinistryId, session.houseId))) {
        throw new BadRequestException(DAILY_INVALID_MINISTRY_MESSAGE);
      }
      const onBoard = await this.repo.setAssignment(
        m, sessionId, dto.personType, dto.personId, toMinistryId, user.userId,
      );
      if (!onBoard) throw new BadRequestException(DAILY_PERSON_NOT_ON_BOARD_MESSAGE);
      return this.repo.bumpVersion(m, sessionId);
    });

    const event: DailyMovedEvent = {
      sessionId,
      personType: dto.personType,
      personId: dto.personId,
      toMinistryId,
      version,
      movedByUserId: user.userId,
    };
    this.events.emit(DAILY_MOVED_EVENT, event);
    return { version };
  }

  // ─── Aplicar (decisão 8) ─────────────────────────────────────────────────────

  async apply(user: DailyUser, sessionId: string): Promise<ApplyDailyResult> {
    await this.findSessionForUser(user, sessionId);
    const outcome = await this.dataSource.transaction(async (m) => {
      const session = await this.repo.lockSession(m, sessionId);
      if (!session || session.status !== DailySessionStatus.OPEN) {
        throw new ConflictException(DAILY_CLOSED_MESSAGE);
      }
      const state = await this.loadState(m, session);
      const eligible = new Set(state.people.map((p) => keyOf(p.type, p.id)));
      const validMinistries = new Set(state.ministries.map((mi) => mi.id));
      const skipped: ApplyDailySkipped[] = [];
      let applied = 0;

      for (const a of state.assignments) {
        if (!eligible.has(keyOf(a.personType, a.personId))) {
          skipped.push({ personType: a.personType, personId: a.personId, reason: skipReason(a.personType) });
          continue;
        }
        const target = a.ministryId && validMinistries.has(a.ministryId) ? a.ministryId : null;
        const changed =
          a.personType === DailyPersonType.RESIDENT
            ? await this.ministries.setResidentMinistry(m, a.personId, target)
            : await this.ministries.setStaffMinistry(m, a.personId, target);
        if (changed) applied += 1;
      }

      session.status = DailySessionStatus.APPLIED;
      session.appliedAt = new Date();
      session.appliedByUserId = user.userId;
      await this.repo.saveSession(m, session);
      const appliedByName = await this.repo.userName(m, user.userId);
      return { result: { applied, skipped }, appliedAt: session.appliedAt, appliedByName };
    });

    const event: DailyAppliedEvent = {
      sessionId,
      appliedAt: outcome.appliedAt.toISOString(),
      appliedByUserId: user.userId,
      appliedByName: outcome.appliedByName,
      result: outcome.result,
    };
    this.events.emit(DAILY_APPLIED_EVENT, event);
    return outcome.result;
  }

  // ─── Infra ───────────────────────────────────────────────────────────────────

  private emitReset(previousSessionId: string | null, board: DailyBoard): void {
    if (!previousSessionId) return;
    const event: DailyResetEvent = {
      previousSessionId,
      sessionId: board.session.id,
      houseId: board.session.houseId,
    };
    this.events.emit(DAILY_RESET_EVENT, event);
  }

  /**
   * Duas aberturas simultâneas da mesma casa: a segunda bate no índice único
   * parcial (uma OPEN por casa). Repete uma vez — agora encontra a sessão criada.
   */
  private async withUniqueRetry<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const e = error as { code?: string; driverError?: { code?: string } };
      if (e?.code === '23505' || e?.driverError?.code === '23505') return work();
      throw error;
    }
  }
}

function skipReason(type: DailyPersonType): string {
  return type === DailyPersonType.RESIDENT
    ? DAILY_SKIP_REASONS.RESIDENT_NOT_ELIGIBLE
    : DAILY_SKIP_REASONS.STAFF_NOT_ACTIVE;
}

/** Linha → pessoa do board. Badge: `rank`; sem rank, o label do papel (decisão 6). */
export function toPerson(row: DailyPersonRow): DailyPerson {
  const base: DailyPerson = {
    type: row.type,
    id: row.id,
    name: row.name,
    photoThumbUrl: row.photoThumbUrl ?? null,
    currentMinistryIds: row.ministryIds,
  };
  if (row.type !== DailyPersonType.STAFF) return base;
  return {
    ...base,
    rank: row.rank ?? null,
    roleLabel: row.rank ? null : (DAILY_STAFF_ROLE_LABELS[row.role ?? ''] ?? DAILY_STAFF_ROLE_LABELS.SERVANT),
    hadMultipleMinistries: row.ministryIds.length > 1,
  };
}
