import { BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { ParseSpreadsheetResult } from '@fonte/types';
import { SpreadsheetImportService } from './spreadsheet-parser.service';

const FIXTURE = path.join(__dirname, '../../../test/fixtures/import-residents.xlsx');

/** Builds an .xlsx buffer in memory from a sheetName → rows map. */
async function buildWorkbook(sheets: Record<string, ExcelJS.CellValue[][]>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = wb.addWorksheet(name);
    rows.forEach((r) => ws.addRow(r));
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

describe('SpreadsheetImportService', () => {
  let service: SpreadsheetImportService;

  beforeEach(() => {
    service = new SpreadsheetImportService();
  });

  describe('parse da fixture de referência', () => {
    let result: ParseSpreadsheetResult;

    beforeAll(async () => {
      const svc = new SpreadsheetImportService();
      const buffer = fs.readFileSync(FIXTURE);
      result = await svc.parseSpreadsheet(buffer);
    });

    it('trata cada aba como casa e ignora a aba "curso biblico"', () => {
      expect(result.houses).toEqual(['Casa Um', 'Casa Dois']);
      expect(result.ignoredSheets).toEqual(['Curso Bíblico']);
      expect(result.rows.some((r) => r.houseName === 'Curso Bíblico')).toBe(false);
    });

    it('normaliza cpf (só dígitos), nome (sem acento/lowercase) e datas para ISO', () => {
      const joao = result.rows.find((r) => r.name === 'João da Silva')!;
      expect(joao.cpf).toBe('11122233344');
      expect(joao.nameNormalized).toBe('joao da silva');
      expect(joao.entryDate).toBe('2024-01-15');
      expect(joao.exitDate).toBe('2024-06-20');
      expect(joao.familyContact).toBe('998877665');

      const angela = result.rows.find((r) => r.name === 'Ângela Núñez')!;
      expect(angela.nameNormalized).toBe('angela nunez');
      // header com acento/caixa diferentes ("Data de Entrada") ainda é mapeado;
      // data em string dd/mm/yyyy é convertida para ISO.
      expect(angela.entryDate).toBe('2024-03-02');
      expect(angela.cpf).toBe('12345678909');
    });

    it('converte o histórico de contribuição em meses ISO (incl. virada de ano)', () => {
      const joao = result.rows.find((r) => r.name === 'João da Silva')!;
      expect(joao.contributionMonths).toEqual(['2024-01-01', '2024-02-01']);

      const maria = result.rows.find((r) => r.nameNormalized === 'maria jose conceicao')!;
      // MÊS 1 e MÊS 3 preenchidos, entrada em 2023-11 → nov/2023 e jan/2024.
      expect(maria.contributionMonths).toEqual(['2023-11-01', '2024-01-01']);
    });

    it('mantém linha só com nome (cpf null) e linha só com cpf (nome null)', () => {
      const nameOnly = result.rows.find((r) => r.name === 'Pedro Sem Documento')!;
      expect(nameOnly.cpf).toBeNull();
      expect(nameOnly.contributionMonths).toEqual([]);

      const cpfOnly = result.rows.find((r) => r.cpf === '00011122233')!;
      expect(cpfOnly.name).toBeNull();
      expect(cpfOnly.nameNormalized).toBeNull();
    });

    it('descarta linhas sem nome e sem cpf, contabilizando em skipped', () => {
      // rodapé "TOTAL" da Casa Um + linha vazia da Casa Dois.
      expect(result.skipped).toBe(2);
      expect(result.rows).toHaveLength(5);
    });
  });

  it('ignora variações de caixa/acento da aba curso bíblico e não conta como casa', async () => {
    const buffer = await buildWorkbook({
      'CURSO BIBLICO': [['Nome:'], ['Fulano']],
      'formados no curso bíblico': [['Nome:'], ['Beltrano']],
      Masculina: [
        ['Nome:', 'C.P.F.'],
        ['Ciclano', '111.111.111-11'],
      ],
    });
    const result = await service.parseSpreadsheet(buffer);
    expect(result.houses).toEqual(['Masculina']);
    expect(result.ignoredSheets).toEqual(['CURSO BIBLICO', 'formados no curso bíblico']);
    expect(result.rows).toHaveLength(1);
  });

  it('mapeia colunas por sinônimos de cabeçalho e parseia datas ISO em string', async () => {
    const buffer = await buildWorkbook({
      Casa: [
        ['Nome', 'CPF', 'Celular', 'Acolhimento', 'Desligamento'],
        ['Teste Um', '222.333.444-55', '4799', '2024-05-01', '2024-08-15'],
      ],
    });
    const result = await service.parseSpreadsheet(buffer);
    expect(result.rows[0]).toMatchObject({
      cpf: '22233344455',
      familyContact: '4799',
      entryDate: '2024-05-01',
      exitDate: '2024-08-15',
    });
  });

  it('conta a aba como casa mas não importa linhas quando não há cabeçalho reconhecível', async () => {
    const buffer = await buildWorkbook({
      SemCabecalho: [
        ['irrelevante', 'outra coisa'],
        ['dado solto', 'mais dado'],
      ],
    });
    const result = await service.parseSpreadsheet(buffer);
    expect(result.houses).toEqual(['SemCabecalho']);
    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toBe(0);
  });

  it('não deriva contribuições sem data de entrada', async () => {
    const buffer = await buildWorkbook({
      Casa: [
        ['Nome:', 'C.P.F.', 'MENSALIDADE MÊS 1'],
        ['Sem Entrada', '333.444.555-66', 'PAGO'],
      ],
    });
    const result = await service.parseSpreadsheet(buffer);
    expect(result.rows[0].entryDate).toBeNull();
    expect(result.rows[0].contributionMonths).toEqual([]);
  });

  it('pagamentos além da última coluna "MÊS N" contam como competências seguintes', async () => {
    const buffer = await buildWorkbook({
      Casa: [
        // Cabeçalho só até MÊS 2, mas a linha tem pagamentos nas 2 colunas seguintes
        // (planilha real: os meses continuam sendo registrados sem novo cabeçalho).
        ['Nome:', 'Chegada:', 'Telefone:', 'C.P.F.', 'Saída:', 'STATUS', 'MENSALIDADE MÊS 1', 'MENSALIDADE MÊS 2'],
        ['Pagador Longo', '2024-01-10', '999', '111.222.333-44', null, null, 'PAGO', 'PAGO', 'PAGO', 'PAGO'],
      ],
    });
    const result = await service.parseSpreadsheet(buffer);
    expect(result.rows[0].contributionMonths).toEqual([
      '2024-01-01',
      '2024-02-01',
      '2024-03-01',
      '2024-04-01',
    ]);
  });

  it('aba sem cabeçalho "MÊS N" lê o histórico da coluna G em diante', async () => {
    const buffer = await buildWorkbook({
      // Layout da aba "Tranqueira escritório" real: cabeçalho para até STATUS (F),
      // mas os pagamentos vivem em G+ mesmo assim.
      Escritorio: [
        ['Nome:', 'Chegada:', 'Telefone:', 'C.P.F.', 'Saída:', 'STATUS'],
        ['Sem Cabecalho Mes', '2024-05-21', '996', '510.482.139-00', null, 'somando', 'PAGO 500,00', 'PAGO 500,00', '', 'PAGO 500,00'],
      ],
    });
    const result = await service.parseSpreadsheet(buffer);
    // G → mês de entrada; H → mês seguinte; I vazio pulado; J → 4ª competência.
    expect(result.rows[0].contributionMonths).toEqual([
      '2024-05-01',
      '2024-06-01',
      '2024-08-01',
    ]);
  });

  it('deixa data irreconhecível como null e converte números/booleanos em texto', async () => {
    const buffer = await buildWorkbook({
      Casa: [
        ['Nome:', 'C.P.F.', 'Chegada:'],
        ['Data Ruim', 12345, 'sem data'],
      ],
    });
    const result = await service.parseSpreadsheet(buffer);
    expect(result.rows[0].cpf).toBe('12345');
    expect(result.rows[0].entryDate).toBeNull();
  });

  it('extrai texto de células rich-text, hyperlink, fórmula e data', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Casa');
    ws.addRow(['Nome:', 'C.P.F.']);
    ws.getCell('A2').value = { richText: [{ text: 'Ric' }, { text: 'ardo' }] } as ExcelJS.CellValue;
    ws.getCell('B2').value = { formula: 'A1', result: '444.555.666-77' } as ExcelJS.CellValue;
    ws.getCell('A3').value = { text: 'Fulano Link', hyperlink: 'mailto:x@y.z' } as ExcelJS.CellValue;
    ws.getCell('B3').value = '111.000.111-00';
    // Data como valor da coluna de nome → cellToString cai no ramo Date.
    ws.getCell('A4').value = new Date(Date.UTC(2024, 0, 2));
    ws.getCell('B4').value = '222.000.222-00';
    const buffer = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const result = await service.parseSpreadsheet(buffer);
    expect(result.rows[0]).toMatchObject({ name: 'Ricardo', cpf: '44455566677' });
    expect(result.rows[1].name).toBe('Fulano Link');
    expect(result.rows[2].name).toBe('2024-01-02T00:00:00.000Z');
    expect(result.rows[2].nameNormalized).toBe('2024-01-02t00:00:00.000z');
  });

  it('lança BadRequestException quando o arquivo não é um .xlsx válido', async () => {
    await expect(service.parseSpreadsheet(Buffer.from('isto não é uma planilha'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // ─── Story 121: múltiplos acolhimentos (pares repetidos de entrada/saída) ────
  describe('histórico de acolhimentos (colunas Entrada/Saída repetidas)', () => {
    it('pares repetidos → admissions ordenado por entrada; topo = mais recente', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome', 'CPF', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'],
          ['Reincidente', '111.222.333-44', '2022-01-10', '2022-09-10', '2023-03-01', '2024-01-15'],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      const row = result.rows[0];

      expect(row.admissions).toEqual([
        { entryDate: '2022-01-10', exitDate: '2022-09-10' },
        { entryDate: '2023-03-01', exitDate: '2024-01-15' },
      ]);
      // topo do resident = acolhimento mais recente (maior entryDate)
      expect(row.entryDate).toBe('2023-03-01');
      expect(row.exitDate).toBe('2024-01-15');
    });

    it('reordena por entrada quando as colunas vêm fora de ordem cronológica', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'],
          ['Fora de Ordem', '2024-05-01', '2024-08-01', '2020-01-01', '2020-06-01'],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      const row = result.rows[0];

      expect(row.admissions.map((a) => a.entryDate)).toEqual(['2020-01-01', '2024-05-01']);
      expect(row.entryDate).toBe('2024-05-01');
      expect(row.exitDate).toBe('2024-08-01');
    });

    it('um único par → admissions com 1 item (comportamento atual preservado)', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome', 'Entrada', 'Saída'],
          ['Único', '2023-02-01', '2023-11-01'],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      const row = result.rows[0];

      expect(row.admissions).toEqual([{ entryDate: '2023-02-01', exitDate: '2023-11-01' }]);
      expect(row.entryDate).toBe('2023-02-01');
      expect(row.exitDate).toBe('2023-11-01');
    });

    it('acolhimento em aberto no último par (sem saída) → exitDate null', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'],
          ['Em Aberto', '2021-01-01', '2021-07-01', '2023-01-01', null],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      const row = result.rows[0];

      expect(row.admissions).toEqual([
        { entryDate: '2021-01-01', exitDate: '2021-07-01' },
        { entryDate: '2023-01-01', exitDate: null },
      ]);
      // topo = mais recente, ainda em aberto
      expect(row.entryDate).toBe('2023-01-01');
      expect(row.exitDate).toBeNull();
    });

    it('linhas ACIMA do cabeçalho são parseadas (seção de quem já saiu, com data de saída)', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          // seção pré-cabeçalho: quem saiu, nas mesmas colunas
          ['Fulano que Saiu', '2024-06-24', '996575209', '996.575.209-59', '2024-10-24'],
          ['Nome:', 'Chegada:', 'Telefone:', 'C.P.F.:', 'Saída:'],
          ['Ativo Atual', '2025-01-10', '998877665', '111.222.333-44', null],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);

      expect(result.rows).toHaveLength(2);
      const saiu = result.rows.find((r) => r.name === 'Fulano que Saiu')!;
      expect(saiu.entryDate).toBe('2024-06-24');
      expect(saiu.exitDate).toBe('2024-10-24');
      const ativo = result.rows.find((r) => r.name === 'Ativo Atual')!;
      expect(ativo.exitDate).toBeNull();
    });

    it('mesma pessoa acima (saiu) e abaixo (ativa) do cabeçalho → linha única com histórico', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Guaraci Adams', '2023-09-26', '998016278', '018.519.799-05', '2024-10-01'],
          ['Nome:', 'Chegada:', 'Telefone:', 'C.P.F.:', 'Saída:'],
          ['Guaraci Adams', '2025-10-07', '998016278', '018.519.799-05', null],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.admissions).toEqual([
        { entryDate: '2023-09-26', exitDate: '2024-10-01' },
        { entryDate: '2025-10-07', exitDate: null },
      ]);
      // topo = acolhimento mais recente (ativo, em aberto)
      expect(row.entryDate).toBe('2025-10-07');
      expect(row.exitDate).toBeNull();
    });

    it('mesma pessoa em ABAS diferentes (saiu de uma casa, voltou em outra) → linha única; casa = acolhimento mais recente', async () => {
      const buffer = await buildWorkbook({
        'Casa Antiga': [
          // linha antiga sem CPF (acima do cabeçalho na planilha real)
          ['Vinicius Borges', '2025-10-27', null, null, '2025-11-23'],
          ['Nome:', 'Chegada:', 'Telefone:', 'C.P.F.:', 'Saída:'],
        ],
        'Casa Nova': [
          ['Nome:', 'Chegada:', 'Telefone:', 'C.P.F.:', 'Saída:'],
          ['Vinicius Borges', '2026-03-30', '999112233', '072.925.509-32', null],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);

      expect(result.rows).toHaveLength(1);
      const row = result.rows[0];
      expect(row.houseName).toBe('Casa Nova');
      expect(row.cpf).toBe('07292550932');
      expect(row.admissions).toEqual([
        { entryDate: '2025-10-27', exitDate: '2025-11-23' },
        { entryDate: '2026-03-30', exitDate: null },
      ]);
      expect(row.entryDate).toBe('2026-03-30');
      expect(row.exitDate).toBeNull();
    });

    it('nomes iguais com CPFs diferentes NÃO são fundidos (pessoas distintas)', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome:', 'Chegada:', 'C.P.F.:', 'Saída:'],
          ['José da Silva', '2024-01-01', '111.111.111-11', '2024-06-01'],
          ['José da Silva', '2025-01-01', '222.222.222-22', null],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      expect(result.rows).toHaveLength(2);
    });

    it('cabeçalho repetido no meio da aba é descartado, não vira filho', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome:', 'Chegada:', 'Saída:'],
          ['Primeiro', '2024-01-01', null],
          ['Nome:', 'Chegada:', 'Saída:'],
          ['Segundo', '2024-02-01', null],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      expect(result.rows.map((r) => r.name)).toEqual(['Primeiro', 'Segundo']);
      expect(result.skipped).toBe(1);
    });

    it('coluna "STATUS ACOLHIMENTO" não é tratada como coluna de entrada', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome:', 'Chegada:', 'Saída:', 'STATUS ACOLHIMENTO'],
          // valor com cara de data no status não pode virar acolhimento fantasma
          ['Com Status', '2024-03-01', '2024-09-01', '2024-05-05'],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      const row = result.rows[0];
      expect(row.admissions).toEqual([{ entryDate: '2024-03-01', exitDate: '2024-09-01' }]);
    });

    it('sem nenhuma data de entrada → admissions vazio e topo null', async () => {
      const buffer = await buildWorkbook({
        Casa: [
          ['Nome', 'C.P.F.', 'Entrada', 'Saída'],
          ['Sem Datas', '333.444.555-66', null, null],
        ],
      });
      const result = await service.parseSpreadsheet(buffer);
      const row = result.rows[0];

      expect(row.admissions).toEqual([]);
      expect(row.entryDate).toBeNull();
      expect(row.exitDate).toBeNull();
    });
  });
});
