import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';
import { WHATSAPP_CLIENT } from '../src/modules/associate/whatsapp/whatsapp.types';

/**
 * E2E do convite de servos via WhatsApp (story 95). O cliente WhatsApp é
 * MOCKADO via token WHATSAPP_CLIENT — a API da Meta NUNCA é chamada (não há
 * credencial no ambiente; template convite_evento pendente de aprovação).
 */
describe('Event staff invite (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let coordToken: string;
  let servantToken: string;
  let coordStaffId: string;
  let operatorStaffId: string;

  const sendTemplate = jest.fn();

  beforeAll(async () => {
    app = await bootstrapApp({
      overrideProvider: { token: WHATSAPP_CLIENT, useValue: { sendTemplate } },
    });
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken } = await loginCoordinator(app));
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
    dataSource = app.get(DataSource);

    // Servos seedados com whatsapp (story 97) — destinatários do convite.
    const staff = await request(app.getHttpServer())
      .get(`${BASE}/staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    coordStaffId = staff.body.find(
      (s: { name: string }) => s.name === 'Coordenador Teste',
    ).id;
    operatorStaffId = staff.body.find(
      (s: { name: string }) => s.name === 'Operador Teste',
    ).id;
  });

  beforeEach(() => {
    sendTemplate.mockReset();
    sendTemplate.mockResolvedValue({ sent: true, messageId: 'wamid.test' });
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM events');
    await app.close();
  });

  async function createEvent(extra: Record<string, unknown> = {}): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/events`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Encontro dos Servos',
        description: 'Formação interna',
        startAt: '2026-09-01T18:00:00.000Z',
        location: 'Sede',
        audience: 'INTERNAL',
        ...extra,
      })
      .expect(201);
    return res.body.id;
  }

  // ── Auth / authorization ────────────────────────────────────────────────────

  it('401 without token', async () => {
    const id = await createEvent();
    await request(app.getHttpServer())
      .post(`${BASE}/events/${id}/invite-staff`)
      .send({ staffIds: [coordStaffId] })
      .expect(401);
  });

  it('403 for SERVANT (only ADMIN/COORDINATOR invite)', async () => {
    const id = await createEvent();
    await request(app.getHttpServer())
      .post(`${BASE}/events/${id}/invite-staff`)
      .set('Authorization', `Bearer ${servantToken}`)
      .send({ staffIds: [coordStaffId] })
      .expect(403);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it('400 when staffIds is empty or invalid', async () => {
    const id = await createEvent();
    await request(app.getHttpServer())
      .post(`${BASE}/events/${id}/invite-staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffIds: [] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${BASE}/events/${id}/invite-staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffIds: ['not-a-uuid'] })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${BASE}/events/${id}/invite-staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it('404 for a missing event', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/events/00000000-0000-0000-0000-000000000000/invite-staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffIds: [coordStaffId] })
      .expect(404);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  // ── Happy path / summary ────────────────────────────────────────────────────

  it('COORDINATOR invites staff and gets the summary (E.164 + event link)', async () => {
    const id = await createEvent();
    // UUID v4 válido que não corresponde a nenhum servo.
    const ghost = '11111111-1111-4111-8111-111111111111';

    const res = await request(app.getHttpServer())
      .post(`${BASE}/events/${id}/invite-staff`)
      .set('Authorization', `Bearer ${coordToken}`)
      .send({ staffIds: [coordStaffId, operatorStaffId, ghost] })
      .expect(200);

    expect(res.body.sent.sort()).toEqual([coordStaffId, operatorStaffId].sort());
    expect(res.body.skipped).toEqual([{ staffId: ghost, reason: 'NOT_FOUND' }]);

    // Um envio por servo, número normalizado p/ E.164 e link direto de detalhe.
    expect(sendTemplate).toHaveBeenCalledTimes(2);
    const calls = sendTemplate.mock.calls.map(([input]) => input);
    expect(calls.map((c) => c.toE164).sort()).toEqual(['+5511977771000', '+5511977773000']);
    for (const call of calls) {
      expect(call.urlLink).toContain(`/eventos/${id}`);
      expect(call.variables).toEqual([
        'Encontro dos Servos',
        expect.stringContaining('/2026'),
        'Sede',
      ]);
    }
  });

  it('a Meta rejection puts the staff in skipped (best-effort, no abort)', async () => {
    const id = await createEvent({ title: 'Retiro', audience: 'PUBLIC' });
    sendTemplate
      .mockResolvedValueOnce({ sent: false, messageId: null })
      .mockResolvedValueOnce({ sent: true, messageId: 'wamid.ok' });

    const res = await request(app.getHttpServer())
      .post(`${BASE}/events/${id}/invite-staff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ staffIds: [coordStaffId, operatorStaffId] })
      .expect(200);

    expect(res.body.sent).toEqual([operatorStaffId]);
    expect(res.body.skipped).toEqual([{ staffId: coordStaffId, reason: 'SEND_FAILED' }]);
  });
});
