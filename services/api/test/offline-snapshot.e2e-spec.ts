import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

const today = () => new Date().toISOString().split('T')[0];
// E-mail é único no banco e a suíte roda contra um banco que persiste entre
// execuções: sufixo por run evita 409 ao repetir o e2e sem reseed.
const run = Date.now().toString(36);
const snapshotUrl = (houseId: string, since?: string) =>
  `${BASE}/houses/${houseId}/offline-snapshot${since ? `?since=${encodeURIComponent(since)}` : ''}`;

// Casa própria da suíte: o pacote offline despeja a casa inteira, então testar
// contra a "Casa Teste" compartilhada tornaria as asserções reféns do que as
// outras suítes criam por lá.
describe('Offline snapshot da casa (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let seededCoordToken: string;
  let servantToken: string;
  let coordToken: string;
  let houseId: string;
  let residentId: string;
  let attachmentId: string;

  /** Cria staff + acesso e devolve o token já com a senha definitiva. */
  async function createStaffToken(payload: Record<string, unknown>): Promise<string> {
    await request(app.getHttpServer())
      .post(`${BASE}/staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'temp12345', ...payload })
      .expect(201);

    const firstToken = await login(app, payload.email as string, 'temp12345');
    const res = await request(app.getHttpServer())
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ newPassword: 'snap12345' })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: seededCoordToken } = await loginCoordinator(app));

    const house = await request(app.getHttpServer())
      .post(`${BASE}/houses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Casa Snapshot 177', generalCapacity: 10, staffCapacity: 5 })
      .expect(201);
    houseId = house.body.id;

    const resident = await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Filho Snapshot',
        houseId,
        status: 'ACTIVE',
        entryDate: today(),
        cpf: '12345678900',
        rg: 'MG1234567',
        familyInvestment: 'BASKET_500',
      })
      .expect(201);
    residentId = resident.body.id;

    // Filho fora de PRESENT_RESIDENT_STATUSES: não pode aparecer no pacote.
    await request(app.getHttpServer())
      .post(`${BASE}/residents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Filho Evadido', houseId, status: 'EVADED', entryDate: today() })
      .expect(201);

    // Detalhe para os blocos: timeline, consentimento e anexo.
    await request(app.getHttpServer())
      .post(`${BASE}/residents/${residentId}/follow-ups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: today(), type: 'NOTE', description: 'Nota do snapshot', accessLevel: 'ALL' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${BASE}/consents`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectType: 'RESIDENT', subjectId: residentId, purpose: 'IMAGE_PUBLICATION', termVersion: '1.0' })
      .expect(201);

    const attachment = await request(app.getHttpServer())
      .post(`${BASE}/residents/${residentId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'ficha.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    attachmentId = attachment.body.id;

    await request(app.getHttpServer())
      .post(`${BASE}/houses/${houseId}/ministries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Lavanderia' })
      .expect(201);

    servantToken = await createStaffToken({
      name: 'Servo Snapshot',
      email: `servo.snapshot.${run}@fonte.com`,
      role: 'SERVANT',
      houseId,
    });
    coordToken = await createStaffToken({
      name: 'Coord Snapshot',
      email: `coord.snapshot.${run}@fonte.com`,
      role: 'COORDINATOR',
      houseId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('autorização', () => {
    it('sem token → 401', () =>
      request(app.getHttpServer()).get(snapshotUrl(houseId)).expect(401));

    it('servo da própria casa → 200 com o pacote', async () => {
      const res = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(200);
      expect(res.body.full).toBe(true);
      expect(typeof res.body.syncedAt).toBe('string');
    });

    it('coordenador da própria casa → 200 com o pacote', async () => {
      const res = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body.residents).toHaveLength(1);
    });

    it('staff de OUTRA casa → 403', () =>
      request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${seededCoordToken}`)
        .expect(403));

    it('servo de grupo de apoio (sem casa) → 403', async () => {
      const groups = await request(app.getHttpServer())
        .get(`${BASE}/support-groups`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const token = await createStaffToken({
        name: 'Servo Grupo Snapshot',
        email: `servo.grupo.snapshot.${run}@fonte.com`,
        role: 'SERVANT',
        supportGroupId: groups.body[0].id,
      });

      await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('RELATIVE → 403', async () => {
      const token = await login(app, 'familiar@fonte.com', 'familiar123');
      await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('RESIDENT → 403', async () => {
      const token = await login(app, 'resident@teste.com', 'resident123');
      await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('ADMIN passa em qualquer casa', () =>
      request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200));
  });

  describe('validação de entrada', () => {
    it('houseId que não é UUID → 400', () =>
      request(app.getHttpServer())
        .get(snapshotUrl('nao-e-uuid'))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));

    it('since malformado → 400', () =>
      request(app.getHttpServer())
        .get(snapshotUrl(houseId, 'ontem'))
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));

    it('parâmetro desconhecido na query → 400', () =>
      request(app.getHttpServer())
        .get(`${BASE}/houses/${houseId}/offline-snapshot?ate=hoje`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400));
  });

  describe('conteúdo do pacote', () => {
    it('agrega os cinco blocos e os ministérios da casa', async () => {
      const res = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      // Só o filho presente: o EVADED da mesma casa fica de fora.
      expect(res.body.residents.map((r: { name: string }) => r.name)).toEqual(['Filho Snapshot']);
      expect(res.body.followUps[residentId].length).toBeGreaterThan(0);
      expect(res.body.consents[residentId][0].purpose).toBe('IMAGE_PUBLICATION');
      expect(res.body.receivables[residentId].length).toBeGreaterThan(0);
      expect(res.body.attachments[residentId].map((a: { id: string }) => a.id)).toEqual([
        attachmentId,
      ]);
      expect(res.body.ministries.map((m: { name: string }) => m.name)).toEqual(['Lavanderia']);
      expect(res.body.deleted).toEqual({ residents: [], followUps: [], receivables: [] });
    });

    it('CPF e RG saem MASCARADOS — o caminho novo passa pelos interceptors globais', async () => {
      for (const token of [coordToken, adminToken, servantToken]) {
        const res = await request(app.getHttpServer())
          .get(snapshotUrl(houseId))
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        const filho = res.body.residents[0];
        expect(filho.cpf).toBe('***.***.789-00');
        expect(filho.rg).toBe('***67');
        expect(JSON.stringify(res.body)).not.toContain('12345678900');
        expect(JSON.stringify(res.body)).not.toContain('MG1234567');
      }
    });

    it('a URL do anexo é a mesma que a rota individual devolve (mesmo pipeline)', async () => {
      const [snapshot, individual] = await Promise.all([
        request(app.getHttpServer())
          .get(snapshotUrl(houseId))
          .set('Authorization', `Bearer ${coordToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get(`${BASE}/residents/${residentId}/attachments`)
          .set('Authorization', `Bearer ${coordToken}`)
          .expect(200),
      ]);

      expect(snapshot.body.attachments[residentId][0].fileUrl).toBe(individual.body[0].fileUrl);
    });

    it('o servo não recebe o carnê (paridade com GET /residents/:id/receivables)', async () => {
      const res = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(200);
      expect(res.body.receivables).toEqual({});

      await request(app.getHttpServer())
        .get(`${BASE}/residents/${residentId}/receivables`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403);
    });
  });

  describe('delta', () => {
    // `syncedAt` volta 1s no relógio de propósito (decisão 7: não perder escrita
    // concorrente com a leitura). A suíte monta tudo em milissegundos, então sem
    // esperar essa folga o "nada mudou" incluiria o próprio setup.
    beforeAll(() => new Promise((resolve) => setTimeout(resolve, 1500)));

    it('since recente devolve payload menor que o full do mesmo estado', async () => {
      const full = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      const delta = await request(app.getHttpServer())
        .get(snapshotUrl(houseId, full.body.syncedAt))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(delta.body.full).toBe(false);
      // Nada mudou entre as duas leituras: o filho intocado não volta a descer.
      expect(delta.body.residents).toEqual([]);
      expect(delta.body.followUps).toEqual({});
      expect(JSON.stringify(delta.body).length).toBeLessThan(JSON.stringify(full.body).length);
    });

    it('since mais velho que 30 dias volta como sincronização completa', async () => {
      const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .get(snapshotUrl(houseId, old))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(res.body.full).toBe(true);
      expect(res.body.residents).toHaveLength(1);
    });

    it('evento novo desce no delta mesmo com o filho intocado', async () => {
      const marker = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`${BASE}/residents/${residentId}/follow-ups`)
        .set('Authorization', `Bearer ${coordToken}`)
        .send({ date: today(), type: 'NOTE', description: 'Evento pós-sync', accessLevel: 'ALL' })
        .expect(201);

      const delta = await request(app.getHttpServer())
        .get(snapshotUrl(houseId, marker.body.syncedAt))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      // A linha do filho não mudou — o evento desce assim mesmo.
      expect(delta.body.residents).toEqual([]);
      expect(delta.body.followUps[residentId]).toHaveLength(1);
      expect(delta.body.followUps[residentId][0].description).toBe('Evento pós-sync');
    });

    it('filho que sai dos status presentes entra em deleted.residents', async () => {
      const marker = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${BASE}/residents/${residentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISCHARGED', exitDate: today() })
        .expect(200);

      const delta = await request(app.getHttpServer())
        .get(snapshotUrl(houseId, marker.body.syncedAt))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);

      expect(delta.body.deleted.residents).toContain(residentId);
      expect(delta.body.residents).toEqual([]);

      // E some do full: o aparelho não guarda ficha de quem saiu da casa.
      const full = await request(app.getHttpServer())
        .get(snapshotUrl(houseId))
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(full.body.residents).toEqual([]);
    });
  });
});
