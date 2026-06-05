import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { NotificationType, Role } from '@fonte/types';
import { NotificationService } from '../src/modules/notification/notification.service';
import { bootstrapApp, login, loginCoordinator, BASE } from './helpers/e2e-app';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let notifications: NotificationService;
  let adminToken: string;
  let coordToken: string;
  let houseId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    notifications = app.get(NotificationService);
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('GET /notifications → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/notifications`).expect(401));

    it('GET /notifications/unread-count → 401 without token', () =>
      request(app.getHttpServer()).get(`${BASE}/notifications/unread-count`).expect(401));
  });

  describe('targeting', () => {
    it('an ADMIN-targeted notification is visible to ADMIN but not to the ops user', async () => {
      const created = await notifications.create({
        type: NotificationType.PAYMENT_REGISTERED,
        title: `Admin-only ${Date.now()}`,
        recipientRole: Role.ADMIN,
        metadata: { entityId: `admin-${Date.now()}` },
      });

      const adminList = await request(app.getHttpServer())
        .get(`${BASE}/notifications`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(adminList.body.some((n: { id: string }) => n.id === created.id)).toBe(true);

      const coordList = await request(app.getHttpServer())
        .get(`${BASE}/notifications`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(coordList.body.some((n: { id: string }) => n.id === created.id)).toBe(false);
    });

    it('a house-scoped notification is visible to staff of that house', async () => {
      const created = await notifications.create({
        type: NotificationType.INCIDENT_CREATED,
        title: `House ${Date.now()}`,
        houseId,
        metadata: { entityId: `house-${Date.now()}` },
      });

      const coordList = await request(app.getHttpServer())
        .get(`${BASE}/notifications`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(coordList.body.some((n: { id: string }) => n.id === created.id)).toBe(true);
    });

    it('a notification scoped to another house is NOT visible to this house staff', async () => {
      const otherHouseId = '00000000-0000-0000-0000-0000000000ff';
      const created = await notifications.create({
        type: NotificationType.INCIDENT_CREATED,
        title: `Other house ${Date.now()}`,
        houseId: otherHouseId,
        metadata: { entityId: `other-${Date.now()}` },
      });

      const coordList = await request(app.getHttpServer())
        .get(`${BASE}/notifications`)
        .set('Authorization', `Bearer ${coordToken}`)
        .expect(200);
      expect(coordList.body.some((n: { id: string }) => n.id === created.id)).toBe(false);
    });
  });

  describe('read lifecycle', () => {
    it('mark-read removes the item from unread and decrements unread-count', async () => {
      const created = await notifications.create({
        type: NotificationType.RECEIVABLE_OVERDUE,
        title: `Read me ${Date.now()}`,
        recipientRole: Role.ADMIN,
        metadata: { entityId: `read-${Date.now()}` },
      });

      const before = await request(app.getHttpServer())
        .get(`${BASE}/notifications/unread-count`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`${BASE}/notifications/${created.id}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`${BASE}/notifications/unread-count`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(after.body.count).toBe(before.body.count - 1);

      const unreadOnly = await request(app.getHttpServer())
        .get(`${BASE}/notifications`)
        .query({ unreadOnly: 'true' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(unreadOnly.body.some((n: { id: string }) => n.id === created.id)).toBe(false);
    });

    it('mark-all-read zeroes the unread count for the user', async () => {
      await notifications.create({
        type: NotificationType.RECEIVABLE_OVERDUE,
        title: `Bulk ${Date.now()}`,
        recipientRole: Role.ADMIN,
        metadata: { entityId: `bulk-${Date.now()}` },
      });

      await request(app.getHttpServer())
        .patch(`${BASE}/notifications/read-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const after = await request(app.getHttpServer())
        .get(`${BASE}/notifications/unread-count`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(after.body.count).toBe(0);
    });
  });
});
