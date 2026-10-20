import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { RESIDENT_CPF_IN_USE_CODE } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';
import { maskCpf, randomCpf } from './helpers/cpf';
import { UniqueResidentCpf1783038400000 } from '../src/database/migrations/1783038400000-UniqueResidentCpf';

/**
 * Story 219 — CPF do filho único (cadastro/edição) e a migration de dedup.
 *
 * Fixtures próprias criadas pela API e excluídas (soft delete) por id no
 * `afterAll`. O ensaio da migration roda numa transação que sempre volta
 * (`ROLLBACK`): nada do que ele grava sobrevive ao teste.
 */
describe('CPF do filho único (story 219, e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let houseId: string;
  const createdIds: string[] = [];
  const http = () => request(app.getHttpServer());

  async function createResident(payload: Record<string, unknown>, expected = 201) {
    const res = await http()
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ houseId, ...payload })
      .expect(expected);
    if (expected === 201) createdIds.push(res.body.id);
    return res;
  }

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await http().delete(`${BASE}/residents/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('POST duas vezes com o mesmo CPF (formatos diferentes) → 201 e 409 com o dono', async () => {
    const cpf = randomCpf();
    const name = `CPF Único ${Date.now()}`;
    const first = await createResident({ name, cpf: maskCpf(cpf) });

    const detail = await http()
      .get(`${BASE}/residents/${first.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.cpf).toBe(cpf);

    const dup = await createResident({ name: `Outro ${Date.now()}`, cpf }, 409);
    expect(dup.body).toMatchObject({
      statusCode: 409,
      code: RESIDENT_CPF_IN_USE_CODE,
      conflictResidentId: first.body.id,
    });
    expect(dup.body.message).toBe(`Já existe um filho com este CPF: ${name} (Pré-admissão).`);
  });

  it('POST com CPF de DV inválido → 400 "CPF inválido."', async () => {
    const res = await createResident({ name: `DV ${Date.now()}`, cpf: '123.456.789-00' }, 400);
    expect(JSON.stringify(res.body.message)).toContain('CPF inválido.');
  });

  it('CPF de filho excluído (soft delete) fica livre', async () => {
    const cpf = randomCpf();
    const gone = await createResident({ name: `Excluído ${Date.now()}`, cpf });
    await http()
      .delete(`${BASE}/residents/${gone.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect((res) => expect([200, 204]).toContain(res.status));
    await createResident({ name: `Herdeiro ${Date.now()}`, cpf });
  });

  describe('PATCH /residents/:id', () => {
    let ownerId: string;
    let ownerCpf: string;
    let targetId: string;

    beforeAll(async () => {
      ownerCpf = randomCpf();
      ownerId = (await createResident({ name: `Dono ${Date.now()}`, cpf: ownerCpf })).body.id;
      targetId = (await createResident({ name: `Alvo ${Date.now()}` })).body.id;
    });

    it('mudar para o CPF de outro filho → 409 com conflictResidentId', async () => {
      const res = await http()
        .patch(`${BASE}/residents/${targetId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ cpf: maskCpf(ownerCpf) })
        .expect(409);
      expect(res.body.conflictResidentId).toBe(ownerId);
    });

    it('mudar para CPF inválido → 400', () =>
      http()
        .patch(`${BASE}/residents/${targetId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ cpf: '111.111.111-11' })
        .expect(400));

    it('reenviar o próprio CPF (formulário inteiro) → 200', () =>
      http()
        .patch(`${BASE}/residents/${ownerId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: `Dono Editado ${Date.now()}`, cpf: maskCpf(ownerCpf) })
        .expect(200));

    it('ficha legada com CPF inválido continua salvável editando outro campo', async () => {
      // Valor legado gravado direto (o cadastro novo não aceita mais).
      await dataSource.query(`UPDATE residents SET cpf = '12345' WHERE id = $1`, [targetId]);
      await http()
        .patch(`${BASE}/residents/${targetId}`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name: `Alvo Editado ${Date.now()}`, cpf: '12345' })
        .expect(200);
    });
  });

  describe('migration UniqueResidentCpf (ensaio em transação desfeita)', () => {
    it('normaliza, deduplica com log e o down restaura', async () => {
      const migration = new UniqueResidentCpf1783038400000();
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        // Volta ao estado pré-migration (sem índice) para semear duplicados.
        await migration.down(runner);

        const [cpfA, cpfB, cpfC] = [randomCpf(), randomCpf(), randomCpf()];
        const ids = {
          activeOld: randomUUID(),
          archivedNew: randomUUID(),
          dischargedOld: randomUUID(),
          dischargedNew: randomUUID(),
          masked: randomUUID(),
          deleted: randomUUID(),
        };
        const insert = (id: string, status: string, cpf: string, updatedAt: string, deletedAt: string | null = null) =>
          runner.query(
            `INSERT INTO residents (id, name, status, house_id, cpf, updated_at, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, `Migração 219 ${id.slice(0, 8)}`, status, houseId, cpf, updatedAt, deletedAt],
          );
        // Grupo A: ativo (mais antigo) × arquivado (mais novo), formatos diferentes.
        await insert(ids.activeOld, 'ACTIVE', maskCpf(cpfA), '2020-01-01');
        await insert(ids.archivedNew, 'DISCHARGED', cpfA, '2025-01-01');
        // Grupo B: empate de status terminal → fica o de updated_at mais recente.
        await insert(ids.dischargedOld, 'EVADED', cpfB, '2021-01-01');
        await insert(ids.dischargedNew, 'DISCHARGED', maskCpf(cpfB), '2024-06-01');
        // Sozinho e mascarado → só normaliza.
        await insert(ids.masked, 'ACTIVE', maskCpf(cpfC), '2022-01-01');
        // Soft-deletado com o CPF do grupo A → não conta, não é tocado.
        await insert(ids.deleted, 'ACTIVE', maskCpf(cpfA), '2026-01-01', '2026-02-01');

        await migration.up(runner);

        const cpfOf = async (id: string) =>
          ((await runner.query(`SELECT cpf FROM residents WHERE id = $1`, [id])) as Array<{ cpf: string | null }>)[0]
            .cpf;
        expect(await cpfOf(ids.activeOld)).toBe(cpfA);
        expect(await cpfOf(ids.archivedNew)).toBeNull();
        expect(await cpfOf(ids.dischargedNew)).toBe(cpfB);
        expect(await cpfOf(ids.dischargedOld)).toBeNull();
        expect(await cpfOf(ids.masked)).toBe(cpfC);
        expect(await cpfOf(ids.deleted)).toBe(cpfA);

        const log = (await runner.query(
          `SELECT resident_id, old_cpf, kept_resident_id FROM resident_cpf_dedup_log
            WHERE resident_id = ANY($1) ORDER BY old_cpf`,
          [Object.values(ids)],
        )) as Array<{ resident_id: string; old_cpf: string; kept_resident_id: string }>;
        expect(log).toEqual(
          expect.arrayContaining([
            { resident_id: ids.archivedNew, old_cpf: cpfA, kept_resident_id: ids.activeOld },
            { resident_id: ids.dischargedOld, old_cpf: cpfB, kept_resident_id: ids.dischargedNew },
          ]),
        );
        expect(log).toHaveLength(2);

        const index = await runner.query(
          `SELECT indexdef FROM pg_indexes WHERE indexname = 'UX_residents_cpf_active'`,
        );
        expect(index[0].indexdef).toContain('WHERE ((cpf IS NOT NULL) AND (deleted_at IS NULL))');

        await migration.down(runner);
        expect(await cpfOf(ids.archivedNew)).toBe(cpfA);
        expect(await cpfOf(ids.dischargedOld)).toBe(cpfB);
        const gone = await runner.query(`SELECT to_regclass('public.resident_cpf_dedup_log') AS t`);
        expect(gone[0].t).toBeNull();
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }

      const restored = await dataSource.query(
        `SELECT 1 FROM pg_indexes WHERE indexname = 'UX_residents_cpf_active'`,
      );
      expect(restored).toHaveLength(1);
    });
  });
});
