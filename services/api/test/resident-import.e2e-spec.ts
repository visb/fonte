import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as path from 'path';
import { FamilyInvestment, FollowUpType } from '@fonte/types';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

const FIXTURE = path.join(__dirname, 'fixtures/import-residents.xlsx');
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** CPF fictício de 11 dígitos, único por chamada (dígitos rápidos + sequência). */
let cpfSeq = 0;
function uniqueCpf(): string {
  cpfSeq += 1;
  return `${String(Date.now()).slice(-7)}${String(cpfSeq).padStart(4, '0')}`;
}

describe('Resident import — parse spreadsheet (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    coordToken = await login(app, 'coord@fonte.com', 'coord123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('ADMIN faz upload da planilha → 200 com rows/houses/ignoredSheets', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-spreadsheet`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FIXTURE, { filename: 'import-residents.xlsx', contentType: XLSX_MIME })
      .expect(201);

    expect(res.body.houses).toEqual(['Casa Um', 'Casa Dois']);
    expect(res.body.ignoredSheets).toEqual(['Curso Bíblico']);
    expect(res.body.skipped).toBe(2);
    expect(res.body.rows).toHaveLength(5);
    const joao = res.body.rows.find((r: { name: string }) => r.name === 'João da Silva');
    expect(joao.cpf).toBe('11122233344');
    expect(joao.contributionMonths).toEqual(['2024-01-01', '2024-02-01']);
  });

  it('COORDINATOR também pode fazer o parse → 200', () =>
    request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-spreadsheet`)
      .set('Authorization', `Bearer ${coordToken}`)
      .attach('file', FIXTURE, { filename: 'import-residents.xlsx', contentType: XLSX_MIME })
      .expect(201));

  it('SERVANT sem permissão → 403', () =>
    request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-spreadsheet`)
      .set('Authorization', `Bearer ${servantToken}`)
      .attach('file', Buffer.from('x'), { filename: 'import-residents.xlsx', contentType: XLSX_MIME })
      .expect(403));

  it('arquivo que não é .xlsx → 400', () =>
    request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-spreadsheet`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('não é planilha'), {
        filename: 'lista.csv',
        contentType: 'text/csv',
      })
      .expect(400));

  it('sem autenticação → 401', () =>
    request(app.getHttpServer())
      .post(`${BASE}/residents/import/parse-spreadsheet`)
      .attach('file', Buffer.from('x'), { filename: 'import-residents.xlsx', contentType: XLSX_MIME })
      .expect(401));
});

describe('Resident import — conflito e commit (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let houseId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await request(app.getHttpServer())
        .delete(`${BASE}/residents/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    await app.close();
  });

  describe('GET /residents/import/check-conflict', () => {
    it('reflete um filho existente (por nome sem acento e por CPF)', async () => {
      const cpf = uniqueCpf();
      const name = `José Conflito ${Date.now()}`;
      const created = await request(app.getHttpServer())
        .post(`${BASE}/residents`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ name, houseId, cpf })
        .expect(201);
      createdIds.push(created.body.id);

      // casa por CPF (formatação diferente da salva)
      const byCpf = await request(app.getHttpServer())
        .get(`${BASE}/residents/import/check-conflict`)
        .query({ name: 'Alguém Diferente', cpf })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(byCpf.body.conflicts.some((c: { id: string }) => c.id === created.body.id)).toBe(true);

      // casa por nome normalizado (sem acento/caixa), sem CPF
      const byName = await request(app.getHttpServer())
        .get(`${BASE}/residents/import/check-conflict`)
        .query({ name: name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const hit = byName.body.conflicts.find((c: { id: string }) => c.id === created.body.id);
      expect(hit).toBeDefined();
      expect(hit.houseName).toBeTruthy();
    });

    it('sem conflito → lista vazia', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/residents/import/check-conflict`)
        .query({ name: `Inexistente ${Date.now()}`, cpf: uniqueCpf() })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.conflicts).toEqual([]);
    });

    it('SERVANT sem permissão → 403', () =>
      request(app.getHttpServer())
        .get(`${BASE}/residents/import/check-conflict`)
        .query({ name: 'X' })
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403));
  });

  describe('POST /residents/import/commit', () => {
    it('cria o filho, os familiares e as contribuições retroativas', async () => {
      const cpf = uniqueCpf();
      const payload = {
        resident: {
          name: `Import Commit ${Date.now()}`,
          houseId,
          cpf,
          entryDate: '2023-01-10',
          familyInvestment: FamilyInvestment.PAYMENT_700,
        },
        relatives: [{ name: 'Mãe do Filho', phone: '11988887777', relationship: 'Mãe' }],
        contributionMonths: ['2023-01-01', '2023-02-01', '2023-03-01'],
        photoBase64: null,
      };

      const res = await request(app.getHttpServer())
        .post(`${BASE}/residents/import/commit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.resident.id).toBeDefined();
      expect(res.body.contributionsCreated).toEqual({ created: 3, skipped: 0 });
      createdIds.push(res.body.resident.id);
      const residentId = res.body.resident.id;

      // filho persistido
      const got = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(got.body.name).toBe(payload.resident.name);

      // familiar persistido
      const relatives = await request(app.getHttpServer())
        .get(`${BASE}/relatives`)
        .query({ residentId })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(relatives.body).toHaveLength(1);
      expect(relatives.body[0].name).toBe('Mãe do Filho');

      // contribuições retroativas persistidas
      const followUps = await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/follow-ups`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const contributions = followUps.body.filter(
        (f: { type: string }) => f.type === FollowUpType.MONTHLY_CONTRIBUTION,
      );
      expect(contributions).toHaveLength(3);
    });

    it('segundo commit do mesmo CPF → 409', async () => {
      const cpf = uniqueCpf();
      const payload = {
        resident: { name: `Dup ${Date.now()}`, houseId, cpf, entryDate: '2023-05-01' },
        relatives: [{ name: 'Responsável', phone: '11955554444' }],
        contributionMonths: [],
        photoBase64: null,
      };

      const first = await request(app.getHttpServer())
        .post(`${BASE}/residents/import/commit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload)
        .expect(201);
      createdIds.push(first.body.resident.id);

      await request(app.getHttpServer())
        .post(`${BASE}/residents/import/commit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...payload, resident: { ...payload.resident, name: `Dup2 ${Date.now()}` } })
        .expect(409);
    });

    it('sem relatives → 400 (regra: ≥1 familiar)', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/import/commit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resident: { name: 'Sem Familiar', houseId }, relatives: [], contributionMonths: [] })
        .expect(400));

    it('SERVANT sem permissão → 403', () =>
      request(app.getHttpServer())
        .post(`${BASE}/residents/import/commit`)
        .set('Authorization', `Bearer ${servantToken}`)
        .send({ resident: { name: 'X', houseId }, relatives: [{ name: 'Y' }], contributionMonths: [] })
        .expect(403));
  });
});
