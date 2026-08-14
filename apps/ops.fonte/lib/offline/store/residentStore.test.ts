import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Resident } from '@fonte/api-client';
import { createWebDriver } from './driver.asyncStorage';
import { setResidentStoreDriver, type ResidentStoreDriver } from './driver';
import {
  lastSyncedAt,
  purgeAll,
  readHouseMinistries,
  readResident,
  readResidentDetail,
  readResidentList,
  readStoreDump,
  removeDetailItems,
  removeResidents,
  replaceHouseData,
  saveHouseMinistries,
  saveResident,
  saveResidentDetail,
  saveResidentList,
  setLastSyncedAt,
  subscribeResidentStore,
} from './residentStore';
import { detailRowId } from './schema';

function resident(id: string, name: string, houseId: string | null = 'h1'): Resident {
  return { id, name, houseId, status: 'ACTIVE' } as unknown as Resident;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  setResidentStoreDriver(createWebDriver());
});

afterEach(() => {
  jest.restoreAllMocks();
  setResidentStoreDriver(null);
});

describe('lista de filhos da casa', () => {
  it('grava e lê a lista por casa, em ordem alfabética', async () => {
    await saveResidentList('h1', [resident('r2', 'Zacarias'), resident('r1', 'Ana')]);

    const stored = await readResidentList('h1');

    expect(stored?.data.map((r) => r.name)).toEqual(['Ana', 'Zacarias']);
    expect(stored?.updatedAt).toBeGreaterThan(0);
  });

  it('casa sem dado devolve null (não lança)', async () => {
    await expect(readResidentList('casa-nova')).resolves.toBeNull();
  });

  it('não mistura casas', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    await saveResidentList('h2', [resident('r9', 'Bento', 'h2')]);

    expect((await readResidentList('h1'))?.data.map((r) => r.id)).toEqual(['r1']);
    expect((await readResidentList('h2'))?.data.map((r) => r.id)).toEqual(['r9']);
  });

  it('filho que saiu da lista da casa sai do aparelho com a ficha (LGPD)', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana'), resident('r2', 'Bento')]);
    await saveResidentDetail('r2', 'follow_ups', [{ id: 'f1' }] as never);

    await saveResidentList('h1', [resident('r1', 'Ana')]);

    expect((await readResidentList('h1'))?.data.map((r) => r.id)).toEqual(['r1']);
    expect(await readResident('r2')).toBeNull();
    expect(await readResidentDetail('r2', 'follow_ups')).toBeNull();
  });

  it('regravar a mesma lista não avança o carimbo (não queima disco à toa)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    const first = (await readResidentList('h1'))!.updatedAt;

    jest.spyOn(Date, 'now').mockReturnValue(9_000);
    await saveResidentList('h1', [resident('r1', 'Ana')]);

    expect((await readResidentList('h1'))!.updatedAt).toBe(first);
  });

  it('conteúdo diferente avança o carimbo', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    await saveResidentList('h1', [resident('r1', 'Ana')]);

    jest.spyOn(Date, 'now').mockReturnValue(9_000);
    await saveResidentList('h1', [resident('r1', 'Ana Maria')]);

    expect((await readResidentList('h1'))!.updatedAt).toBe(9_000);
  });
});

describe('ficha do filho', () => {
  it('grava e lê a ficha básica', async () => {
    await saveResident(resident('r1', 'Ana'));

    expect((await readResident('r1'))?.data.name).toBe('Ana');
  });

  it.each(['follow_ups', 'attachments', 'consents', 'receivables'] as const)(
    'grava e lê o bloco %s',
    async (kind) => {
      await saveResidentDetail('r1', kind, [{ id: `${kind}-1` }] as never);

      expect((await readResidentDetail('r1', kind))?.data).toEqual([{ id: `${kind}-1` }]);
    },
  );

  it('bloco nunca gravado devolve null', async () => {
    expect(await readResidentDetail('r1', 'receivables')).toBeNull();
  });

  it('ministérios da casa', async () => {
    await saveHouseMinistries('h1', [{ id: 'm1', name: 'Cozinha' }] as never);

    expect((await readHouseMinistries('h1'))?.data).toEqual([{ id: 'm1', name: 'Cozinha' }]);
    expect(await readHouseMinistries('h2')).toBeNull();
  });
});

