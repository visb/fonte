import { normalizePath, routeNameOf, routePathOf } from './route-name';

type FakeRequest = Parameters<typeof routePathOf>[0];

function req(overrides: Partial<FakeRequest>): FakeRequest {
  return { method: 'GET', ...overrides } as FakeRequest;
}

describe('route-name', () => {
  describe('com o padrão da rota do Express', () => {
    it('usa baseUrl + route.path', () => {
      const request = req({
        baseUrl: '/api/v1/residents',
        route: { path: '/:id' },
        path: '/api/v1/residents/8f14e45f-ea1c-4c58-9f7f-0f1e5d3a2b11',
      });

      expect(routePathOf(request)).toBe('/api/v1/residents/:id');
      expect(routeNameOf(request)).toBe('GET /api/v1/residents/:id');
    });

    it('rota raiz montada num prefixo não vira barra sobrando', () => {
      expect(routePathOf(req({ baseUrl: '/api/v1/residents', route: { path: '/' } }))).toBe(
        '/api/v1/residents',
      );
    });

    it('garante a barra inicial mesmo sem baseUrl', () => {
      expect(routePathOf(req({ route: { path: 'health' } }))).toBe('/health');
    });
  });

  describe('sem req.route (404, estático, barrado antes do roteador)', () => {
    it('UUID v4 vira :id', () => {
      expect(routePathOf(req({ path: '/api/v1/residents/8f14e45f-ea1c-4c58-9f7f-0f1e5d3a2b11' }))).toBe(
        '/api/v1/residents/:id',
      );
    });

    it('id numérico vira :id', () => {
      expect(routePathOf(req({ path: '/api/v1/events/42/tickets' }))).toBe(
        '/api/v1/events/:id/tickets',
      );
    });

    it('hash hex vira :id', () => {
      expect(routePathOf(req({ path: '/p/9f8e7d6c5b4a3f2e1d0c9b8a' }))).toBe('/p/:id');
    });

    it('segmento textual NÃO vira :id', () => {
      expect(routePathOf(req({ path: '/api/v1/residents' }))).toBe('/api/v1/residents');
    });

    it('cai no originalUrl/url quando não há path', () => {
      expect(routePathOf(req({ originalUrl: '/api/v1/houses' }))).toBe('/api/v1/houses');
      expect(routePathOf(req({ url: '/api/v1/staff' }))).toBe('/api/v1/staff');
    });

    it('sem nada identificável, devolve a raiz', () => {
      expect(routePathOf(req({}))).toBe('/');
    });
  });

  describe('normalizePath', () => {
    it('descarta a query string', () => {
      expect(normalizePath('/api/v1/residents?status=ACTIVE&house=1')).toBe('/api/v1/residents');
    });

    it('normaliza a barra final', () => {
      expect(normalizePath('/api/v1/residents/')).toBe('/api/v1/residents');
    });

    it('normaliza a raiz', () => {
      expect(normalizePath('/')).toBe('/');
    });
  });

  it('usa o método em maiúsculas na chave', () => {
    expect(routeNameOf(req({ method: 'post', path: '/api/v1/residents' }))).toBe(
      'POST /api/v1/residents',
    );
  });

  it('sem método, assume GET', () => {
    expect(routeNameOf({ path: '/x' } as FakeRequest)).toBe('GET /x');
  });
});
