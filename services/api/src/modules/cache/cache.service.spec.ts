import { CacheService } from './cache.service';

// Fake ioredis client shared across the active-path tests.
const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => redisMock),
}));

function makeConfig(url?: string) {
  return { get: jest.fn().mockReturnValue(url) } as never;
}

describe('CacheService (inert — sem REDIS_URL)', () => {
  let service: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CacheService(makeConfig(undefined));
  });

  it('get sempre devolve null', async () => {
    await expect(service.get('k')).resolves.toBeNull();
    expect(redisMock.get).not.toHaveBeenCalled();
  });

  it('set e del são no-op (sem throw)', async () => {
    await expect(service.set('k', { a: 1 }, 60)).resolves.toBeUndefined();
    await expect(service.del('k')).resolves.toBeUndefined();
    expect(redisMock.set).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});

describe('CacheService (ativo — com REDIS_URL)', () => {
  let service: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CacheService(makeConfig('redis://localhost:6379'));
  });

  it('get faz JSON.parse do valor', async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ h1: 3 }));
    await expect(service.get<Record<string, number>>('k')).resolves.toEqual({ h1: 3 });
  });

  it('get devolve null no miss', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    await expect(service.get('k')).resolves.toBeNull();
  });

  it('get engole erro e devolve null', async () => {
    redisMock.get.mockRejectedValueOnce(new Error('boom'));
    await expect(service.get('k')).resolves.toBeNull();
  });

  it('set grava JSON com TTL (EX)', async () => {
    await service.set('k', { h1: 3 }, 3600);
    expect(redisMock.set).toHaveBeenCalledWith('k', JSON.stringify({ h1: 3 }), 'EX', 3600);
  });

  it('set sem TTL grava sem EX', async () => {
    await service.set('k', { h1: 3 });
    expect(redisMock.set).toHaveBeenCalledWith('k', JSON.stringify({ h1: 3 }));
  });

  it('del apaga a chave', async () => {
    await service.del('k');
    expect(redisMock.del).toHaveBeenCalledWith('k');
  });
});
