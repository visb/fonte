import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ImportAdmission, ParseSpreadsheetResult, SpreadsheetImportRow } from '@fonte/types';
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

/** Colunas de valor único por linha (não repetem: nome, cpf, contato). */
type SingleColumnKey = 'name' | 'cpf' | 'familyContact';

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
  columns: Partial<Record<SingleColumnKey, number>>;
  /**
   * Colunas de entrada/saída em ordem de coluna. A planilha pode repetir os
   * pares (Entrada 1/Saída 1, Entrada 2/Saída 2, ...); pareamos por índice para
   * montar o histórico de acolhimentos (story 121).
   */
  entryDateColumns: number[];
  exitDateColumns: number[];
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

    // Funde a MESMA pessoa repetida — inclusive ENTRE abas (saiu de uma casa e
    // voltou em outra): sem isso o cross-match acharia dois candidatos (ambíguo)
    // ou casaria só a linha nova, perdendo a saída registrada na aba antiga.
    return { rows: this.mergeDuplicatePeople(rows), houses, skipped, ignoredSheets };
  }

  /**
   * Encontra a linha de cabeçalho da aba (a primeira que contém a coluna "nome")
   * e mapeia cada coluna conhecida. Retorna `null` se nenhuma linha de cabeçalho
   * for encontrada.
   */
  private resolveColumns(sheet: ExcelJS.Worksheet): (SheetColumns & { headerRow: number }) | null {
    let result: (SheetColumns & { headerRow: number }) | null = null;
    const singleKeys: SingleColumnKey[] = ['name', 'cpf', 'familyContact'];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (result) return;
      const columns: Partial<Record<SingleColumnKey, number>> = {};
      const entryDateColumns: number[] = [];
      const exitDateColumns: number[] = [];
      const contributionColumns: number[] = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = normalizeHeader(cellToString(cell.value));
        if (!header) return;
        // "STATUS ACOLHIMENTO" contém "acolhimento" mas não é coluna de data —
        // sem este guard ela entraria em entryDateColumns e desalinharia os pares.
        if (header.includes('status')) return;
        // Entrada/saída podem repetir (pares de acolhimento): coleta TODAS as
        // colunas que casam, em ordem de coluna, para parear por índice depois.
        if (HEADER_ALIASES.entryDate.some((a) => header.includes(a))) {
          entryDateColumns.push(colNumber);
          return;
        }
        if (HEADER_ALIASES.exitDate.some((a) => header.includes(a))) {
          exitDateColumns.push(colNumber);
          return;
        }
        for (const key of singleKeys) {
          if (columns[key] === undefined && HEADER_ALIASES[key].some((a) => header.includes(a))) {
            columns[key] = colNumber;
            return;
          }
        }
        if (CONTRIBUTION_HEADER.test(header)) contributionColumns.push(colNumber);
      });
      if (columns.name !== undefined) {
        result = { columns, entryDateColumns, exitDateColumns, contributionColumns, headerRow: rowNumber };
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
      // Só a linha do CABEÇALHO não é dado. As linhas ACIMA dele também são
      // filhos: a planilha real lista quem já saiu no TOPO da aba, antes do
      // cabeçalho, nas mesmas colunas — é onde vivem as datas de saída.
      if (rowNumber === layout.headerRow) return;

      const name = this.readText(row, layout.columns.name);

      // Cabeçalho repetido no meio/fim da aba ("Nome:") não é um filho.
      if (normalizeHeader(name) === 'nome') {
        skipped += 1;
        return;
      }

      const cpf = digitsOnly(this.readText(row, layout.columns.cpf));

      // Linha sem nome E sem cpf (rodapé, total, linha em branco): descarta.
      if (!name && !cpf) {
        skipped += 1;
        return;
      }

      // Pares entrada→saída da linha, ordenados por entrada (asc). O topo do
      // resident é o acolhimento mais recente (último); as contribuições contam
      // a partir do primeiro acolhimento (mais antigo).
      const admissions = this.readAdmissions(row, layout.entryDateColumns, layout.exitDateColumns);
      const mostRecent = admissions.length ? admissions[admissions.length - 1] : null;
      const earliestEntry = admissions.length ? admissions[0].entryDate : null;
      rows.push({
        houseName,
        name: name || null,
        nameNormalized: name ? normalizeName(name) : null,
        cpf: cpf || null,
        familyContact: this.readText(row, layout.columns.familyContact) || null,
        entryDate: mostRecent?.entryDate ?? null,
        exitDate: mostRecent?.exitDate ?? null,
        admissions,
        contributionMonths: this.readContributions(row, layout.contributionColumns, earliestEntry),
      });
    });

    return { rows, skipped };
  }

  /**
   * A planilha real lista o MESMO filho mais de uma vez quando ele saiu e
   * voltou: a linha antiga (acima do cabeçalho, com data de saída — às vezes em
   * OUTRA aba/casa) e a linha atual (em aberto). Funde as linhas da mesma
   * pessoa — CPF quando ambos têm; senão nome normalizado — numa só: os
   * acolhimentos se somam (o topo passa a ser o mais recente), as contribuições
   * se unem e a casa passa a ser a do acolhimento mais recente. Nomes iguais
   * com CPFs diferentes são pessoas distintas e não são fundidos.
   */
  private mergeDuplicatePeople(rows: SpreadsheetImportRow[]): SpreadsheetImportRow[] {
    const merged: SpreadsheetImportRow[] = [];
    const byKey = new Map<string, SpreadsheetImportRow>();

    for (const row of rows) {
      const keys = [row.cpf, row.nameNormalized].filter((k): k is string => !!k);
      const target = keys.map((k) => byKey.get(k)).find((t) => t !== undefined);
      const sameCpfs = !target?.cpf || !row.cpf || target.cpf === row.cpf;

      if (!target || !sameCpfs) {
        for (const k of keys) if (!byKey.has(k)) byKey.set(k, row);
        merged.push(row);
        continue;
      }

      const targetLatest = target.admissions[target.admissions.length - 1];
      const rowLatest = row.admissions[row.admissions.length - 1];
      // A casa da linha do acolhimento mais recente é onde a pessoa está hoje.
      if (rowLatest && (!targetLatest || rowLatest.entryDate > targetLatest.entryDate)) {
        target.houseName = row.houseName;
      }
      target.admissions = mergeAdmissionLists(target.admissions, row.admissions);
      const latest = target.admissions[target.admissions.length - 1];
      target.entryDate = latest?.entryDate ?? target.entryDate;
      target.exitDate = latest ? latest.exitDate : target.exitDate;
      target.name = target.name ?? row.name;
      target.nameNormalized = target.nameNormalized ?? row.nameNormalized;
      target.cpf = target.cpf ?? row.cpf;
      target.familyContact = target.familyContact ?? row.familyContact;
      target.contributionMonths = [
        ...new Set([...target.contributionMonths, ...row.contributionMonths]),
      ].sort();
      for (const k of keys) if (!byKey.has(k)) byKey.set(k, target);
    }

    return merged;
  }

  /**
   * Pareia as colunas de entrada com as de saída por índice, montando o
   * histórico de acolhimentos (story 121). Uma coluna de entrada sem valor não
   * gera acolhimento; a saída correspondente pode faltar (acolhimento em aberto,
   * tipicamente o mais recente) → `exitDate: null`. Ordena por `entryDate` asc.
   */
  private readAdmissions(
    row: ExcelJS.Row,
    entryColumns: number[],
    exitColumns: number[],
  ): ImportAdmission[] {
    const admissions: ImportAdmission[] = [];
    entryColumns.forEach((entryCol, index) => {
      const entryDate = toIsoDate(this.readCell(row, entryCol));
      if (!entryDate) return;
      const exitDate = toIsoDate(this.readCell(row, exitColumns[index]));
      admissions.push({ entryDate, exitDate });
    });
    admissions.sort((a, b) => a.entryDate.localeCompare(b.entryDate));
    return admissions;
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

/** Une listas de acolhimentos, deduplicando pela entrada (prefere a com saída). */
function mergeAdmissionLists(a: ImportAdmission[], b: ImportAdmission[]): ImportAdmission[] {
  const byEntry = new Map<string, ImportAdmission>();
  for (const adm of [...a, ...b]) {
    const existing = byEntry.get(adm.entryDate);
    if (!existing || (!existing.exitDate && adm.exitDate)) byEntry.set(adm.entryDate, adm);
  }
  return [...byEntry.values()].sort((x, y) => x.entryDate.localeCompare(y.entryDate));
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
