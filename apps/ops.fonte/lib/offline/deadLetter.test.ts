import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEAD_LETTER_KEY,
  MAX_DEAD_LETTER_ENTRIES,
  appendDeadLetter,
  clearDeadLetter,
  getDeadLetterSnapshot,
  listDeadLetter,
  removeDeadLetter,
  subscribeDeadLetter,
  type DeadLetterEntry,
} from './deadLetter';

function entry(overrides: Partial<DeadLetterEntry> = {}): DeadLetterEntry {
  return {
    id: 'key-1',
    mutationKey: 'storeroom/createMovement',
    label: 'Movimentação do almoxarifado',
    variables: { data: { itemId: 'i1' } },
    error: 'Quantidade indisponível.',
    failedAt: 1_700_000_000_000,
    ...overrides,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearDeadLetter();
});

describe('dead-letter', () => {
  it('append persiste no AsyncStorage e sobrevive a uma releitura', async () => {
    await appendDeadLetter(entry());

    // Releitura crua: o que vale é o disco, não o cache em memória.
    const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
    expect(JSON.parse(raw ?? '[]')).toEqual([entry()]);
    await expect(listDeadLetter()).resolves.toEqual([entry()]);
  });

  it('mantém o mais recente primeiro', async () => {
    await appendDeadLetter(entry({ id: 'a' }));
    await appendDeadLetter(entry({ id: 'b' }));

    const entries = await listDeadLetter();
    expect(entries.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('reenvio que falha de novo atualiza o item em vez de duplicar', async () => {
    await appendDeadLetter(entry({ error: 'primeira falha' }));
    await appendDeadLetter(entry({ error: 'segunda falha' }));

    const entries = await listDeadLetter();
    expect(entries).toHaveLength(1);
    expect(entries[0].error).toBe('segunda falha');
  });

  it('remove tira só o item pedido', async () => {
    await appendDeadLetter(entry({ id: 'a' }));
    await appendDeadLetter(entry({ id: 'b' }));

    await removeDeadLetter('a');

    expect((await listDeadLetter()).map((item) => item.id)).toEqual(['b']);
  });

  it('clear esvazia disco e snapshot (fim de sessão — LGPD)', async () => {
    await appendDeadLetter(entry());

    await clearDeadLetter();

    expect(await AsyncStorage.getItem(DEAD_LETTER_KEY)).toBeNull();
    expect(await listDeadLetter()).toEqual([]);
    expect(getDeadLetterSnapshot()).toEqual([]);
  });

  it('limita o tamanho da lista', async () => {
    for (let index = 0; index < MAX_DEAD_LETTER_ENTRIES + 5; index += 1) {
      await appendDeadLetter(entry({ id: `key-${index}` }));
    }

    const entries = await listDeadLetter();
    expect(entries).toHaveLength(MAX_DEAD_LETTER_ENTRIES);
    // O corte é do fim (mais antigo), nunca do começo.
    expect(entries[0].id).toBe(`key-${MAX_DEAD_LETTER_ENTRIES + 4}`);
  });

  it('avisa os assinantes a cada mudança e para depois do unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeDeadLetter(listener);

    await appendDeadLetter(entry());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toHaveLength(1);

    unsubscribe();
    await appendDeadLetter(entry({ id: 'outro' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('conteúdo corrompido no disco não derruba a leitura', async () => {
    await AsyncStorage.setItem(DEAD_LETTER_KEY, '{isso não é json');
    await expect(listDeadLetter()).resolves.toEqual([]);

    await AsyncStorage.setItem(DEAD_LETTER_KEY, '{"nao":"array"}');
    await expect(listDeadLetter()).resolves.toEqual([]);
  });

  it('appends concorrentes não se sobrescrevem', async () => {
    await Promise.all([
      appendDeadLetter(entry({ id: 'a' })),
      appendDeadLetter(entry({ id: 'b' })),
      appendDeadLetter(entry({ id: 'c' })),
    ]);

    expect((await listDeadLetter()).map((item) => item.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
