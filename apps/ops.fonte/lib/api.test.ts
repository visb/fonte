jest.mock('@fonte/api-client', () => ({
  createApiClient: jest.fn(() => ({ tag: 'api-client' })),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '@fonte/api-client';
import { api, apiOrigin, resolveAssetUrl, setUnauthorizedHandler } from './api';

interface CapturedConfig {
  baseURL: string;
  getToken: () => Promise<string | null>;
  onUnauthorized: (context: { url?: string; method?: string }) => void;
}

const createMock = createApiClient as unknown as jest.Mock;
// Capturado no import (antes de qualquer clearAllMocks): createApiClient roda uma vez.
const config = createMock.mock.calls[0][0] as CapturedConfig;

afterEach(() => {
  setUnauthorizedHandler(null);
});

describe('lib/api', () => {
  it('exporta o client criado pelo @fonte/api-client', () => {
    expect(api).toEqual({ tag: 'api-client' });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('apiOrigin é o baseURL sem o sufixo /api/vN', () => {
    expect(apiOrigin).toBe(config.baseURL.replace(/\/api\/v\d+\/?$/, ''));
  });

  it('getToken lê o token do AsyncStorage', async () => {
    await AsyncStorage.setItem('token', 'jwt-armazenado');
    await expect(config.getToken()).resolves.toBe('jwt-armazenado');
    await AsyncStorage.clear();
  });

  it('onUnauthorized é no-op enquanto ninguém registrou handler', () => {
    expect(() => config.onUnauthorized({ url: '/residents' })).not.toThrow();
  });

  it('onUnauthorized delega ao handler registrado, com o contexto do 401', () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    config.onUnauthorized({ url: '/residents', method: 'get' });

    expect(handler).toHaveBeenCalledWith({ url: '/residents', method: 'get' });
  });

  it('setUnauthorizedHandler(null) desregistra o handler', () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    setUnauthorizedHandler(null);

    config.onUnauthorized({ url: '/residents' });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('resolveAssetUrl', () => {
  it('retorna null para valor vazio', () => {
    expect(resolveAssetUrl(null)).toBeNull();
    expect(resolveAssetUrl(undefined)).toBeNull();
    expect(resolveAssetUrl('')).toBeNull();
  });

  it('repassa URLs absolutas', () => {
    expect(resolveAssetUrl('https://cdn/x.jpg')).toBe('https://cdn/x.jpg');
    expect(resolveAssetUrl('http://cdn/x.jpg')).toBe('http://cdn/x.jpg');
  });

  it('prefixa a origem em paths relativos', () => {
    expect(resolveAssetUrl('/uploads/x.jpg')).toBe(`${apiOrigin}/uploads/x.jpg`);
  });
});
