import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Mock do transporte: `axios.create` devolve um http stub com interceptors e os
 * verbos como `vi.fn()`. Assim `createApiClient` monta a superfície de recursos
 * sem tocar a rede.
 */
const httpStub = {
  get: vi.fn().mockResolvedValue({ data: undefined }),
  post: vi.fn().mockResolvedValue({ data: undefined }),
  patch: vi.fn().mockResolvedValue({ data: undefined }),
  delete: vi.fn().mockResolvedValue({ data: undefined }),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

vi.mock('axios', () => ({
  default: { create: vi.fn(() => httpStub) },
}));

import axios from 'axios';
import { createApiClient } from './client.js';

const EXPECTED_RESOURCES = [
  'auth',
  'residents',
  'residentSessions',
  'staff',
  'incidents',
  'storeroom',
  'houses',
  'ministries',
  'messages',
  'relatives',
  'documentTemplates',
  'supportGroups',
  'wishlist',
  'appSettings',
  'streetSales',
  'associates',
  'payables',
  'activities',
  'supplyRoom',
  'bibleCourse',
  'notifications',
  'census',
  'backup',
  'consents',
  'audit',
] as const;

describe('createApiClient (superfície)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function build() {
    return createApiClient({ baseURL: 'http://localhost:3000/api/v1', getToken: () => null });
  }

  it('cria a instância axios com o baseURL informado', () => {
    build();
    expect(axios.create).toHaveBeenCalledWith({ baseURL: 'http://localhost:3000/api/v1' });
  });

  it('expõe todos os recursos esperados', () => {
    const client = build();
    for (const resource of EXPECTED_RESOURCES) {
      expect(client, `recurso ausente: ${resource}`).toHaveProperty(resource);
      expect((client as Record<string, unknown>)[resource]).toBeTypeOf('object');
    }
  });

  it('registra o interceptor de request para injetar o token', () => {
    build();
    expect(httpStub.interceptors.request.use).toHaveBeenCalledTimes(1);
  });

  it('o interceptor de request injeta o Bearer quando há token', async () => {
    createApiClient({ baseURL: 'http://x/api/v1', getToken: () => 'jwt-123' });
    const onRequest = httpStub.interceptors.request.use.mock.calls[0][0] as (
      req: { headers: Record<string, string> },
    ) => Promise<{ headers: Record<string, string> }>;

    const req = await onRequest({ headers: {} });
    expect(req.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('o interceptor de request não injeta header sem token', async () => {
    build();
    const onRequest = httpStub.interceptors.request.use.mock.calls[0][0] as (
      req: { headers: Record<string, string> },
    ) => Promise<{ headers: Record<string, string> }>;

    const req = await onRequest({ headers: {} });
    expect(req.headers.Authorization).toBeUndefined();
  });

  it('registra interceptor de response apenas quando onUnauthorized é fornecido', () => {
    build();
    expect(httpStub.interceptors.response.use).not.toHaveBeenCalled();

    vi.clearAllMocks();
    createApiClient({
      baseURL: 'http://x/api/v1',
      getToken: () => null,
      onUnauthorized: () => undefined,
    });
    expect(httpStub.interceptors.response.use).toHaveBeenCalledTimes(1);
  });

  describe('interceptor de 401 (story 165)', () => {
    /** Monta o client com handler e devolve o rejeitador registrado no interceptor. */
    function buildWithHandler() {
      const onUnauthorized = vi.fn();
      createApiClient({
        baseURL: 'http://x/api/v1',
        getToken: () => null,
        onUnauthorized,
      });
      const onRejected = httpStub.interceptors.response.use.mock.calls[0][1] as (
        err: unknown,
      ) => Promise<never>;
      return { onUnauthorized, onRejected };
    }

    function reject(
      onRejected: (err: unknown) => Promise<never>,
      err: unknown,
    ): Promise<unknown> {
      return onRejected(err).catch((e) => e);
    }

    it('chama onUnauthorized em 401 de rota comum, com url e método', async () => {
      const { onUnauthorized, onRejected } = buildWithHandler();
      const err = { response: { status: 401 }, config: { url: '/residents', method: 'get' } };

      await expect(reject(onRejected, err)).resolves.toBe(err);
      expect(onUnauthorized).toHaveBeenCalledWith({ url: '/residents', method: 'get' });
    });

    it('não chama onUnauthorized em 401 de /auth/login (credencial inválida)', async () => {
      const { onUnauthorized, onRejected } = buildWithHandler();
      const err = { response: { status: 401 }, config: { url: '/auth/login', method: 'post' } };

      await expect(reject(onRejected, err)).resolves.toBe(err);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('não chama onUnauthorized em 401 de /auth/change-password', async () => {
      const { onUnauthorized, onRejected } = buildWithHandler();
      const err = {
        response: { status: 401 },
        config: { url: '/auth/change-password', method: 'post' },
      };

      await reject(onRejected, err);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('ignora querystring e barra final ao identificar rota de auth', async () => {
      const { onUnauthorized, onRejected } = buildWithHandler();

      await reject(onRejected, {
        response: { status: 401 },
        config: { url: '/auth/login/?redirect=1', method: 'post' },
      });
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('chama onUnauthorized quando o erro 401 não traz config (url desconhecida)', async () => {
      const { onUnauthorized, onRejected } = buildWithHandler();

      await reject(onRejected, { response: { status: 401 } });
      expect(onUnauthorized).toHaveBeenCalledWith({ url: undefined, method: undefined });
    });

    it('nunca chama onUnauthorized em erro não-401', async () => {
      const { onUnauthorized, onRejected } = buildWithHandler();

      await reject(onRejected, {
        response: { status: 403 },
        config: { url: '/residents', method: 'get' },
      });
      await reject(onRejected, {
        response: { status: 500 },
        config: { url: '/residents', method: 'get' },
      });
      await reject(onRejected, { message: 'Network Error' });

      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('repassa respostas de sucesso sem tocar no handler', () => {
      const { onUnauthorized } = buildWithHandler();
      const onFulfilled = httpStub.interceptors.response.use.mock.calls[0][0] as (
        res: unknown,
      ) => unknown;
      const res = { data: 'ok' };

      expect(onFulfilled(res)).toBe(res);
      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe('photoUrl', () => {
    it('retorna null para path vazio', () => {
      const client = build();
      expect(client.photoUrl(null)).toBeNull();
      expect(client.photoUrl(undefined)).toBeNull();
    });

    it('repassa URLs absolutas sem alteração', () => {
      const client = build();
      expect(client.photoUrl('https://cdn/x.jpg')).toBe('https://cdn/x.jpg');
      expect(client.photoUrl('http://cdn/x.jpg')).toBe('http://cdn/x.jpg');
    });

    it('prefixa a origem (sem o sufixo /api/vN) em paths relativos', () => {
      const client = build();
      expect(client.photoUrl('/uploads/x.jpg')).toBe('http://localhost:3000/uploads/x.jpg');
    });
  });
});
