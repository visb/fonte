import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as path from 'path';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

const FIXTURE = path.join(__dirname, 'fixtures/import-residents.xlsx');
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
