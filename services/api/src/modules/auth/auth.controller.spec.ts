import { AuthController } from './auth.controller';

function svc() {
  return {
    login: jest.fn().mockResolvedValue({ accessToken: 'tok' }),
    changePassword: jest.fn().mockResolvedValue({ accessToken: 'tok2' }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('AuthController', () => {
  it('login delegates the dto to the service', async () => {
    const s = svc();
    const c = new AuthController(s as never);
    await expect(c.login({ email: 'a@b.com', password: 'pw' } as never)).resolves.toEqual({ accessToken: 'tok' });
    expect(s.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
  });

  it('changePassword passes the userId and new password', async () => {
    const s = svc();
    const c = new AuthController(s as never);
    await c.changePassword({ userId: 'u1' } as never, { newPassword: 'np' } as never);
    expect(s.changePassword).toHaveBeenCalledWith('u1', 'np');
  });
});