describe('remoções', () => {
  it('removeResidents leva junto os quatro blocos de detalhe', async () => {
    await saveResident(resident('r1', 'Ana'));
    await saveResidentDetail('r1', 'follow_ups', [{ id: 'f1' }] as never);
    await saveResidentDetail('r1', 'receivables', [{ id: 'p1' }] as never);

    await removeResidents(['r1']);

    expect(await readResident('r1')).toBeNull();
    expect(await readResidentDetail('r1', 'follow_ups')).toBeNull();
    expect(await readResidentDetail('r1', 'receivables')).toBeNull();
  });

  it('removeResidents sem ids é no-op', async () => {
    await saveResident(resident('r1', 'Ana'));
    await removeResidents([]);
    expect(await readResident('r1')).not.toBeNull();
  });

  it('removeDetailItems tira o item de dentro do bloco, sem apagar o resto', async () => {
    await saveResidentDetail('r1', 'follow_ups', [{ id: 'f1' }, { id: 'f2' }] as never);
    await saveResidentDetail('r2', 'follow_ups', [{ id: 'f3' }] as never);
    await saveResidentDetail('r1', 'receivables', [{ id: 'f1' }] as never);

    await removeDetailItems('follow_ups', ['f1']);

    expect((await readResidentDetail('r1', 'follow_ups'))?.data).toEqual([{ id: 'f2' }]);
    expect((await readResidentDetail('r2', 'follow_ups'))?.data).toEqual([{ id: 'f3' }]);
    // Bloco de outro tipo com id homônimo não é tocado.
    expect((await readResidentDetail('r1', 'receivables'))?.data).toEqual([{ id: 'f1' }]);
  });

  it('removeDetailItems sem ids é no-op', async () => {
    await saveResidentDetail('r1', 'follow_ups', [{ id: 'f1' }] as never);
    await removeDetailItems('follow_ups', []);
    expect((await readResidentDetail('r1', 'follow_ups'))?.data).toHaveLength(1);
  });
});

describe('replaceHouseData (sincronização completa)', () => {
  it('substitui o conteúdo e preserva o carimbo de sincronização', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana'), resident('r2', 'Bento')]);
    await saveResidentDetail('r2', 'follow_ups', [{ id: 'f1' }] as never);
    await setLastSyncedAt('h1', '2026-08-14T10:00:00.000Z');

    await replaceHouseData('h1', {
      residents: [resident('r3', 'Caio')],
      details: [{ residentId: 'r3', kind: 'follow_ups', data: [{ id: 'f9' }] as never }],
      ministries: [{ id: 'm1' }] as never,
    });

    expect((await readResidentList('h1'))?.data.map((r) => r.id)).toEqual(['r3']);
    expect(await readResident('r1')).toBeNull();
    expect(await readResidentDetail('r2', 'follow_ups')).toBeNull();
    expect((await readResidentDetail('r3', 'follow_ups'))?.data).toEqual([{ id: 'f9' }]);
    expect((await readHouseMinistries('h1'))?.data).toEqual([{ id: 'm1' }]);
    expect(await lastSyncedAt('h1')).toBe('2026-08-14T10:00:00.000Z');
  });
});

describe('carimbo de sincronização', () => {
  it('guarda e devolve o syncedAt por casa', async () => {
    expect(await lastSyncedAt('h1')).toBeNull();

    await setLastSyncedAt('h1', '2026-08-14T10:00:00.000Z');
    await setLastSyncedAt('h2', '2026-08-13T10:00:00.000Z');

    expect(await lastSyncedAt('h1')).toBe('2026-08-14T10:00:00.000Z');
    expect(await lastSyncedAt('h2')).toBe('2026-08-13T10:00:00.000Z');
  });
});

