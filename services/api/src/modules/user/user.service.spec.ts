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
});
