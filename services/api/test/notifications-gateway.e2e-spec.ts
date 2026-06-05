import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { NotificationType, Role } from '@fonte/types';
import { NotificationService } from '../src/modules/notification/notification.service';
import { bootstrapApp, login, loginCoordinator } from './helpers/e2e-app';

function waitForEvent(socket: Socket, event: string, timeoutMs = 4000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connect(url: string, token?: string): Socket {
  return io(`${url}/notifications`, {
    transports: ['websocket'],
    auth: token ? { token } : {},
    reconnection: false,
    forceNew: true,
  });
}

describe('Notifications gateway (e2e)', () => {
  let app: INestApplication;
  let notifications: NotificationService;
  let url: string;
  let adminToken: string;
  let coordToken: string;
  let houseId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    notifications = app.get(NotificationService);
    await app.listen(0);
    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    url = `http://127.0.0.1:${port}`;

    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    ({ token: coordToken, houseId } = await loginCoordinator(app));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a handshake with an invalid token (server disconnects)', async () => {
    const socket = connect(url, 'not-a-jwt');
    // The gateway force-disconnects an unauthenticated socket. We must never
    // remain connected: either we never connect, or we get disconnected.
    const outcome = await new Promise<'disconnected' | 'stayed-connected'>((resolve) => {
      const timer = setTimeout(() => resolve('disconnected'), 2500);
      socket.on('disconnect', () => {
        clearTimeout(timer);
        resolve('disconnected');
      });
      socket.on('connect', () => {
        // give the server a beat to force-disconnect us
        setTimeout(() => {
          if (socket.connected) {
            clearTimeout(timer);
            resolve('stayed-connected');
          }
        }, 1200);
      });
    });
    expect(outcome).toBe('disconnected');
    socket.close();
  });

  it('delivers notification:new to a client in the targeted ADMIN room', async () => {
    const socket = connect(url, adminToken);
    await waitForEvent(socket, 'connect');

    const received = waitForEvent(socket, 'notification:new');
    await notifications.create({
      type: NotificationType.PAYMENT_REGISTERED,
      title: `Realtime admin ${Date.now()}`,
      recipientRole: Role.ADMIN,
      metadata: { entityId: `rt-admin-${Date.now()}` },
    });

    const payload = (await received) as { title: string; recipientRole: string };
    expect(payload.recipientRole).toBe(Role.ADMIN);
    socket.close();
  });

  it('does NOT deliver an ADMIN-only notification to a house-scoped ops client', async () => {
    const coordSocket = connect(url, coordToken);
    await waitForEvent(coordSocket, 'connect');

    let leaked = false;
    coordSocket.on('notification:new', () => {
      leaked = true;
    });

    await notifications.create({
      type: NotificationType.RECEIVABLE_OVERDUE,
      title: `Admin-only realtime ${Date.now()}`,
      recipientRole: Role.ADMIN,
      metadata: { entityId: `rt-leak-${Date.now()}` },
    });

    await new Promise((r) => setTimeout(r, 800));
    expect(leaked).toBe(false);
    coordSocket.close();
  });

  it('delivers a house-scoped notification to the matching ops client', async () => {
    const coordSocket = connect(url, coordToken);
    await waitForEvent(coordSocket, 'connect');

    const received = waitForEvent(coordSocket, 'notification:new');
    await notifications.create({
      type: NotificationType.INCIDENT_CREATED,
      title: `Realtime house ${Date.now()}`,
      houseId,
      metadata: { entityId: `rt-house-${Date.now()}` },
    });

    const payload = (await received) as { houseId: string };
    expect(payload.houseId).toBe(houseId);
    coordSocket.close();
  });
});
