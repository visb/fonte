import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Role } from '@fonte/types';
import { NotificationGateway } from './notification.gateway';
import { Staff } from '../staff/staff.entity';

function makeGateway(opts: {
  verify?: jest.Mock;
  staff?: Partial<Staff> | null;
}) {
  const jwtService = {
    verifyAsync: opts.verify ?? jest.fn(),
  } as unknown as JwtService;
  const staffRepo = {
    findOne: jest.fn().mockResolvedValue(opts.staff ?? null),
  } as unknown as Repository<Staff>;
  const gateway = new NotificationGateway(jwtService, staffRepo);
  jest.spyOn((gateway as any).logger, 'warn').mockImplementation(() => undefined);
  return { gateway, staffRepo };
}

function makeClient(opts: { token?: string; bearer?: string }) {
  return {
    handshake: {
      auth: opts.token ? { token: opts.token } : {},
      headers: opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {},
    },
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}

describe('NotificationGateway.handleConnection', () => {
  it('disconnects when no token is provided', async () => {
    const { gateway } = makeGateway({});
    const client = makeClient({});
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects when the token is invalid', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('bad token'));
    const { gateway } = makeGateway({ verify });
    const client = makeClient({ token: 'x' });
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('joins user and role rooms for an ADMIN without a staff lookup', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'u1', role: Role.ADMIN });
    const { gateway, staffRepo } = makeGateway({ verify });
    const client = makeClient({ token: 'x' });
    await gateway.handleConnection(client as never);
    expect(client.join).toHaveBeenCalledWith('user:u1');
    expect(client.join).toHaveBeenCalledWith('role:ADMIN');
    expect(staffRepo.findOne).not.toHaveBeenCalled();
  });

  it('joins the house room for non-admin staff with a house', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'u2', role: Role.SERVANT });
    const { gateway, staffRepo } = makeGateway({ verify, staff: { houseId: 'h9' } });
    const client = makeClient({ bearer: 'token-from-header' });
    await gateway.handleConnection(client as never);
    expect(staffRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'u2' } });
    expect(client.join).toHaveBeenCalledWith('house:h9');
  });

  it('does not join a house room for non-admin staff without a house', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'u3', role: Role.SERVANT });
    const { gateway } = makeGateway({ verify, staff: { houseId: null } as never });
    const client = makeClient({ token: 'x' });
    await gateway.handleConnection(client as never);
    expect(client.join).not.toHaveBeenCalledWith(expect.stringContaining('house:'));
  });
});

describe('NotificationGateway.handleNotificationCreated', () => {
  it('does nothing when the server is not ready', () => {
    const { gateway } = makeGateway({});
    expect(() =>
      gateway.handleNotificationCreated({ rooms: ['user:1'], payload: {} as never }),
    ).not.toThrow();
  });

  it('does nothing when there are no target rooms', () => {
    const { gateway } = makeGateway({});
    const emit = jest.fn();
    (gateway as any).server = { to: jest.fn().mockReturnValue({ emit }) };
    gateway.handleNotificationCreated({ rooms: [], payload: {} as never });
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits to the targeted rooms', () => {
    const { gateway } = makeGateway({});
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { to };
    const payload = { id: 'n1' } as never;
    gateway.handleNotificationCreated({ rooms: ['user:1', 'role:ADMIN'], payload });
    expect(to).toHaveBeenCalledWith(['user:1', 'role:ADMIN']);
    expect(emit).toHaveBeenCalledWith('notification:new', payload);
  });
});
