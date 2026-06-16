import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

export const BASE = '/api/v1';

interface BootstrapOptions {
  /** Substitui um provider por um mock (ex.: o cliente AbacatePay). */
  overrideProvider?: { token: unknown; useValue: unknown };
}

/** Boots the full Nest app the same way main.ts does (prefix + global validation). */
export async function bootstrapApp(options: BootstrapOptions = {}): Promise<INestApplication> {
  let builder: TestingModuleBuilder = Test.createTestingModule({ imports: [AppModule] });
  if (options.overrideProvider) {
    builder = builder
      .overrideProvider(options.overrideProvider.token)
      .useValue(options.overrideProvider.useValue);
  }
  const moduleFixture = await builder.compile();
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
    .send({ identifier: email, password })
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
