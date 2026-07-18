import { Repository } from 'typeorm';
import { PreferenceService } from './preference.service';
import { UserPreference } from './user-preference.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  return new PreferenceService(repo as unknown as Repository<UserPreference>);
}

describe('PreferenceService.getAll', () => {
  it('devolve só as preferências do usuário do token, como mapa chave→valor', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { key: 'residents.filters', value: { status: '' } },
        { key: 'dashboard.range', value: '30d' },
      ]),
    });
    const service = makeService(repo);

    const result = await service.getAll('user-A');

    expect(repo.find).toHaveBeenCalledWith({ where: { userId: 'user-A' } });
    expect(result).toEqual({
      'residents.filters': { status: '' },
      'dashboard.range': '30d',
    });
  });

  it('devolve mapa vazio quando o usuário não tem preferências', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await expect(service.getAll('user-B')).resolves.toEqual({});
  });
});

describe('PreferenceService.set', () => {
  it('faz upsert por (userId, key) — cria e depois atualiza sem duplicar', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.set('user-A', 'residents.filters', { status: 'ACTIVE' });
    await service.set('user-A', 'residents.filters', { status: '' });

    expect(repo.upsert).toHaveBeenCalledTimes(2);
    expect(repo.upsert).toHaveBeenLastCalledWith(
      { userId: 'user-A', key: 'residents.filters', value: { status: '' } },
      { conflictPaths: ['userId', 'key'] },
    );
  });
});

describe('PreferenceService.remove', () => {
  it('apaga a preferência (userId, key)', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    await service.remove('user-A', 'residents.filters');

    expect(repo.delete).toHaveBeenCalledWith({
      userId: 'user-A',
      key: 'residents.filters',
    });
  });

  it('remover inexistente não estoura (affected 0)', async () => {
    const repo = makeRepo({ delete: jest.fn().mockResolvedValue({ affected: 0 }) });
    const service = makeService(repo);
    await expect(service.remove('user-A', 'inexistente')).resolves.toBeUndefined();
  });
});
