import { ForbiddenException } from '@nestjs/common';
import { Role, SNAPSHOT_MAX_DELTA_AGE_DAYS } from '@fonte/types';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  OfflineSyncService,
  SNAPSHOT_CLOCK_SKEW_MS,
} from './offline-sync.service';

const HOUSE = 'house-1';
const OTHER_HOUSE = 'house-2';
const DAY_MS = 24 * 60 * 60 * 1000;

const SERVANT: AuthenticatedUser = {
  userId: 'user-servant',
  role: Role.SERVANT,
  profileType: 'STAFF',
};
const COORDINATOR: AuthenticatedUser = {
  userId: 'user-coord',
  role: Role.COORDINATOR,
  profileType: 'STAFF',
};
const ADMIN: AuthenticatedUser = {
  userId: 'user-admin',
  role: Role.ADMIN,
  profileType: 'STAFF',
};

type Deps = {
  residents: Record<string, jest.Mock>;
  followUps: Record<string, jest.Mock>;
  receivables: Record<string, jest.Mock>;
  consents: Record<string, jest.Mock>;
  ministries: Record<string, jest.Mock>;
  staff: Record<string, jest.Mock>;
};

function build(over: Partial<Record<keyof Deps, Record<string, jest.Mock>>> = {}) {
  const mocks: Deps = {
    residents: {
      findPresentByHouse: jest.fn().mockResolvedValue([]),
      findPresentIdsByHouse: jest.fn().mockResolvedValue([]),
      findDepartedIdsSince: jest.fn().mockResolvedValue([]),
      findAttachmentsByResidents: jest.fn().mockResolvedValue([]),
      ...over.residents,
    },
    followUps: {
      findByResidents: jest.fn().mockResolvedValue([]),
      findDeletedIdsSince: jest.fn().mockResolvedValue([]),
      ...over.followUps,
    },
    receivables: {
      findByResidents: jest.fn().mockResolvedValue([]),
      findDeletedIdsSince: jest.fn().mockResolvedValue([]),
      ...over.receivables,
    },
    consents: {
      findForSubjects: jest.fn().mockResolvedValue([]),
      ...over.consents,
    },
    ministries: {
      findByHouse: jest.fn().mockResolvedValue([]),
      ...over.ministries,
    },
    staff: {
      findByUserId: jest.fn().mockResolvedValue({ id: 'staff-1', houseId: HOUSE }),
      ...over.staff,
    },
  };

  const service = new OfflineSyncService(
    mocks.residents as never,
    mocks.followUps as never,
    mocks.receivables as never,
    mocks.consents as never,
    mocks.ministries as never,
    mocks.staff as never,
  );
  return { service, mocks };
}

function residentRow(id: string) {
  return { id, name: `Filho ${id}`, houseId: HOUSE, status: 'ACTIVE' };
}

/** Quantas idas às dependências o snapshot fez — o teste de "sem N+1". */
function callCount(mocks: Deps): number {
  return Object.values(mocks)
    .flatMap((dep) => Object.values(dep))
    .reduce((total, fn) => total + fn.mock.calls.length, 0);
}

