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
});
