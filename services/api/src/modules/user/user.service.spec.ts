import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './user.entity';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  return new UserService(repo as unknown as Repository<User>);
}

describe('UserService', () => {
  it('findByEmail queries by email', async () => {
    const repo = makeRepo();
    await makeService(repo).findByEmail('a@b.com');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
  });

  it('findById queries by id', async () => {
    const repo = makeRepo();
    await makeService(repo).findById('u1');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('updatePassword clears the mustChangePassword flag', async () => {
    const repo = makeRepo();
    await makeService(repo).updatePassword('u1', 'hash');
    expect(repo.update).toHaveBeenCalledWith('u1', { passwordHash: 'hash', mustChangePassword: false });
  });

  // Story 97 — o lookup de login por número lê staff.whatsapp (coluna renomeada)
  // e mantém relatives.phone / residents.contact_phone como estavam.
  it('findActiveUserIdsByPhone reads staff.whatsapp and keeps the other profiles', async () => {
    const query = jest.fn().mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]);
    const repo = makeRepo();
    (repo as { manager?: unknown }).manager = { query };

    const ids = await makeService(repo).findActiveUserIdsByPhone('11977770001');

    expect(ids).toEqual(['u1', 'u2']);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('whatsapp AS phone FROM staff');
    expect(sql).toContain('phone FROM relatives');
    expect(sql).toContain('contact_phone AS phone FROM residents');
    expect(params).toEqual(['11977770001']);
  });
});