describe('OfflineSyncService — sincronização completa', () => {
  it('devolve os filhos presentes com os cinco blocos de detalhe e os ministérios', async () => {
    const { service, mocks } = build({
      residents: {
        findPresentByHouse: jest.fn().mockResolvedValue([residentRow('r1'), residentRow('r2')]),
        findAttachmentsByResidents: jest
          .fn()
          .mockResolvedValue([{ id: 'a1', residentId: 'r1', filename: 'ficha.pdf' }]),
      },
      followUps: {
        findByResidents: jest.fn().mockResolvedValue([{ id: 'f1', residentId: 'r1' }]),
      },
      receivables: {
        findByResidents: jest.fn().mockResolvedValue([{ id: 'rc1', residentId: 'r2' }]),
      },
      consents: {
        findForSubjects: jest
          .fn()
          .mockResolvedValue([{ id: 'c1', subjectId: 'r2', granted: true }]),
      },
      ministries: { findByHouse: jest.fn().mockResolvedValue([{ id: 'm1', name: 'Cozinha' }]) },
    });

    const snapshot = await service.houseSnapshot(HOUSE, {}, COORDINATOR);

    expect(snapshot.full).toBe(true);
    expect(snapshot.residents.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(snapshot.followUps).toEqual({ r1: [{ id: 'f1', residentId: 'r1' }] });
    expect(snapshot.receivables).toEqual({ r2: [{ id: 'rc1', residentId: 'r2' }] });
    expect(snapshot.consents).toEqual({ r2: [{ id: 'c1', subjectId: 'r2', granted: true }] });
    expect(snapshot.attachments).toEqual({
      r1: [{ id: 'a1', residentId: 'r1', filename: 'ficha.pdf' }],
    });
    expect(snapshot.ministries).toEqual([{ id: 'm1', name: 'Cozinha' }]);
    expect(snapshot.deleted).toEqual({ residents: [], followUps: [], receivables: [] });
    // Sem `since`, nenhum bloco é recortado por data.
    expect(mocks.residents.findPresentByHouse).toHaveBeenCalledWith(HOUSE, undefined);
    expect(mocks.followUps.findByResidents).toHaveBeenCalledWith(
      ['r1', 'r2'],
      Role.COORDINATOR,
      undefined,
    );
    // Full já tem a lista inteira em mãos: não gasta uma consulta só de ids.
    expect(mocks.residents.findPresentIdsByHouse).not.toHaveBeenCalled();
    // Nada de "apagados" para reconciliar: o cliente substitui o store.
    expect(mocks.residents.findDepartedIdsSince).not.toHaveBeenCalled();
  });

  it('casa sem filho presente devolve payload válido e vazio, não erro', async () => {
    const { service } = build();

    const snapshot = await service.houseSnapshot(HOUSE, {}, SERVANT);

    expect(snapshot.residents).toEqual([]);
    expect(snapshot.followUps).toEqual({});
    expect(snapshot.attachments).toEqual({});
    expect(snapshot.full).toBe(true);
  });

  it('repassa o role do chamador ao bloco de timeline (recorte do SERVANT)', async () => {
    const { service, mocks } = build({
      residents: { findPresentByHouse: jest.fn().mockResolvedValue([residentRow('r1')]) },
    });

    await service.houseSnapshot(HOUSE, {}, ADMIN);

    expect(mocks.followUps.findByResidents).toHaveBeenCalledWith(['r1'], Role.ADMIN, undefined);
  });

  it('o carnê NÃO desce para o servo — o pacote não é atalho de permissão', async () => {
    const { service, mocks } = build({
      residents: { findPresentByHouse: jest.fn().mockResolvedValue([residentRow('r1')]) },
      receivables: {
        findByResidents: jest.fn().mockResolvedValue([{ id: 'rc1', residentId: 'r1' }]),
      },
    });

    const snapshot = await service.houseSnapshot(HOUSE, {}, SERVANT);

    // `GET /residents/:id/receivables` é ADMIN/COORDINATOR: a paridade se mantém.
    expect(snapshot.receivables).toEqual({});
    expect(mocks.receivables.findByResidents).not.toHaveBeenCalled();
  });
});

describe('OfflineSyncService — delta', () => {
  const since = new Date(Date.now() - 2 * DAY_MS).toISOString();

  it('traz só o filho alterado, mas o detalhe de todos os presentes', async () => {
    const { service, mocks } = build({
      residents: {
        // Só o r2 mudou desde o `since`.
        findPresentByHouse: jest.fn().mockResolvedValue([residentRow('r2')]),
        findPresentIdsByHouse: jest.fn().mockResolvedValue(['r1', 'r2']),
      },
      followUps: {
        // Evento novo do r1 (intocado): não muda a linha do filho, mas precisa descer.
        findByResidents: jest.fn().mockResolvedValue([{ id: 'f9', residentId: 'r1' }]),
      },
    });

    const snapshot = await service.houseSnapshot(HOUSE, { since }, COORDINATOR);

    expect(snapshot.full).toBe(false);
    expect(snapshot.residents.map((r) => r.id)).toEqual(['r2']);
    expect(snapshot.followUps).toEqual({ r1: [{ id: 'f9', residentId: 'r1' }] });
    expect(mocks.residents.findPresentByHouse).toHaveBeenCalledWith(HOUSE, new Date(since));
    expect(mocks.followUps.findByResidents).toHaveBeenCalledWith(
      ['r1', 'r2'],
      Role.COORDINATOR,
      new Date(since),
    );
    expect(mocks.receivables.findByResidents).toHaveBeenCalledWith(['r1', 'r2'], new Date(since));
  });

  it('anexo vem completo, e só para o filho que está no payload (decisão 5)', async () => {
    const { service, mocks } = build({
      residents: {
        findPresentByHouse: jest.fn().mockResolvedValue([residentRow('r2')]),
        findPresentIdsByHouse: jest.fn().mockResolvedValue(['r1', 'r2']),
        findAttachmentsByResidents: jest
          .fn()
          .mockResolvedValue([{ id: 'a1', residentId: 'r2' }, { id: 'a2', residentId: 'r2' }]),
      },
    });

    const snapshot = await service.houseSnapshot(HOUSE, { since }, SERVANT);

    // Sem `updated_at` na tabela não há recorte por data: manda o conjunto todo.
    expect(mocks.residents.findAttachmentsByResidents).toHaveBeenCalledWith(['r2']);
    expect(snapshot.attachments.r2).toHaveLength(2);
  });

  it('consentimento é recortado por created_at e nunca entra em deleted (decisão 4)', async () => {
    const { service, mocks } = build({
      residents: {
        findPresentByHouse: jest.fn().mockResolvedValue([residentRow('r1')]),
        findPresentIdsByHouse: jest.fn().mockResolvedValue(['r1']),
      },
      consents: {
        // Revogação = linha nova com granted: false.
        findForSubjects: jest
          .fn()
          .mockResolvedValue([{ id: 'c2', subjectId: 'r1', granted: false }]),
      },
    });

    const snapshot = await service.houseSnapshot(HOUSE, { since }, SERVANT);

    expect(mocks.consents.findForSubjects).toHaveBeenCalledWith('RESIDENT', ['r1'], new Date(since));
    expect(snapshot.consents.r1[0].granted).toBe(false);
    expect(Object.keys(snapshot.deleted)).toEqual(['residents', 'followUps', 'receivables']);
  });

  it('deleted junta quem saiu da casa e os registros apagados', async () => {
    const { service, mocks } = build({
      residents: {
        findPresentByHouse: jest.fn().mockResolvedValue([]),
        findPresentIdsByHouse: jest.fn().mockResolvedValue(['r1']),
        findDepartedIdsSince: jest.fn().mockResolvedValue(['r-alta', 'r-apagado']),
      },
      followUps: { findDeletedIdsSince: jest.fn().mockResolvedValue(['f-morto']) },
      receivables: { findDeletedIdsSince: jest.fn().mockResolvedValue(['rc-morto']) },
    });

    const snapshot = await service.houseSnapshot(HOUSE, { since }, COORDINATOR);

    expect(snapshot.deleted).toEqual({
      residents: ['r-alta', 'r-apagado'],
      followUps: ['f-morto'],
      receivables: ['rc-morto'],
    });
    expect(mocks.residents.findDepartedIdsSince).toHaveBeenCalledWith(HOUSE, new Date(since));
    expect(mocks.followUps.findDeletedIdsSince).toHaveBeenCalledWith(['r1'], new Date(since));
  });

  it('since mais velho que a janela máxima vira sincronização completa', async () => {
    const tooOld = new Date(
      Date.now() - (SNAPSHOT_MAX_DELTA_AGE_DAYS + 1) * DAY_MS,
    ).toISOString();
    const { service, mocks } = build();

    const snapshot = await service.houseSnapshot(HOUSE, { since: tooOld }, SERVANT);

    expect(snapshot.full).toBe(true);
    expect(mocks.residents.findPresentByHouse).toHaveBeenCalledWith(HOUSE, undefined);
    expect(mocks.residents.findDepartedIdsSince).not.toHaveBeenCalled();
  });

  it('since dentro da janela, mas na borda, continua sendo delta', async () => {
    const edge = new Date(
      Date.now() - (SNAPSHOT_MAX_DELTA_AGE_DAYS - 1) * DAY_MS,
    ).toISOString();
    const { service } = build();

    await expect(service.houseSnapshot(HOUSE, { since: edge }, SERVANT)).resolves.toMatchObject({
      full: false,
    });
  });

  it('since impossível de interpretar cai em sincronização completa, não em erro', async () => {
    const { service } = build();

    // O DTO já recusa isto na borda HTTP; aqui é a rede de segurança do service.
    const snapshot = await service.houseSnapshot(HOUSE, { since: 'nao-e-data' }, SERVANT);

    expect(snapshot.full).toBe(true);
  });
});

describe('OfflineSyncService — syncedAt', () => {
  it('vem do relógio do servidor, com a folga que evita perder escrita concorrente', async () => {
    const now = new Date('2026-08-14T12:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const since = new Date(now - DAY_MS).toISOString();
    const { service } = build();

    const snapshot = await service.houseSnapshot(HOUSE, { since }, SERVANT);

    expect(snapshot.syncedAt).toBe(new Date(now - SNAPSHOT_CLOCK_SKEW_MS).toISOString());
    // Nem o `since` do cliente, nem o `Date.now()` cru.
    expect(snapshot.syncedAt).not.toBe(since);
    expect(snapshot.syncedAt).not.toBe(new Date(now).toISOString());

    jest.restoreAllMocks();
  });
});

describe('OfflineSyncService — sem N+1', () => {
  it('a contagem de idas ao banco não cresce com o número de filhos', async () => {
    const makeHouse = (size: number) => {
      const rows = Array.from({ length: size }, (_, i) => residentRow(`r${i}`));
      return build({
        residents: {
          findPresentByHouse: jest.fn().mockResolvedValue(rows),
          findPresentIdsByHouse: jest.fn().mockResolvedValue(rows.map((r) => r.id)),
        },
      });
    };
    const since = new Date(Date.now() - DAY_MS).toISOString();

    const small = makeHouse(1);
    await small.service.houseSnapshot(HOUSE, { since }, SERVANT);

    const big = makeHouse(40);
    await big.service.houseSnapshot(HOUSE, { since }, SERVANT);

    expect(callCount(big.mocks)).toBe(callCount(small.mocks));
  });
});

describe('OfflineSyncService — autorização', () => {
  it('staff da própria casa passa', async () => {
    const { service, mocks } = build();

    await expect(service.houseSnapshot(HOUSE, {}, SERVANT)).resolves.toBeDefined();
    expect(mocks.staff.findByUserId).toHaveBeenCalledWith(SERVANT.userId);
  });

  it('staff de outra casa leva 403', async () => {
    const { service } = build({
      staff: { findByUserId: jest.fn().mockResolvedValue({ houseId: OTHER_HOUSE }) },
    });

    await expect(service.houseSnapshot(HOUSE, {}, SERVANT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('servo sem casa (grupo de apoio) leva 403', async () => {
    const { service } = build({
      staff: { findByUserId: jest.fn().mockResolvedValue({ houseId: null }) },
    });

    await expect(service.houseSnapshot(HOUSE, {}, SERVANT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('usuário sem perfil de staff leva 403', async () => {
    const { service } = build({
      staff: { findByUserId: jest.fn().mockRejectedValue(new Error('not found')) },
    });

    await expect(service.houseSnapshot(HOUSE, {}, SERVANT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('ADMIN passa por cima do recorte por casa, sem sequer consultar o staff', async () => {
    const { service, mocks } = build();

    await expect(service.houseSnapshot(OTHER_HOUSE, {}, ADMIN)).resolves.toBeDefined();
    expect(mocks.staff.findByUserId).not.toHaveBeenCalled();
  });

  it('403 acontece antes de qualquer leitura de dado pessoal', async () => {
    const { service, mocks } = build({
      staff: { findByUserId: jest.fn().mockResolvedValue({ houseId: OTHER_HOUSE }) },
    });

    await expect(service.houseSnapshot(HOUSE, {}, SERVANT)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mocks.residents.findPresentByHouse).not.toHaveBeenCalled();
    expect(mocks.ministries.findByHouse).not.toHaveBeenCalled();
  });
});
