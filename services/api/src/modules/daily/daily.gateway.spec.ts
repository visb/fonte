import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DailyPersonType, Role } from '@fonte/types';
import { DailyGateway } from './daily.gateway';
import { DailyService } from './daily.service';

function makeGateway(opts: { verify?: jest.Mock; findSession?: jest.Mock } = {}) {
  const jwtService = { verifyAsync: opts.verify ?? jest.fn() } as unknown as JwtService;
  const daily = {
    findSessionForUser: opts.findSession ?? jest.fn().mockResolvedValue({ id: 'sess-1', version: 4 }),
  } as unknown as DailyService;
  const gateway = new DailyGateway(jwtService, daily);
  jest.spyOn((gateway as any).logger, 'warn').mockImplementation(() => undefined);
  return { gateway, daily };
}

function makeClient(opts: { token?: string; bearer?: string; user?: unknown; rooms?: string[] } = {}) {
  return {
    handshake: {
      auth: opts.token ? { token: opts.token } : {},
      headers: opts.bearer ? { authorization: `Bearer ${opts.bearer}` } : {},
    },
    data: opts.user ? { user: opts.user } : ({} as Record<string, unknown>),
    rooms: new Set(opts.rooms ?? []),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('DailyGateway.handleConnection', () => {
  it('sem token → desconecta', async () => {
    const { gateway } = makeGateway();
    const client = makeClient();
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('token inválido → desconecta', async () => {
    const { gateway } = makeGateway({ verify: jest.fn().mockRejectedValue(new Error('bad')) });
    const client = makeClient({ token: 'x' });
    await gateway.handleConnection(client as never);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.data.user).toBeUndefined();
  });

  it('token válido (auth ou header Bearer) guarda a identidade no socket', async () => {
    const verify = jest.fn().mockResolvedValue({ sub: 'u1', role: Role.COORDINATOR });
    const { gateway } = makeGateway({ verify });
    const client = makeClient({ bearer: 'from-header' });
    await gateway.handleConnection(client as never);
    expect(verify).toHaveBeenCalledWith('from-header');
    expect(client.data.user).toEqual({ userId: 'u1', role: Role.COORDINATOR });
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});

describe('DailyGateway.handleJoin', () => {
  const coord = { userId: 'u1', role: Role.COORDINATOR };

  it('socket sem identidade ou sem sessionId → daily:error', async () => {
    const { gateway } = makeGateway();
    const anon = makeClient();
    await gateway.handleJoin(anon as never, { sessionId: 'sess-1' });
    expect(anon.emit).toHaveBeenCalledWith('daily:error', { message: 'Daily inválida.' });
    const noBody = makeClient({ user: coord });
    await gateway.handleJoin(noBody as never, undefined);
    expect(noBody.emit).toHaveBeenCalledWith('daily:error', expect.any(Object));
    expect(noBody.join).not.toHaveBeenCalled();
  });

  it('SERVANT ou coordenador de outra casa → daily:error e não entra na room', async () => {
    const findSession = jest.fn().mockRejectedValue(new ForbiddenException('Só coordenadores da casa acessam a daily.'));
    const { gateway } = makeGateway({ findSession });
    const client = makeClient({ user: { userId: 'u2', role: Role.SERVANT } });
    await gateway.handleJoin(client as never, { sessionId: 'sess-1' });
    expect(client.emit).toHaveBeenCalledWith('daily:error', { message: 'Só coordenadores da casa acessam a daily.' });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('erro sem mensagem → texto padrão', async () => {
    const { gateway } = makeGateway({ findSession: jest.fn().mockRejectedValue({}) });
    const client = makeClient({ user: coord });
    await gateway.handleJoin(client as never, { sessionId: 'sess-1' });
    expect(client.emit).toHaveBeenCalledWith('daily:error', { message: 'Sem acesso a esta daily.' });
  });

  it('join válido entra em daily:<id>, sai da daily anterior e confirma com a version', async () => {
    const { gateway, daily } = makeGateway();
    const client = makeClient({ user: coord, rooms: ['socket-id', 'daily:old', 'daily:sess-1'] });
    await gateway.handleJoin(client as never, { sessionId: 'sess-1' });
    expect(daily.findSessionForUser).toHaveBeenCalledWith(coord, 'sess-1');
    expect(client.leave).toHaveBeenCalledWith('daily:old');
    expect(client.leave).toHaveBeenCalledTimes(1);
    expect(client.join).toHaveBeenCalledWith('daily:sess-1');
    expect(client.emit).toHaveBeenCalledWith('daily:joined', { sessionId: 'sess-1', version: 4 });
  });
});

describe('DailyGateway — distribuição (@OnEvent)', () => {
  function withServer() {
    const { gateway } = makeGateway();
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { to };
    return { gateway, emit, to };
  }

  it('sem server pronto não quebra', () => {
    const { gateway } = makeGateway();
    expect(() =>
      gateway.handleMoved({
        sessionId: 's', personType: DailyPersonType.RESIDENT, personId: 'p', toMinistryId: null, version: 1, movedByUserId: 'u',
      }),
    ).not.toThrow();
  });

  it('daily:moved só para a room da sessão', () => {
    const { gateway, emit, to } = withServer();
    const event = {
      sessionId: 's1', personType: DailyPersonType.STAFF, personId: 'p', toMinistryId: 'm', version: 2, movedByUserId: 'u',
    };
    gateway.handleMoved(event);
    expect(to).toHaveBeenCalledWith('daily:s1');
    expect(emit).toHaveBeenCalledWith('daily:moved', event);
  });

  it('daily:applied para a room da sessão', () => {
    const { gateway, emit, to } = withServer();
    const event = {
      sessionId: 's1', appliedAt: 'now', appliedByUserId: 'u', appliedByName: null, result: { applied: 0, skipped: [] },
    };
    gateway.handleApplied(event);
    expect(to).toHaveBeenCalledWith('daily:s1');
    expect(emit).toHaveBeenCalledWith('daily:applied', event);
  });

  it('daily:reset para a room da sessão ANTERIOR', () => {
    const { gateway, emit, to } = withServer();
    const event = { previousSessionId: 'old', sessionId: 'new', houseId: 'h1' };
    gateway.handleReset(event);
    expect(to).toHaveBeenCalledWith('daily:old');
    expect(emit).toHaveBeenCalledWith('daily:reset', event);
  });
});
