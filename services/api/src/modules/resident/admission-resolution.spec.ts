import {
  AdmissionWindow,
  resolveAdmissionIdForMonth,
  resolveCurrentAdmissionId,
  sortAdmissionsByEntryDateAsc,
  sortAdmissionsByEntryDateDesc,
} from './admission-resolution';

function adm(
  id: string,
  entryDate: string | null,
  exitDate: string | null = null,
  createdAt = '2026-01-01T00:00:00Z',
): AdmissionWindow {
  return { id, entryDate, exitDate, createdAt };
}

describe('sortAdmissionsByEntryDateDesc', () => {
  it('ordena por entrada decrescente, ignorando a ordem de criação', () => {
    const antigo = adm('antigo', '2025-08-01', '2025-02-10', '2026-07-20T00:00:00Z');
    const atual = adm('atual', '2026-07-17', null, '2026-07-10T00:00:00Z');

    expect(sortAdmissionsByEntryDateDesc([antigo, atual]).map((a) => a.id)).toEqual([
      'atual',
      'antigo',
    ]);
  });

  it('acolhimento sem entrada vai para o fim (NULLS LAST)', () => {
    const semData = adm('sem-data', null, null, '2026-12-01T00:00:00Z');
    const comData = adm('com-data', '2020-01-01');

    expect(sortAdmissionsByEntryDateDesc([semData, comData]).map((a) => a.id)).toEqual([
      'com-data',
      'sem-data',
    ]);
  });

  it('empate de entrada desempata pelo created_at mais recente', () => {
    const antigo = adm('a', '2026-01-01', null, '2026-01-01T00:00:00Z');
    const recente = adm('b', '2026-01-01', null, '2026-05-01T00:00:00Z');

    expect(sortAdmissionsByEntryDateDesc([antigo, recente]).map((a) => a.id)).toEqual(['b', 'a']);
  });

  it('aceita Date e trata created_at ausente/inválido como o mais antigo', () => {
    const comDate = {
      id: 'date',
      entryDate: new Date('2026-03-01'),
      exitDate: null,
      createdAt: new Date('2026-04-01'),
    };
    const semCreated = { id: 'sem', entryDate: '2026-03-01', exitDate: null, createdAt: 'xxx' };

    expect(sortAdmissionsByEntryDateDesc([semCreated, comDate]).map((a) => a.id)).toEqual([
      'date',
      'sem',
    ]);
  });

  it('ordena lista embaralhada com entrada nula e sem created_at', () => {
    const list: AdmissionWindow[] = [
      { id: 'meio', entryDate: '2024-01-01', exitDate: null, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'sem-entrada', entryDate: null, exitDate: null },
      { id: 'topo', entryDate: '2026-01-01', exitDate: null, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'base', entryDate: '2020-01-01', exitDate: null },
    ];
    expect(sortAdmissionsByEntryDateDesc(list).map((a) => a.id)).toEqual([
      'topo',
      'meio',
      'base',
      'sem-entrada',
    ]);
  });

  it('não muta o array recebido', () => {
    const list = [adm('a', '2020-01-01'), adm('b', '2026-01-01')];
    sortAdmissionsByEntryDateDesc(list);
    expect(list.map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('sortAdmissionsByEntryDateAsc', () => {
  it('ordena do mais antigo ao mais recente, com nulos no fim', () => {
    const list = [adm('b', '2026-01-01'), adm('sem', null), adm('a', '2020-01-01')];
    expect(sortAdmissionsByEntryDateAsc(list).map((x) => x.id)).toEqual(['a', 'b', 'sem']);
  });

  it('empate de entrada desempata pelo created_at mais antigo', () => {
    const list = [
      adm('novo', '2026-01-01', null, '2026-05-01T00:00:00Z'),
      adm('velho', '2026-01-01', null, '2026-01-01T00:00:00Z'),
    ];
    expect(sortAdmissionsByEntryDateAsc(list).map((x) => x.id)).toEqual(['velho', 'novo']);
  });

  it('ordena lista embaralhada com entrada nula e sem created_at', () => {
    const list: AdmissionWindow[] = [
      { id: 'meio', entryDate: '2024-01-01', exitDate: null, createdAt: '2024-01-01T00:00:00Z' },
      { id: 'sem-entrada', entryDate: null, exitDate: null },
      { id: 'topo', entryDate: '2026-01-01', exitDate: null, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'base', entryDate: '2020-01-01', exitDate: null },
    ];
    expect(sortAdmissionsByEntryDateAsc(list).map((a) => a.id)).toEqual([
      'base',
      'meio',
      'topo',
      'sem-entrada',
    ]);
  });
});

describe('resolveCurrentAdmissionId', () => {
  it('devolve o acolhimento de maior entrada', () => {
    expect(
      resolveCurrentAdmissionId([adm('antigo', '2025-08-01'), adm('atual', '2026-07-17')]),
    ).toBe('atual');
  });

  it('devolve null sem acolhimentos', () => {
    expect(resolveCurrentAdmissionId([])).toBeNull();
  });
});

describe('resolveAdmissionIdForMonth', () => {
  it('9a — competência dentro da janela entrada→saída cai na admissão certa', () => {
    const admissions = [adm('a1', '2024-01-01', '2024-12-31'), adm('a2', '2026-01-01')];
    expect(resolveAdmissionIdForMonth(admissions, '2024-06-01')).toBe('a1');
    expect(resolveAdmissionIdForMonth(admissions, '2026-03-01')).toBe('a2');
  });

  it('9a — a competência do próprio mês da saída ainda pertence ao acolhimento', () => {
    const admissions = [adm('a1', '2024-01-01', '2024-06-30')];
    expect(resolveAdmissionIdForMonth(admissions, '2024-06-01')).toBe('a1');
  });

  it('a competência do MÊS da entrada já pertence ao novo acolhimento', () => {
    // Entrada dia 17: comparar dia a dia mandaria a competência do dia 1 para o
    // acolhimento anterior — o defeito que a story conserta.
    const admissions = [adm('a1', '2025-08-01', '2025-02-10'), adm('a2', '2026-07-17')];
    expect(resolveAdmissionIdForMonth(admissions, '2026-07-01')).toBe('a2');
  });

  it('9b — competência ENTRE dois acolhimentos pertence ao que a antecede', () => {
    const admissions = [adm('a1', '2024-01-01', '2024-06-30'), adm('a2', '2026-01-01')];
    expect(resolveAdmissionIdForMonth(admissions, '2025-03-01')).toBe('a1');
  });

  it('9c — competência anterior à primeira entrada cai no acolhimento mais antigo', () => {
    const admissions = [adm('a2', '2026-01-01'), adm('a1', '2024-01-01', '2024-06-30')];
    expect(resolveAdmissionIdForMonth(admissions, '2023-05-01')).toBe('a1');
  });

  it('9d — filho sem acolhimento devolve null', () => {
    expect(resolveAdmissionIdForMonth([], '2026-01-01')).toBeNull();
  });

  it('admissão em aberto captura tudo a partir da entrada', () => {
    const admissions = [adm('aberta', '2026-01-01', null)];
    expect(resolveAdmissionIdForMonth(admissions, '2026-01-01')).toBe('aberta');
    expect(resolveAdmissionIdForMonth(admissions, '2030-12-01')).toBe('aberta');
  });

  it('9a — saída ANTERIOR à entrada é dado ruim e vira janela aberta (caso real)', () => {
    // Retrato do Marcelo: acolhimento 1 entrou em ago/25 com saída gravada em
    // fev/25. Confiar na saída jogaria as 6 competências para o acolhimento 2.
    const admissions = [adm('a1', '2025-08-01', '2025-02-10'), adm('a2', '2026-07-17')];
    for (const month of [
      '2025-08-01', '2025-09-01', '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01',
    ]) {
      expect(resolveAdmissionIdForMonth(admissions, month)).toBe('a1');
    }
    expect(resolveAdmissionIdForMonth(admissions, '2026-08-01')).toBe('a2');
  });

  it('admissão sem entrada nunca captura competência, mas serve de fallback', () => {
    const admissions = [adm('sem-data', null), adm('com-data', '2026-01-01')];
    expect(resolveAdmissionIdForMonth(admissions, '2026-05-01')).toBe('com-data');
    // Competência anterior a toda entrada → mais antigo por entrada (NULLS LAST).
    expect(resolveAdmissionIdForMonth(admissions, '2020-05-01')).toBe('com-data');
    expect(resolveAdmissionIdForMonth([adm('so-nulo', null)], '2020-05-01')).toBe('so-nulo');
  });

  it('empate de entrada resolve pelo acolhimento registrado primeiro', () => {
    const admissions = [
      adm('novo', '2026-01-01', null, '2026-05-01T00:00:00Z'),
      adm('velho', '2026-01-01', null, '2026-01-01T00:00:00Z'),
    ];
    expect(resolveAdmissionIdForMonth(admissions, '2026-02-01')).toBe('velho');
    // Ordem invertida no payload não muda o resultado.
    expect(resolveAdmissionIdForMonth([...admissions].reverse(), '2026-02-01')).toBe('velho');
  });

  it('com 3+ acolhimentos abertos vence o de maior entrada, em qualquer ordem de payload', () => {
    const admissions = [
      adm('a', '2020-01-01'),
      adm('c', '2024-01-01'),
      adm('b', '2022-01-01'),
    ];
    expect(resolveAdmissionIdForMonth(admissions, '2026-02-01')).toBe('c');
    expect(resolveAdmissionIdForMonth([...admissions].reverse(), '2026-02-01')).toBe('c');
  });

  it('acolhimento sem created_at participa do desempate como o mais antigo', () => {
    const admissions: AdmissionWindow[] = [
      { id: 'com-created', entryDate: '2026-01-01', exitDate: null, createdAt: '2026-05-01T00:00:00Z' },
      { id: 'sem-created', entryDate: '2026-01-01', exitDate: null },
    ];
    expect(resolveAdmissionIdForMonth(admissions, '2026-02-01')).toBe('sem-created');
  });

  it('competência inválida devolve null', () => {
    expect(resolveAdmissionIdForMonth([adm('a1', '2026-01-01')], null as never)).toBeNull();
  });
});
