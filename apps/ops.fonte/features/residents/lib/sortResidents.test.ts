import { sortResidentsByEntryDesc } from './sortResidents';

const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe('sortResidentsByEntryDesc (story 222)', () => {
  it('datas diferentes → mais recente primeiro', () => {
    const list = [
      { id: 'a', name: 'Ana', entryDate: '2025-01-10' },
      { id: 'b', name: 'Bruno', entryDate: '2026-03-01' },
      { id: 'c', name: 'Caio', entryDate: '2025-12-31' },
    ];
    expect(ids(sortResidentsByEntryDesc(list))).toEqual(['b', 'c', 'a']);
  });

  it('entryDate nulo, vazio ou ausente → fim da lista', () => {
    const list = [
      { id: 'n', name: 'Nulo', entryDate: null },
      { id: 'x', name: 'Ausente' },
      { id: 'd', name: 'Datado', entryDate: '2024-05-05' },
      { id: 'v', name: 'Vazio', entryDate: '' },
      { id: 'e', name: 'Entrou', entryDate: '2026-01-01' },
    ];
    const sorted = sortResidentsByEntryDesc(list);
    expect(ids(sorted).slice(0, 2)).toEqual(['e', 'd']);
    // Os sem entrada desempatam por nome entre si.
    expect(ids(sorted).slice(2)).toEqual(['x', 'n', 'v']);
  });

  it('datas iguais → desempate por nome com acento (pt-BR)', () => {
    const list = [
      { id: '1', name: 'Otávio', entryDate: '2026-02-02' },
      { id: '2', name: 'Álvaro', entryDate: '2026-02-02' },
      { id: '3', name: 'Bento', entryDate: '2026-02-02' },
    ];
    expect(sortResidentsByEntryDesc(list).map((r) => r.name)).toEqual([
      'Álvaro',
      'Bento',
      'Otávio',
    ]);
  });

  it('mesma data e mesmo nome → desempate por id', () => {
    const list = [
      { id: 'z9', name: 'José', entryDate: '2026-02-02' },
      { id: 'a1', name: 'José', entryDate: '2026-02-02' },
      { id: 'm5', name: 'José', entryDate: '2026-02-02' },
    ];
    expect(ids(sortResidentsByEntryDesc(list))).toEqual(['a1', 'm5', 'z9']);
  });

  it('itens idênticos mantêm a posição relativa', () => {
    const first = { id: 'same', name: 'José', entryDate: '2026-02-02' };
    const second = { id: 'same', name: 'José', entryDate: '2026-02-02' };
    const sorted = sortResidentsByEntryDesc([first, second]);
    expect(sorted[0]).toBe(first);
    expect(sorted[1]).toBe(second);
  });

  it('não muta o array de entrada', () => {
    const list = [
      { id: 'a', name: 'Ana', entryDate: '2025-01-10' },
      { id: 'b', name: 'Bruno', entryDate: '2026-03-01' },
    ];
    const snapshot = [...list];
    const sorted = sortResidentsByEntryDesc(list);
    expect(list).toEqual(snapshot);
    expect(sorted).not.toBe(list);
  });

  it('lista vazia → vazia', () => {
    expect(sortResidentsByEntryDesc([])).toEqual([]);
  });
});
