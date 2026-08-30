import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, login, BASE } from './helpers/e2e-app';

/**
 * Observabilidade da API — story 191.
 *
 * ISOLAMENTO (story 182): esta suíte **não cria nem apaga linha em banco
 * nenhum**. Ela só lê (login nos usuários do seed) e mexe em memória do
 * processo — o `POST /observability/reset` zera contadores in-memory, não
 * toca em tabela. Por isso não há `afterAll` de limpeza: não falta cleanup,
 * não há o que limpar.
 *
 * Prova de ponta a ponta que o MIDDLEWARE está no caminho real da requisição
 * (e não só no unit): a própria rota de stats aparece no agregado.
 */
describe('Observability (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let servantToken: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    adminToken = await login(app, 'admin@fonte.com', 'admin123');
    servantToken = await login(app, 'operator@fonte.com', 'operator123');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /observability/health', () => {
    it('é público e não vaza memória, versão nem rotas', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/observability/health`)
        .expect(200);

      expect(res.body).toEqual({
        status: 'ok',
        uptimeSec: expect.any(Number),
        db: 'up',
      });
      // Liveness não ajuda quem está sondando: nada além dos três campos.
      expect(Object.keys(res.body).sort()).toEqual(['db', 'status', 'uptimeSec']);
    });

    it('devolve o header X-Request-Id (cola o log ao evento do Sentry)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/observability/health`)
        .expect(200);

      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('GET /observability/stats', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer()).get(`${BASE}/observability/stats`).expect(401);
    });

    it('com token SERVANT → 403', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/observability/stats`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403);
    });

    it('com ADMIN → 200 com runtime, rotas e recentes', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/observability/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.runtime).toMatchObject({
        uptimeSec: expect.any(Number),
        eventLoopLagMs: { p50: expect.any(Number), p99: expect.any(Number), max: expect.any(Number) },
        memory: {
          rssMb: expect.any(Number),
          heapUsedMb: expect.any(Number),
          heapTotalMb: expect.any(Number),
          externalMb: expect.any(Number),
        },
      });
      expect(Array.isArray(res.body.routes)).toBe(true);
      expect(Array.isArray(res.body.recent)).toBe(true);
      expect(typeof res.body.startedAt).toBe('string');
    });

    it('o middleware está no caminho real: a 2ª chamada vê a própria rota com count maior', async () => {
      const routeKey = `GET ${BASE}/observability/stats`;

      const first = await request(app.getHttpServer())
        .get(`${BASE}/observability/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const second = await request(app.getHttpServer())
        .get(`${BASE}/observability/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const countIn = (body: { routes?: { route: string; count: number }[] }) =>
        body.routes?.find((r) => r.route === routeKey)?.count ?? 0;

      expect(countIn(second.body)).toBeGreaterThan(countIn(first.body));
    });

    it('as requisições recentes não carregam dado pessoal (LGPD)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/observability/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.recent.length).toBeGreaterThan(0);
      for (const item of res.body.recent) {
        expect(Object.keys(item).sort()).toEqual([
          'at',
          'cpuMs',
          'dbMs',
          'dbQueries',
          'durationMs',
          'heapDeltaKb',
          'method',
          'requestId',
          'route',
          'status',
        ]);
      }
    });

    it('a requisição barrada por guard também é medida (401/403 no agregado)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/observability/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // As chamadas sem token e com SERVANT acima entraram no mesmo agregado.
      const route = res.body.routes.find(
        (r: { route: string }) => r.route === `GET ${BASE}/observability/stats`,
      );
      expect(route.errors).toBeGreaterThan(0);
    });
  });

  describe('POST /observability/reset', () => {
    it('com token SERVANT → 403', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/observability/reset`)
        .set('Authorization', `Bearer ${servantToken}`)
        .expect(403);
    });

    // Roda por último: zera a janela que os testes acima inspecionam.
    it('com ADMIN zera a janela (só memória — nenhuma linha de banco é tocada)', async () => {
      const reset = await request(app.getHttpServer())
        .post(`${BASE}/observability/reset`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(typeof reset.body.startedAt).toBe('string');

      const after = await request(app.getHttpServer())
        .get(`${BASE}/observability/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Depois do reset só existe o que veio DEPOIS dele.
      const statsRoute = after.body.routes.find(
        (r: { route: string }) => r.route === `GET ${BASE}/observability/stats`,
      );
      expect(statsRoute).toBeUndefined();
      expect(after.body.recent.length).toBeLessThanOrEqual(1);
    });
  });
});
