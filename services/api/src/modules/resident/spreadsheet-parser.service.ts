import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ParseSpreadsheetResult, SpreadsheetImportRow } from '@fonte/types';
import { normalizeName } from '../../common/lib/normalize';

/**
 * Aba a ignorar: a planilha de referência traz uma aba de curso bíblico que não
 * representa uma casa/unidade. Casamos pelo nome normalizado (sem acento, caixa
 * baixa) contendo "curso biblico", cobrindo "Curso Bíblico", "CURSO BIBLICO",
 * "formados no curso bíblico", etc.
 */
const IGNORED_SHEET_MARKER = 'curso biblico';

/** Colunas esperadas por linha, mapeadas por variação de cabeçalho (normalizado). */
type ColumnKey = 'name' | 'cpf' | 'familyContact' | 'entryDate' | 'exitDate';

/**
 * Sinônimos de cabeçalho aceitos por coluna. Comparados contra o cabeçalho
 * normalizado (sem acento, caixa baixa, sem pontuação de borda). O primeiro
 * sinônimo que o cabeçalho da célula *contém* define a coluna.
 */
const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  name: ['nome'],
  cpf: ['cpf', 'c.p.f', 'cpf/mf'],
  familyContact: ['contato', 'telefone', 'celular'],
  entryDate: ['data de entrada', 'data entrada', 'entrada', 'chegada', 'acolhimento', 'admissao'],
  exitDate: ['data de saida', 'data saida', 'saida', 'desligamento'],
};

/** Cabeçalho de coluna de contribuição, ex.: "MENSALIDADE MÊS 1", "MÊS 2". */
const CONTRIBUTION_HEADER = /(?:mensalidade\s*)?mes\s*\d+/;

interface SheetColumns {
  columns: Partial<Record<ColumnKey, number>>;
  /** Colunas de contribuição em ordem cronológica (mês 1, mês 2, ...). */
  contributionColumns: number[];
}

@Injectable()
export class SpreadsheetImportService {
  private readonly logger = new Logger(SpreadsheetImportService.name);

  /**
   * Faz o parse da planilha de referência (.xlsx): cada aba é uma casa, cada
   * linha é um filho. Stateless — não persiste nada. Retorna as linhas
   * normalizadas prontas para o cross-match (story 102) e para alimentar as
   * contribuições retroativas (story 103).
   */
  async parseSpreadsheet(buffer: Buffer): Promise<ParseSpreadsheetResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch (err) {
      this.logger.error(`Falha ao ler a planilha: ${(err as Error).message}`);
      throw new BadRequestException('Não foi possível ler a planilha. Verifique se o arquivo é um .xlsx válido.');
    }

    const rows: SpreadsheetImportRow[] = [];
    const houses: string[] = [];
    const ignoredSheets: string[] = [];
    let skipped = 0;

    for (const sheet of workbook.worksheets) {
      const houseName = sheet.name.trim();
      if (normalizeName(houseName).includes(IGNORED_SHEET_MARKER)) {
        ignoredSheets.push(houseName);
        continue;
      }

      const layout = this.resolveColumns(sheet);
      if (!layout) {
        // Aba sem cabeçalho reconhecível (nome). Ainda conta como casa, sem linhas.
        this.logger.warn(`Aba "${houseName}" sem cabeçalho reconhecível — nenhuma linha importada.`);
        houses.push(houseName);
        continue;
      }

      houses.push(houseName);
      const parsed = this.parseSheetRows(sheet, houseName, layout);
      rows.push(...parsed.rows);
      skipped += parsed.skipped;
    }

    return { rows, houses, skipped, ignoredSheets };
  }

  /**
   * Encontra a linha de cabeçalho da aba (a primeira que contém a coluna "nome")
   * e mapeia cada coluna conhecida. Retorna `null` se nenhuma linha de cabeçalho
   * for encontrada.
   */
  private resolveColumns(sheet: ExcelJS.Worksheet): (SheetColumns & { headerRow: number }) | null {
    let result: (SheetColumns & { headerRow: number }) | null = null;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (result) return;
      const columns: Partial<Record<ColumnKey, number>> = {};
      const contributionColumns: number[] = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = normalizeHeader(cellToString(cell.value));
        if (!header) return;
        for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]) {
          if (columns[key] === undefined && aliases.some((a) => header.includes(a))) {
            columns[key] = colNumber;
            return;
          }
        }
        if (CONTRIBUTION_HEADER.test(header)) contributionColumns.push(colNumber);
      });
      if (columns.name !== undefined) {
        result = { columns, contributionColumns, headerRow: rowNumber };
      }
    });
    return result;
  }

  private parseSheetRows(
    sheet: ExcelJS.Worksheet,
    houseName: string,
    layout: SheetColumns & { headerRow: number },
  ): { rows: SpreadsheetImportRow[]; skipped: number } {
    const rows: SpreadsheetImportRow[] = [];
    let skipped = 0;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= layout.headerRow) return;

      const name = this.readText(row, layout.columns.name);
      const cpf = digitsOnly(this.readText(row, layout.columns.cpf));

      // Linha sem nome E sem cpf (rodapé, total, linha em branco): descarta.
      if (!name && !cpf) {
        skipped += 1;
        return;
      }

      const entryDate = toIsoDate(this.readCell(row, layout.columns.entryDate));
      rows.push({
        houseName,
        name: name || null,
        nameNormalized: name ? normalizeName(name) : null,
        cpf: cpf || null,
        familyContact: this.readText(row, layout.columns.familyContact) || null,
        entryDate,
        exitDate: toIsoDate(this.readCell(row, layout.columns.exitDate)),
        contributionMonths: this.readContributions(row, layout.contributionColumns, entryDate),
      });
    });

    return { rows, skipped };
  }

  /**
   * Cada coluna de contribuição ("MÊS N") preenchida representa a competência
   * N-ésima a partir do mês de entrada. Sem data de entrada não há como derivar
   * as competências, então a lista fica vazia.
   */
  private readContributions(row: ExcelJS.Row, columns: number[], entryDate: string | null): string[] {
    if (!entryDate || columns.length === 0) return [];
    const base = new Date(`${entryDate}T00:00:00Z`);
    const months: string[] = [];
    columns.forEach((col, index) => {
      if (!this.readText(row, col)) return;
      const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + index, 1));
      months.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`);
    });
    return months;
  }

  private readCell(row: ExcelJS.Row, col: number | undefined): ExcelJS.CellValue {
    if (col === undefined) return null;
    return row.getCell(col).value;
  }

  private readText(row: ExcelJS.Row, col: number | undefined): string {
    return cellToString(this.readCell(row, col)).trim();
  }
}

/** Extrai texto de qualquer forma de valor de célula do ExcelJS. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join('');
    if (obj.text !== undefined && obj.text !== null) return String(obj.text);
    if (obj.result !== undefined && obj.result !== null) return String(obj.result);
  }
  return '';
}

/** Normaliza um cabeçalho: sem acento, caixa baixa, sem pontuação e espaços de borda. */
function normalizeHeader(text: string): string {
  return normalizeName(text).replace(/[:.]+$/g, '').trim();
}

function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Converte uma célula de data em ISO `YYYY-MM-DD`. Aceita `Date` (célula de data
 * do Excel, lida em UTC), `YYYY-MM-DD` e `DD/MM/YYYY`. Retorna `null` quando
 * vazia ou irreconhecível.
 */
function toIsoDate(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }

  const text = cellToString(value).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${pad2(Number(br[2]))}-${pad2(Number(br[1]))}`;

  return null;
}
