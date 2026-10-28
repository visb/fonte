import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  DailyPersonType,
  DailySessionStatus,
  REMOVABLE_RESIDENT_STATUSES,
  ServantRank,
} from '@fonte/types';
import { DailySession } from './daily-session.entity';
import { DailySessionAssignment } from './daily-session-assignment.entity';
import { activeStaffSql } from '../staff/active-staff';

/** Pessoa elegível ao board, com os vínculos REAIS de agora. */
export interface DailyPersonRow {
  type: DailyPersonType;
  id: string;
  name: string;
  photoThumbUrl: string | null;
  rank: ServantRank | null;
  role: string | null;
  /** Ministérios reais (não excluídos, da casa); servo em ordem de vínculo (mais antigo 1º). */
  ministryIds: string[];
}

export interface DailyMinistryRow {
  id: string;
  name: string;
}

/**
 * Story 225 — camada de persistência do módulo Daily. Toda SQL do módulo mora
 * aqui; o service só orquestra regra. Métodos de escrita recebem o
 * `EntityManager` da transação do chamador.
 */
@Injectable()
export class DailyRepository {
  constructor(
    @InjectRepository(DailySession)
    private readonly sessions: Repository<DailySession>,
  ) {}

  findSession(id: string): Promise<DailySession | null> {
    return this.sessions.findOne({ where: { id } });
  }

