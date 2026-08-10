/**
 * Ponte real ops.fonte ⇄ @fonte/api-client: aqui o api-client **não** é mockado
 * (ao contrário de api.test.ts). O axios é substituído por um stub para
 * capturar o interceptor de response que o client registra, e assim provar a
 * decisão travada da story 168: **offline não é sessão expirada**.
 *
 * É a regressão mais cara possível do epic 167 — se um erro de rede começar a
 * derrubar a sessão, o operador sem sinal é jogado para o login e perde o
 * trabalho em fila.
 */
jest.mock('axios', () => {
  // A instância precisa nascer dentro da factory: o import de './api' (que cria
  // o client no topo do módulo) roda antes de qualquer const deste arquivo.
  const instance = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
  };
  return { __esModule: true, default: { create: jest.fn(() => instance), __instance: instance } };
});

import axios from 'axios';
import { setUnauthorizedHandler } from './api';

type Rejector = (error: unknown) => Promise<never>;

const stub = axios as unknown as {
  __instance: { interceptors: { response: { use: jest.Mock } } };
};

// Registrado no import de lib/api (createApiClient roda uma vez, no módulo).
const onRejected = stub.__instance.interceptors.response.use.mock.calls[0][1] as Rejector;

/** Passa o erro pelo interceptor e engole a rejeição (o erro segue para quem chamou). */
async function reject(error: unknown): Promise<void> {
  await onRejected(error).catch(() => undefined);
}

let handler: jest.Mock;

beforeEach(() => {
  handler = jest.fn();
  setUnauthorizedHandler(handler);
});

afterEach(() => {
  setUnauthorizedHandler(null);
});

describe('offline ≠ sessão expirada', () => {
  it('erro de rede (axios sem response) não dispara o handler de 401', async () => {
    await reject({ message: 'Network Error', config: { url: '/residents', method: 'get' } });
    await reject({ code: 'ECONNABORTED', config: { url: '/incidents', method: 'post' } });
    await reject({ message: 'timeout of 0ms exceeded', config: { url: '/houses', method: 'get' } });

    expect(handler).not.toHaveBeenCalled();
  });

  it('erro do servidor que não é 401 também não derruba a sessão', async () => {
    await reject({ response: { status: 500 }, config: { url: '/residents', method: 'get' } });
    await reject({ response: { status: 403 }, config: { url: '/residents', method: 'get' } });

    expect(handler).not.toHaveBeenCalled();
  });

  it('401 real continua derrubando a sessão (não regride a story 165)', async () => {
    await reject({ response: { status: 401 }, config: { url: '/residents', method: 'get' } });

    expect(handler).toHaveBeenCalledWith({ url: '/residents', method: 'get' });
  });

  it('401 de login continua sendo credencial inválida, não expiração', async () => {
    await reject({ response: { status: 401 }, config: { url: '/auth/login', method: 'post' } });

    expect(handler).not.toHaveBeenCalled();
  });

  it('o erro segue rejeitando para quem chamou', async () => {
    const networkError = { message: 'Network Error', config: { url: '/residents' } };

    await expect(onRejected(networkError)).rejects.toBe(networkError);
  });
});
