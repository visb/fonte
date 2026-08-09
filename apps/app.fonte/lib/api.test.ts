jest.mock('@fonte/api-client', () => ({
  createApiClient: jest.fn(() => ({ tag: 'api-client' })),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '@fonte/api-client';
import { api, setUnauthorizedHandler } from './api';

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

  it('usa um baseURL apontando para /api/v1', () => {
    expect(config.baseURL).toMatch(/\/api\/v1$/);
  });

  it('getToken lê o token do AsyncStorage', async () => {
    await AsyncStorage.setItem('token', 'jwt-armazenado');
    await expect(config.getToken()).resolves.toBe('jwt-armazenado');
    await AsyncStorage.clear();
  });

  it('onUnauthorized é no-op enquanto ninguém registrou handler', () => {
    expect(() => config.onUnauthorized({ url: '/relatives/me' })).not.toThrow();
  });

  it('onUnauthorized delega ao handler registrado, com o contexto do 401', () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);

    config.onUnauthorized({ url: '/relatives/me', method: 'get' });

    expect(handler).toHaveBeenCalledWith({ url: '/relatives/me', method: 'get' });
  });

  it('setUnauthorizedHandler(null) desregistra o handler', () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    setUnauthorizedHandler(null);

    config.onUnauthorized({ url: '/relatives/me' });

    expect(handler).not.toHaveBeenCalled();
  });
});