describe('readStoreDump (hidratação)', () => {
  it('devolve casas, fichas, blocos e ministérios', async () => {
    await saveResidentList('h1', [resident('r2', 'Bento'), resident('r1', 'Ana')]);
    await saveResidentDetail('r1', 'consents', [{ purpose: 'IMAGE_PUBLICATION' }] as never);
    await saveHouseMinistries('h1', [{ id: 'm1' }] as never);

    const dump = await readStoreDump();

    expect(dump.houses).toHaveLength(1);
    expect(dump.houses[0].houseId).toBe('h1');
    expect(dump.houses[0].residents.map((r) => r.name)).toEqual(['Ana', 'Bento']);
    expect(dump.residents.map((entry) => entry.data.id).sort()).toEqual(['r1', 'r2']);
    expect(dump.details).toEqual([
      expect.objectContaining({ residentId: 'r1', kind: 'consents' }),
    ]);
    expect(dump.ministries).toEqual([expect.objectContaining({ houseId: 'h1' })]);
  });

  it('filho sem casa não vira casa fantasma na hidratação', async () => {
    await saveResident(resident('r1', 'Ana', null));

    const dump = await readStoreDump();

    expect(dump.houses).toEqual([]);
    expect(dump.residents).toHaveLength(1);
  });

  it('linha de detalhe com id fora do padrão é ignorada', async () => {
    const driver = createWebDriver();
    setResidentStoreDriver(driver);
    await driver.putMany('resident_details', [
      { id: 'lixo-sem-kind', houseId: null, payload: '[]', updatedAt: 1 },
      { id: detailRowId('r1', 'follow_ups'), houseId: null, payload: '[]', updatedAt: 1 },
    ]);

    const dump = await readStoreDump();

    expect(dump.details).toEqual([expect.objectContaining({ residentId: 'r1' })]);
  });
});

describe('linha corrompida no disco', () => {
  it('é tratada como ausente na leitura (o snapshot reconstrói)', async () => {
    const driver = createWebDriver();
    setResidentStoreDriver(driver);
    await driver.putMany('residents', [
      { id: 'r1', houseId: 'h1', payload: 'não é json', updatedAt: 1 },
    ]);

    expect(await readResident('r1')).toBeNull();
    expect(await readResidentList('h1')).toBeNull();
  });

  it('não impede a remoção de itens nos outros blocos', async () => {
    const driver = createWebDriver();
    setResidentStoreDriver(driver);
    await driver.putMany('resident_details', [
      { id: detailRowId('r1', 'follow_ups'), houseId: null, payload: '{quebrado', updatedAt: 1 },
      { id: detailRowId('r2', 'follow_ups'), houseId: null, payload: '[{"id":"f1"}]', updatedAt: 1 },
    ]);

    await removeDetailItems('follow_ups', ['f1']);

    expect((await readResidentDetail('r2', 'follow_ups'))?.data).toEqual([]);
    expect(await readResidentDetail('r1', 'follow_ups')).toBeNull();
  });

  it('bloco de tipo desconhecido não entra na hidratação', async () => {
    const driver = createWebDriver();
    setResidentStoreDriver(driver);
    await driver.putMany('resident_details', [
      { id: 'r1:tipo-que-nao-existe', houseId: null, payload: '[]', updatedAt: 1 },
    ]);

    expect((await readStoreDump()).details).toEqual([]);
  });
});

describe('purgeAll (LGPD)', () => {
  it('depois da purga nenhuma leitura devolve dado', async () => {
    await saveResidentList('h1', [resident('r1', 'Ana')]);
    await saveResidentDetail('r1', 'follow_ups', [{ id: 'f1' }] as never);
    await saveHouseMinistries('h1', [{ id: 'm1' }] as never);
    await setLastSyncedAt('h1', '2026-08-14T10:00:00.000Z');

    await purgeAll();

    expect(await readResidentList('h1')).toBeNull();
    expect(await readResident('r1')).toBeNull();
    expect(await readResidentDetail('r1', 'follow_ups')).toBeNull();
    expect(await readHouseMinistries('h1')).toBeNull();
    expect(await lastSyncedAt('h1')).toBeNull();
  });

  it('erro do driver propaga — purga que falha não pode ser silenciosa', async () => {
    setResidentStoreDriver({
      clearAll: jest.fn().mockRejectedValue(new Error('disco cheio')),
    } as unknown as ResidentStoreDriver);

    await expect(purgeAll()).rejects.toThrow('disco cheio');
  });
});

describe('assinatura do store', () => {
  it('avisa a UI quando o conteúdo muda e para de avisar depois do unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeResidentStore(listener);

    await saveResident(resident('r1', 'Ana'));
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    await setLastSyncedAt('h1', '2026-08-14T10:00:00.000Z');

    expect(listener).not.toHaveBeenCalled();
  });
});
