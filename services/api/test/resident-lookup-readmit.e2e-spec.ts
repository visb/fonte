import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { ResidentStatus } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';
import { maskCpf, randomCpf } from './helpers/cpf';

/**
 * Story 218 — busca de candidatos a reacolhimento (`GET /residents/lookup`) e
 * readmissão de ficha ARCHIVED pela contagem do ops.
 *
 * Fixtures próprias criadas pela API e excluídas (soft delete) por id no
 * `afterAll` (story 182). O nome leva um marcador só de letras, aleatório por
 * execução, para a busca por nome não casar com nada além das fixtures.
 */
describe('Lookup e reacolhimento de filho (story 218, e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let houseId: string;
  const createdIds: string[] = [];
  const http = () => request(app.getHttpServer());

  // Só letras: termo com letras é busca por nome (com dígito viraria CPF).
  const marker = Array.from({ length: 10 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');

  async function createResident(name: string, extra: Record<string, unknown> = {}) {
    const res = await http()
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, houseId, status: ResidentStatus.ACTIVE, entryDate: '2025-01-10', ...extra })
      .expect(201);
    createdIds.push(res.body.id);
    return res.body.id as string;
  }

  /** Ficha como a do import em lote: ARCHIVED, sem casa e sem acolhimento. */
  async function archive(id: string) {
    await dataSource.query(
      `UPDATE residents SET status = 'ARCHIVED', house_id = NULL, entry_date = NULL WHERE id = $1`,
      [id],
    );
    await dataSource.query(`UPDATE admissions SET deleted_at = now() WHERE resident_id = $1`, [id]);
  }

  async function discharge(id: string, exitDate: string) {
    await http()
      .patch(`${BASE}/residents/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: ResidentStatus.DISCHARGED, exitDate })
      .expect(200);
  }

  const lookup = (q: string, token = coordToken) =>
    http().get(`${BASE}/residents/lookup`).query({ q }).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await http().delete(`${BASE}/residents/${id}`).set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  it('SERVANT → 403; termo < 3 → 400', async () => {
    await lookup(`${marker}`, servantToken).expect(403);
    await lookup('ab').expect(400);
  });

  it('por nome parcial sem acento/caixa: só fora de acolhimento, sem excluídos, recorte enxuto', async () => {
    const archived = await createResident(`Reacolher João ${marker} Arquivado`, { cpf: randomCpf() });
    await archive(archived);
    const discharged = await createResident(`Reacolher Joao ${marker} Alta`);
    await discharge(discharged, '2025-03-01');
    await createResident(`Reacolher João ${marker} Ativo`);
    const deleted = await createResident(`Reacolher João ${marker} Excluído`);
    await discharge(deleted, '2025-03-01');
    await http()
      .delete(`${BASE}/residents/${deleted}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const res = await lookup(`JOAO ${marker.toUpperCase()}`).expect(200);
    const ids = res.body.map((item: { id: string }) => item.id).sort();
    expect(ids).toEqual([archived, discharged].sort());

    const alta = res.body.find((item: { id: string }) => item.id === discharged);
    const houseName = (
      await dataSource.query('SELECT name FROM houses WHERE id = $1', [houseId])
    )[0].name;
    expect(alta).toEqual({
      id: discharged,
      name: `Reacolher Joao ${marker} Alta`,
      birthDate: null,
      photoUrl: null,
      status: ResidentStatus.DISCHARGED,
      lastHouseName: houseName,
      lastExitDate: '2025-03-01',
    });
    const arq = res.body.find((item: { id: string }) => item.id === archived);
    expect(arq).toMatchObject({ status: ResidentStatus.ARCHIVED, lastHouseName: null });
    // LGPD: nada de CPF, saúde ou familiares no recorte.
    for (const item of res.body) {
      expect(Object.keys(item).sort()).toEqual(
        ['birthDate', 'id', 'lastExitDate', 'lastHouseName', 'name', 'photoUrl', 'status'],
      );
    }
  });

  it('por CPF com e sem máscara (exato)', async () => {
    const cpf = randomCpf();
    const id = await createResident(`Reacolher CPF ${marker}`, { cpf });
    await discharge(id, '2025-02-01');

    for (const term of [cpf, maskCpf(cpf)]) {
      const res = await lookup(term).expect(200);
      expect(res.body.map((item: { id: string }) => item.id)).toEqual([id]);
    }
    // Parcial não casa: CPF é exato.
    const partial = await lookup(cpf.slice(0, 6)).expect(200);
    expect(partial.body).toEqual([]);
  });

  it('limita a 20 candidatos', async () => {
    const limitMarker = `${marker}lim`;
    for (let i = 0; i < 21; i++) {
      const id = await createResident(`Reacolher Lote ${limitMarker} ${String.fromCharCode(97 + i)}`);
      await archive(id);
    }
    const res = await lookup(`lote ${limitMarker}`).expect(200);
    expect(res.body).toHaveLength(20);
  });

  it('COORDINATOR reacolhe ARCHIVED sem casa → ativo na casa da contagem; ACTIVE → 400', async () => {
    const id = await createResident(`Reacolher Contagem ${marker}`);
    await archive(id);

    const found = await lookup(`contagem ${marker}`).expect(200);
    expect(found.body.map((item: { id: string }) => item.id)).toEqual([id]);

    const key = randomUUID();
    const readmit = () =>
      http()
        .post(`${BASE}/residents/${id}/readmit`)
        .set('Authorization', `Bearer ${coordToken}`)
        .set('Idempotency-Key', key)
        .send({ houseId, entryDate: '2025-06-01' });

    const first = await readmit().expect(201);
    expect(first.body).toMatchObject({ id, status: ResidentStatus.ACTIVE, houseId });
    // Reenvio da outbox com a mesma chave devolve a resposta original.
    const replay = await readmit().expect(201);
    expect(replay.body.id).toBe(id);

    const admissions = await dataSource.query(
      `SELECT house_id FROM admissions WHERE resident_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    expect(admissions).toEqual([{ house_id: houseId }]);

    // Aparece na lista da casa (a contagem do ops filtra ACTIVE) e sai da busca.
    const census = await http()
      .get(`${BASE}/houses/${houseId}/residents`)
      .set('Authorization', `Bearer ${coordToken}`)
      .expect(200);
    expect(census.body.some((r: { id: string; status: string }) => r.id === id && r.status === 'ACTIVE')).toBe(true);
    expect((await lookup(`contagem ${marker}`).expect(200)).body).toEqual([]);

    // Já ativo, sem chave de idempotência → 400 continua.
    const again = await http()
      .post(`${BASE}/residents/${id}/readmit`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ houseId, entryDate: '2025-06-01' })
      .expect(400);
    expect(again.body.message).toBe(
      'Apenas filhos com status Alta, Evasão ou Arquivado podem ser reacolhidos.',
    );
  });
});
