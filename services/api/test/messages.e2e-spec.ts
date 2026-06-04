import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MessageStatus } from '@fonte/types';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

describe('MessageController (e2e)', () => {
  let app: INestApplication;
  let coordToken: string;
  let operatorToken: string;
  let relativeToken: string;
  let residentId: string;
  let relativeId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    coordToken = await login(app, 'coord@fonte.com', 'coord123');
    // Operator is the seeded staff carrying MODERATE_MESSAGES / SEND_MESSAGES_TO_FAMILIES.
    operatorToken = await login(app, 'operator@fonte.com', 'operator123');
    relativeToken = await login(app, 'familiar@fonte.com', 'familiar123');

    const mine = await request(app.getHttpServer())
      .get(`${BASE}/messages/my-conversations`)
      .set('Authorization', `Bearer ${relativeToken}`)
      .expect(200);
    residentId = mine.body[0].residentId;
    relativeId = mine.body[0].relativeId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('GET /messages/conversations → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/messages/conversations`).expect(401));
  });

  describe('staff view', () => {
    it('lists conversations for the coordinator', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/messages/conversations`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('send + moderation lifecycle', () => {
    let pendingId: string;

    it('rejects an empty message', () =>
      request(app.getHttpServer())
        .post(`${BASE}/messages`)
        .set('Authorization', `Bearer ${relativeToken}`)
        .send({ residentId, relativeId })
        .expect(400));

    it('a relative message starts pending approval', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/messages`)
        .set('Authorization', `Bearer ${relativeToken}`)
        .send({ residentId, relativeId, content: 'Oi, tudo bem?' })
        .expect(201);
      expect(res.body.status).toBe(MessageStatus.PENDING_APPROVAL);
      pendingId = res.body.id;
    });

    it('appears in the moderator pending queue', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/messages/pending`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(res.body.some((m: { id: string }) => m.id === pendingId)).toBe(true);
    });

    it('a staff without moderate permission gets an empty pending queue', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/messages/pending`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('the moderator approves the message', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${BASE}/messages/${pendingId}/approve`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(res.body.status).toBe(MessageStatus.APPROVED);
    });
  });
});
