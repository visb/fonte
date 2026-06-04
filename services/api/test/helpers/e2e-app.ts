import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

export const BASE = '/api/v1';

/** Boots the full Nest app the same way main.ts does (prefix + global validation). */
export async function bootstrapApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.init();
  return app;
}

/** Authenticates a seeded user and returns the bearer token. */
export async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`${BASE}/auth/login`)
    .send({ email, password })
    .expect(200);
  return res.body.accessToken;
}

/** Convenience: logs in as the seeded coordinator and resolves their houseId. */
export async function loginCoordinator(app: INestApplication): Promise<{ token: string; houseId: string }> {
  const token = await login(app, 'coord@fonte.com', 'coord123');
  const me = await request(app.getHttpServer())
    .get(`${BASE}/staff/me`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return { token, houseId: me.body.houseId };
}
