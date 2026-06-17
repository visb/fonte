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