  /** Sessão OPEN da casa, com a linha travada (serializa abertura/sync). */
  lockOpenSession(m: EntityManager, houseId: string): Promise<DailySession | null> {
    return m.getRepository(DailySession).findOne({
      where: { houseId, status: DailySessionStatus.OPEN },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Sessão (qualquer status) travada para escrita. */
  lockSession(m: EntityManager, id: string): Promise<DailySession | null> {
    return m.getRepository(DailySession).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Última sessão APLICADA da casa no dia. */
  findAppliedOn(m: EntityManager, houseId: string, sessionDate: string): Promise<DailySession | null> {
    return m.getRepository(DailySession).findOne({
      where: { houseId, sessionDate, status: DailySessionStatus.APPLIED },
      order: { appliedAt: 'DESC' },
    });
  }

  createSession(m: EntityManager, data: Partial<DailySession>): Promise<DailySession> {
    const repo = m.getRepository(DailySession);
    return repo.save(repo.create(data));
  }

  saveSession(m: EntityManager, session: DailySession): Promise<DailySession> {
    return m.getRepository(DailySession).save(session);
  }

  /** `version = version + 1`, devolve o valor novo. */
  async bumpVersion(m: EntityManager, sessionId: string): Promise<number> {
    const rows = await m.query<Array<{ version: number }>>(
      `UPDATE daily_sessions SET version = version + 1, updated_at = now() WHERE id = $1 RETURNING version`,
      [sessionId],
    );
    // `UPDATE ... RETURNING` no driver pg volta como [rows, count].
    const list = (Array.isArray(rows[0]) ? rows[0] : rows) as Array<{ version: number }>;
    return Number(list[0].version);
  }

  listAssignments(m: EntityManager, sessionId: string): Promise<DailySessionAssignment[]> {
    return m.getRepository(DailySessionAssignment).find({ where: { sessionId } });
  }

  async insertAssignments(m: EntityManager, rows: Array<Partial<DailySessionAssignment>>): Promise<void> {
    if (rows.length === 0) return;
    const repo = m.getRepository(DailySessionAssignment);
    await repo.save(rows.map((row) => repo.create(row)));
  }

  async deleteAssignments(m: EntityManager, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await m.getRepository(DailySessionAssignment).delete({ id: In(ids) });
  }

  async clearAssignmentMinistry(m: EntityManager, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await m.getRepository(DailySessionAssignment).update({ id: In(ids) }, { ministryId: null });
  }

  /** Grava o destino da pessoa. Devolve `false` se a pessoa não está no board. */
  async setAssignment(
    m: EntityManager,
    sessionId: string,
    personType: DailyPersonType,
    personId: string,
    ministryId: string | null,
    userId: string,
  ): Promise<boolean> {
    const result = await m
      .getRepository(DailySessionAssignment)
      .update({ sessionId, personType, personId }, { ministryId, updatedByUserId: userId });
    return (result.affected ?? 0) > 0;
  }

  /** Ministérios vivos da casa, por nome. */
  listMinistries(m: EntityManager, houseId: string): Promise<DailyMinistryRow[]> {
    return m.query<DailyMinistryRow[]>(
      `SELECT id, name FROM ministries WHERE house_id = $1 AND deleted_at IS NULL ORDER BY name`,
      [houseId],
    );
  }

  /** Ministério destino: precisa ser da casa e não excluído. */
  async isHouseMinistry(m: EntityManager, ministryId: string, houseId: string): Promise<boolean> {
    const rows = await m.query<Array<{ id: string }>>(
      `SELECT id FROM ministries WHERE id = $1 AND house_id = $2 AND deleted_at IS NULL`,
      [ministryId, houseId],
    );
    return rows.length > 0;
  }

  /**
   * Quem entra no board (decisão 5): filhos elegíveis da casa
   * (`isMinistryEligibleResident` — mesma casa + status removível) e staff
   * ATIVO da casa, de qualquer role.
   */
  async listEligiblePeople(m: EntityManager, houseId: string): Promise<DailyPersonRow[]> {
    // Sequencial: na transação é uma conexão só.
    const residents = await m.query<Array<Omit<DailyPersonRow, 'type' | 'rank' | 'role'>>>(
        `SELECT r.id, r.name,
                COALESCE(r.photo_thumb_url, r.photo_url) AS "photoThumbUrl",
                ARRAY_REMOVE(ARRAY[mi.id::text], NULL) AS "ministryIds"
           FROM residents r
           LEFT JOIN ministries mi ON mi.id = r.ministry_id
                                  AND mi.house_id = r.house_id
                                  AND mi.deleted_at IS NULL
          WHERE r.house_id = $1
            AND r.status::text = ANY($2::text[])
            AND r.deleted_at IS NULL`,
        [houseId, [...REMOVABLE_RESIDENT_STATUSES]],
      );
    const staff = await m.query<Array<Omit<DailyPersonRow, 'type'>>>(
        `SELECT s.id, s.name, s.photo_url AS "photoThumbUrl", s.rank, u.role,
                COALESCE(
                  ARRAY_AGG(mi.id::text ORDER BY ms.created_at ASC, mi.id) FILTER (WHERE mi.id IS NOT NULL),
                  ARRAY[]::text[]
                ) AS "ministryIds"
           FROM staff s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN ministry_staff ms ON ms.staff_id = s.id
           LEFT JOIN ministries mi ON mi.id = ms.ministry_id
                                  AND mi.house_id = s.house_id
                                  AND mi.deleted_at IS NULL
          WHERE s.house_id = $1 AND ${activeStaffSql('s')}
          GROUP BY s.id, s.name, s.photo_url, s.rank, u.role`,
        [houseId],
      );
    return [
      ...residents.map((r) => ({
        ...r,
        type: DailyPersonType.RESIDENT,
        rank: null,
        role: null,
        ministryIds: r.ministryIds ?? [],
      })),
      ...staff.map((s) => ({
        ...s,
        type: DailyPersonType.STAFF,
        rank: s.rank ?? null,
        role: s.role ?? null,
        ministryIds: s.ministryIds ?? [],
      })),
    ];
  }

  /** Nome de quem aplicou (staff do usuário). */
  async userName(m: EntityManager, userId: string | null): Promise<string | null> {
    if (!userId) return null;
    const rows = await m.query<Array<{ name: string }>>(
      `SELECT name FROM staff WHERE user_id = $1 ORDER BY deleted_at NULLS FIRST LIMIT 1`,
      [userId],
    );
    return rows[0]?.name ?? null;
  }

  /** Casa do staff do usuário (JWT não carrega houseId). */
  async staffHouseId(userId: string): Promise<string | null> {
    const rows = await this.sessions.manager.query<Array<{ house_id: string | null }>>(
      `SELECT house_id FROM staff WHERE user_id = $1 AND ${activeStaffSql('staff')} LIMIT 1`,
      [userId],
    );
    return rows[0]?.house_id ?? null;
  }

  async houseExists(houseId: string): Promise<boolean> {
    const rows = await this.sessions.manager.query<Array<{ id: string }>>(
      `SELECT id FROM houses WHERE id = $1 AND deleted_at IS NULL`,
      [houseId],
    );
    return rows.length > 0;
  }
}
