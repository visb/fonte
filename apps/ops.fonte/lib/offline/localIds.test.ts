import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOCAL_ID_MAP_KEY,
  LOCAL_ID_PREFIX,
  MAX_LOCAL_ID_ENTRIES,
  UnresolvedLocalIdError,
  clearLocalIds,
  createLocalId,
  forgetLocalId,
  isLocalId,
  isUnresolvedLocalIdError,
  rememberLocalId,
  resolveLocalId,
} from './localIds';
import { outboxRetry } from './outbox';

beforeEach(async () => {
  await AsyncStorage.clear();
  // O módulo mantém cache em memória: zerar entre os testes é o que garante
  // que cada caso leia do disco de verdade.
  await clearLocalIds();
  await AsyncStorage.clear();
});

describe('id local', () => {
  it('gera id prefixado e reconhecível', () => {
    const id = createLocalId();

    expect(id.startsWith(LOCAL_ID_PREFIX)).toBe(true);
    expect(isLocalId(id)).toBe(true);
    expect(createLocalId()).not.toBe(id);
  });

  it('id do servidor não é confundido com local', () => {
    expect(isLocalId('9f0d5b5e-1f6c-4c3a-9c1a-6f9f9a6b7c8d')).toBe(false);
    expect(isLocalId(undefined)).toBe(false);
    expect(isLocalId(42)).toBe(false);
  });
});

describe('resolução no envio', () => {
  it('id normal passa direto (movimentação comum não muda de comportamento)', async () => {
    await expect(resolveLocalId('item-real')).resolves.toBe('item-real');
  });

  it('depois do cadastro subir, a movimentação sai com o id real', async () => {
    const localId = createLocalId();

    await rememberLocalId(localId, 'item-real');

    await expect(resolveLocalId(localId)).resolves.toBe('item-real');
  });

  it('o mapeamento sobrevive ao restart do app (fica no disco)', async () => {
    const localId = createLocalId();
    await rememberLocalId(localId, 'item-real');

    const raw = await AsyncStorage.getItem(LOCAL_ID_MAP_KEY);

    expect(JSON.parse(raw!)).toEqual({ [localId]: 'item-real' });
  });

  it('item que nunca subiu falha com motivo próprio — nunca envia `local:` ao backend', async () => {
    const localId = createLocalId();

    await expect(resolveLocalId(localId)).rejects.toBeInstanceOf(UnresolvedLocalIdError);
  });

  it('essa falha não é tratada como rede: a fila não tenta para sempre', () => {
    const error = new UnresolvedLocalIdError('local:x');

    expect(isUnresolvedLocalIdError(error)).toBe(true);
    // Sem `response`, a classificação padrão diria "rede" e repetiria eterno.
    expect(outboxRetry(0, error)).toBe(false);
  });

  it('cadastro recusado limpa o mapeamento pendente', async () => {
    const localId = createLocalId();
    await rememberLocalId(localId, 'item-real');

    await forgetLocalId(localId);

    await expect(resolveLocalId(localId)).rejects.toBeInstanceOf(UnresolvedLocalIdError);
  });

  it('esquecer id que não é local ou não existe não quebra nada', async () => {
    await expect(forgetLocalId('item-real')).resolves.toBeUndefined();
    await expect(forgetLocalId(createLocalId())).resolves.toBeUndefined();
  });
});

describe('higiene do mapa', () => {
  it('id que não é local não entra no mapa', async () => {
    await rememberLocalId('item-real', 'outro');
    await rememberLocalId(createLocalId(), '');

    expect(await AsyncStorage.getItem(LOCAL_ID_MAP_KEY)).toBeNull();
  });

  it('descarta os mais antigos ao passar do teto', async () => {
    const first = createLocalId();
    await rememberLocalId(first, 'real-0');
    for (let index = 1; index <= MAX_LOCAL_ID_ENTRIES; index += 1) {
      await rememberLocalId(createLocalId(), `real-${index}`);
    }

    const map = JSON.parse((await AsyncStorage.getItem(LOCAL_ID_MAP_KEY))!);

    expect(Object.keys(map)).toHaveLength(MAX_LOCAL_ID_ENTRIES);
    expect(map[first]).toBeUndefined();
  });

  /**
   * O mapa vive em cache de memória; para exercitar a leitura do disco é preciso
   * um módulo novo, como acontece quando o app **abre** (restart do operador).
   */
  function afterRestart(stored: string | null) {
    let localIds!: typeof import('./localIds');
    let storage!: typeof AsyncStorage;
    jest.isolateModules(() => {
      const storageModule = require('@react-native-async-storage/async-storage');
      storage = storageModule.default ?? storageModule;
      localIds = require('./localIds');
    });
    return {
      localIds,
      seed: () =>
        stored === null
          ? storage.removeItem(LOCAL_ID_MAP_KEY)
          : storage.setItem(LOCAL_ID_MAP_KEY, stored),
    };
  }

  it('no restart do app o mapeamento gravado antes continua valendo', async () => {
    const { localIds, seed } = afterRestart(JSON.stringify({ 'local:abc': 'item-real' }));
    await seed();

    await expect(localIds.resolveLocalId('local:abc')).resolves.toBe('item-real');
  });

  it('conteúdo corrompido no disco não derruba o envio', async () => {
    const { localIds, seed } = afterRestart('{isso não é json');
    await seed();

    await expect(localIds.resolveLocalId('item-real')).resolves.toBe('item-real');
    await expect(localIds.resolveLocalId('local:abc')).rejects.toBeDefined();
  });

  it('conteúdo com formato inesperado é tratado como mapa vazio', async () => {
    const { localIds, seed } = afterRestart('["local:abc"]');
    await seed();

    await expect(localIds.resolveLocalId('local:abc')).rejects.toBeDefined();
  });

  it('sem nada gravado começa vazio', async () => {
    const { localIds, seed } = afterRestart(null);
    await seed();

    await expect(localIds.resolveLocalId('item-real')).resolves.toBe('item-real');
  });

  it('fim de sessão apaga o mapa (LGPD/limpeza da story 168)', async () => {
    const localId = createLocalId();
    await rememberLocalId(localId, 'item-real');

    await clearLocalIds();

    expect(await AsyncStorage.getItem(LOCAL_ID_MAP_KEY)).toBeNull();
    await expect(resolveLocalId(localId)).rejects.toBeInstanceOf(UnresolvedLocalIdError);
  });
});
