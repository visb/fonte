import { SpreadsheetImportRow } from '@fonte/types';
import { ImportMatchService } from './import-match.service';
import { ParseDocxResult } from './docx-parser.service';

/** Monta um `ParseDocxResult` mínimo com overrides. */
function docxResult(overrides: Partial<ParseDocxResult> = {}): ParseDocxResult {
  return {
    resident: {},
    relatives: [],
    warnings: {},
    houseName: 'Casa da Ficha',
    rawText: 'texto',
    photoBase64: null,
    ...overrides,
  };
}

/** Monta uma linha da planilha com overrides. */
function row(overrides: Partial<SpreadsheetImportRow> = {}): SpreadsheetImportRow {
  return {
    houseName: 'Casa Um',
    name: 'João da Silva',
    nameNormalized: 'joao da silva',
    cpf: '11122233344',
    familyContact: null,
    entryDate: null,
    exitDate: null,
    admissions: [],
    contributionMonths: [],
    ...overrides,
  };
}

describe('ImportMatchService', () => {
  let service: ImportMatchService;
  const parseDocx = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // O parseDocx chama a IA (Anthropic) — mockado aqui, nunca chamado de verdade.
    service = new ImportMatchService({ parseDocx } as never);
  });

  describe('matchAndEnrich — match', () => {
    it('casa por CPF (dígitos, ignorando formatação) e enriquece', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '111.222.333-44' } });
      const rows = [
        row({ name: 'Outro', nameNormalized: 'outro', cpf: '99988877766' }),
        row({ cpf: '11122233344', entryDate: '2024-01-10', contributionMonths: ['2024-01-01'] }),
      ];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.matchStatus).toBe('matched');
      expect(result.matchedHouseName).toBe('Casa Um');
      expect(result.resident.entryDate).toBe('2024-01-10');
      expect(result.contributionMonths).toEqual(['2024-01-01']);
    });

    it('casa por nome normalizado quando a ficha não tem CPF', () => {
      const parse = docxResult({ resident: { name: 'João da Silva', cpf: null } });
      const rows = [row({ cpf: null, entryDate: '2024-02-01' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.matchStatus).toBe('matched');
      expect(result.resident.entryDate).toBe('2024-02-01');
    });

    it('acento e caixa não impedem o match por nome', () => {
      const parse = docxResult({ resident: { name: '  JOÃO   DA Sílva ', cpf: null } });
      const rows = [row({ cpf: null, nameNormalized: 'joao da silva' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.matchStatus).toBe('matched');
      expect(result.matchedHouseName).toBe('Casa Um');
    });

    it('propaga contributionMonths da planilha no resultado', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344' } });
      const rows = [row({ contributionMonths: ['2023-05-01', '2023-06-01'] })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.contributionMonths).toEqual(['2023-05-01', '2023-06-01']);
    });
  });

  describe('matchAndEnrich — sem match ou ambíguo', () => {
    it('múltiplos candidatos → ambiguous, sem enriquecer, com warning', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344', entryDate: '2020-01-01' } });
      const rows = [
        row({ cpf: '11122233344', entryDate: '2024-01-01' }),
        row({ cpf: '11122233344', entryDate: '2024-02-01', houseName: 'Casa Dois' }),
      ];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.matchStatus).toBe('ambiguous');
      expect(result.matchedHouseName).toBeNull();
      expect(result.contributionMonths).toEqual([]);
      // não enriquece: mantém o valor da ficha
      expect(result.resident.entryDate).toBe('2020-01-01');
      expect(result.warnings.spreadsheet).toBeDefined();
    });

    it('sem correspondência → unmatched, warning, resultado = só a ficha', () => {
      const parse = docxResult({ resident: { name: 'Maria', cpf: '55566677788', entryDate: '2019-01-01' } });
      const rows = [row({ name: 'João', nameNormalized: 'joao', cpf: '11122233344' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.matchStatus).toBe('unmatched');
      expect(result.matchedHouseName).toBeNull();
      expect(result.contributionMonths).toEqual([]);
      expect(result.resident.entryDate).toBe('2019-01-01');
      expect(result.warnings.spreadsheet).toBeDefined();
    });

    it('ficha sem nome e sem cpf → unmatched', () => {
      const parse = docxResult({ resident: { name: null, cpf: null } });
      const rows = [row()];

      expect(service.matchAndEnrich(parse, rows).matchStatus).toBe('unmatched');
    });
  });

  describe('matchAndEnrich — prioridade da planilha', () => {
    it('divergência de entryDate → mantém a planilha e registra warning', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344', entryDate: '2021-09-14' } });
      const rows = [row({ entryDate: '2023-08-03' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.resident.entryDate).toBe('2023-08-03');
      expect(result.warnings.entryDate).toBe('ficha=2021-09-14, planilha=2023-08-03');
    });

    it('exitDate da planilha entra no resident', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344' } });
      const rows = [row({ exitDate: '2024-12-31' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.resident.exitDate).toBe('2024-12-31');
    });

    it('divergência de exitDate → mantém a planilha e registra warning', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344', exitDate: '2024-01-01' } });
      const rows = [row({ exitDate: '2024-12-31' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.resident.exitDate).toBe('2024-12-31');
      expect(result.warnings.exitDate).toBe('ficha=2024-01-01, planilha=2024-12-31');
    });

    it('propaga o histórico de acolhimentos da planilha para preview.resident (story 121)', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344' } });
      const admissions = [
        { entryDate: '2022-01-10', exitDate: '2022-09-10' },
        { entryDate: '2023-03-01', exitDate: '2024-01-15' },
      ];
      const rows = [row({ admissions, entryDate: '2023-03-01', exitDate: '2024-01-15' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.resident.admissions).toEqual(admissions);
      // topo do resident acompanha o mais recente vindo da planilha
      expect(result.resident.entryDate).toBe('2023-03-01');
      expect(result.resident.exitDate).toBe('2024-01-15');
    });

    it('sem histórico (admissions vazio) não define resident.admissions', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344' } });
      const rows = [row({ admissions: [], entryDate: '2024-01-10' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.resident.admissions).toBeUndefined();
    });

    it('casa por nome quando a linha não tem nameNormalized pré-computado', () => {
      const parse = docxResult({ resident: { name: 'João da Silva', cpf: null } });
      const rows = [row({ cpf: null, nameNormalized: null, name: 'JOÃO DA SILVA', entryDate: '2024-03-01' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.matchStatus).toBe('matched');
      expect(result.resident.entryDate).toBe('2024-03-01');
    });

    it('familyContact da planilha cria um relative de contato quando a ficha não tem', () => {
      const parse = docxResult({ resident: { name: 'João', cpf: '11122233344' }, relatives: [] });
      const rows = [row({ familyContact: '(47)98403-7330' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.relatives).toHaveLength(1);
      expect(result.relatives[0].phone).toBe('(47)98403-7330');
    });

    it('familyContact da planilha atualiza o telefone do primeiro relative e avisa divergência', () => {
      const parse = docxResult({
        resident: { name: 'João', cpf: '11122233344' },
        relatives: [{ name: 'Carla', phone: '(41)99999-0000', relationship: 'mãe' }],
      });
      const rows = [row({ familyContact: '(47)98403-7330' })];

      const result = service.matchAndEnrich(parse, rows);

      expect(result.relatives).toHaveLength(1);
      expect(result.relatives[0].name).toBe('Carla');
      expect(result.relatives[0].phone).toBe('(47)98403-7330');
      expect(result.warnings.familyContact).toBe('ficha=(41)99999-0000, planilha=(47)98403-7330');
    });
  });

  describe('parseDocxWithSpreadsheet', () => {
    it('chama parseDocx e cruza com as rows', async () => {
      parseDocx.mockResolvedValue(docxResult({ resident: { name: 'João', cpf: '11122233344' } }));
      const rows = [row({ entryDate: '2024-01-10' })];

      const result = await service.parseDocxWithSpreadsheet(Buffer.from('docx'), rows);

      expect(parseDocx).toHaveBeenCalledWith(expect.any(Buffer));
      expect(result.matchStatus).toBe('matched');
      expect(result.resident.entryDate).toBe('2024-01-10');
    });
  });
});
