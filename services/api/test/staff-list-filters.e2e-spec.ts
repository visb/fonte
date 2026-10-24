import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { Role } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

/**
 * Story 223 — `GET /staff?search=&houseId=`. Fixtures próprias (duas casas e
 * três servos com nome/CPF únicos por execução), criadas via API e removidas
 * por id no `afterAll` (story 182). O seed é só leitura.
 */
describe('Busca e filtro de casa na lista de servos (e2e, story 223)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let coordHouseId: string;
  const houseIds: string[] = [];
  const staffIds: string[] = [];
  const userIds: string[] = [];

  const tag = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const cpfDigits = `9${tag}`.slice(0, 11).padEnd(11, '7');
  const formattedCpf = `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`;
  const server = () => app.getHttpServer();
  const as = (token: string, req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  const list = async (token: string, query: Record<string, string>) => {
    const res = await as(token, request(server()).get(`${BASE}/staff`).query(query)).expect(200);
    return res.body as Array<{ id: string; houseId: string | null; name: string }>;
  };
  const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();

  async function createHouse(name: string): Promise<string> {
    const res = await as(adminToken, request(server()).post(`${BASE}/houses`)).send({ name });
    expect(res.status).toBe(201);
    houseIds.push(res.body.id);
    return res.body.id;
  }

  async function createStaff(name: string, houseId: string, cpf?: string): Promise<string> {
    const res = await as(adminToken, request(server()).post(`${BASE}/staff`)).send({
      name,
      email: `busca-${tag}-${staffIds.length}@fonte.test`,
      password: 'senha123',
      role: Role.SERVANT,
      houseId,
      ...(cpf ? { cpf } : {}),
    });
    expect(res.status).toBe(201);
    staffIds.push(res.body.id);
    userIds.push(res.body.userId);
    return res.body.id;
  }

  let houseA: string;
  let houseB: string;
  let zeliaId: string;
  let joaoId: string;
  let otherId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    dataSource = app.get(DataSource);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId: coordHouseId } = await loginCoordinator(app));

    houseA = await createHouse(`Casa Busca A ${tag}`);
    houseB = await createHouse(`Casa Busca B ${tag}`);
    zeliaId = await createStaff(`Zélia Buscável ${tag}`, houseA, formattedCpf);
    joaoId = await createStaff(`João Buscável ${tag}`, houseB);
    otherId = await createStaff(`Outro Servo ${tag}`, houseA);
  });

  afterAll(async () => {
    if (staffIds.length) {
      await dataSource.query('DELETE FROM staff_service_periods WHERE staff_id = ANY($1)', [staffIds]);
      await dataSource.query('DELETE FROM staff WHERE id = ANY($1)', [staffIds]);
    }
    if (userIds.length) await dataSource.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    for (const id of houseIds) {
      await as(adminToken, request(server()).delete(`${BASE}/houses/${id}`));
    }
    await app.close();
  });

  it('ADMIN: busca por parte do nome, sem acento e sem caixa', async () => {
    expect(ids(await list(adminToken, { search: `buscavel ${tag}` }))).toEqual([zeliaId, joaoId].sort());
    expect(ids(await list(adminToken, { search: `ZELIA BUSCAVEL ${tag}` }))).toEqual([zeliaId]);
    expect(await list(adminToken, { search: `inexistente-${tag}` })).toEqual([]);
  });

  it('ADMIN: busca por dígitos casa o CPF formatado', async () => {
    expect(ids(await list(adminToken, { search: cpfDigits }))).toEqual([zeliaId]);
    expect(ids(await list(adminToken, { search: formattedCpf }))).toEqual([zeliaId]);
  });

  it('ADMIN: houseId filtra pela casa; combinado com busca', async () => {
    expect(ids(await list(adminToken, { houseId: houseA }))).toEqual([zeliaId, otherId].sort());
    expect(ids(await list(adminToken, { houseId: houseB }))).toEqual([joaoId]);
    expect(ids(await list(adminToken, { houseId: houseA, search: `buscavel ${tag}` }))).toEqual([zeliaId]);
    expect(await list(adminToken, { houseId: houseA, search: `buscavel ${tag}`, status: 'dismissed' })).toEqual([]);
  });

  it('COORDINATOR com houseId alheio: continua só na própria casa', async () => {
    const rows = await list(coordToken, { houseId: houseA });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.houseId === coordHouseId)).toBe(true);
    expect(await list(coordToken, { houseId: houseA, search: tag })).toEqual([]);
  });

  it('validação: houseId não-UUID e search > 100 → 400', async () => {
    await as(adminToken, request(server()).get(`${BASE}/staff`).query({ houseId: 'abc' })).expect(400);
    await as(adminToken, request(server()).get(`${BASE}/staff`).query({ search: 'a'.repeat(101) })).expect(400);
  });
});
