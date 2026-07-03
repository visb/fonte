import { Injectable } from '@nestjs/common';
import { MatchStatus, SpreadsheetImportRow } from '@fonte/types';
import { normalizeName } from '../../common/lib/normalize';
import {
  DocxParserService,
  ParseDocxRelative,
  ParseDocxResult,
  ParseDocxResident,
} from './docx-parser.service';

/**
 * Resultado da extração de uma ficha `.docx` já cruzado com a planilha de
 * referência (story 101). Estende `ParseDocxResult` com o resultado do match e
 * os campos priorizados da planilha. Espelha o contrato `ImportPreviewResult`
 * de `@fonte/types`, mantendo aqui a tipagem forte do `resident`.
 */
export interface ImportPreviewResult extends ParseDocxResult {
  matchedHouseName: string | null;
  contributionMonths: string[];
  matchStatus: MatchStatus;
}

/** Só os dígitos de um texto (para comparar CPFs de formatos diferentes). */
function digitsOnly(text: string | null | undefined): string {
  return (text ?? '').replace(/\D/g, '');
}

/**
 * Cross-match entre a ficha `.docx` extraída e as linhas da planilha de
 * referência, e enriquecimento da ficha com os campos que a planilha é fonte de
 * verdade (data de entrada, data de saída, contato familiar e histórico de
 * contribuição). Regra de negócio — vive no service, não no controller.
 */
@Injectable()
export class ImportMatchService {
  constructor(private readonly docxParserService: DocxParserService) {}

  /**
   * Extrai a ficha (`parseDocx`) e a cruza com as linhas da planilha. O
   * `parseDocx` chama a IA (Anthropic); nos unit tests de `matchAndEnrich` ele é
   * mockado.
   */
  async parseDocxWithSpreadsheet(
    buffer: Buffer,
    rows: SpreadsheetImportRow[],
  ): Promise<ImportPreviewResult> {
    const parsed = await this.docxParserService.parseDocx(buffer);
    return this.matchAndEnrich(parsed, rows);
  }

  /**
   * Acha a linha correspondente (CPF primeiro; fallback por nome normalizado) e
   * enriquece a ficha. Puro/síncrono — não toca banco nem rede.
   */
  matchAndEnrich(parseResult: ParseDocxResult, rows: SpreadsheetImportRow[]): ImportPreviewResult {
    const resident: Partial<ParseDocxResident> = { ...parseResult.resident };
    const warnings: Record<string, string> = { ...parseResult.warnings };
    let relatives: ParseDocxRelative[] = parseResult.relatives.map((r) => ({ ...r }));

    const candidates = this.findCandidates(resident, rows);

    if (candidates.length === 0) {
      warnings.spreadsheet =
        'Nenhum filho da planilha corresponde a esta ficha. Os dados vieram apenas da ficha.';
      return {
        ...parseResult,
        resident,
        relatives,
        warnings,
        matchedHouseName: null,
        contributionMonths: [],
        matchStatus: 'unmatched',
      };
    }

    if (candidates.length > 1) {
      warnings.spreadsheet = `Mais de um filho da planilha corresponde a esta ficha (${candidates.length}). Confira e selecione o correto.`;
      return {
        ...parseResult,
        resident,
        relatives,
        warnings,
        matchedHouseName: null,
        contributionMonths: [],
        matchStatus: 'ambiguous',
      };
    }

    const row = candidates[0];

    // A planilha é fonte de verdade destes campos. Quando a ficha também trouxe
    // e diverge, mantém o valor da planilha e registra a divergência.
    if (row.entryDate) {
      if (resident.entryDate && resident.entryDate !== row.entryDate) {
        warnings.entryDate = `ficha=${resident.entryDate}, planilha=${row.entryDate}`;
      }
      resident.entryDate = row.entryDate;
    }
    if (row.exitDate) {
      if (resident.exitDate && resident.exitDate !== row.exitDate) {
        warnings.exitDate = `ficha=${resident.exitDate}, planilha=${row.exitDate}`;
      }
      resident.exitDate = row.exitDate;
    }

    relatives = this.applyFamilyContact(relatives, row.familyContact, warnings);

    return {
      ...parseResult,
      resident,
      relatives,
      warnings,
      matchedHouseName: row.houseName,
      contributionMonths: row.contributionMonths ?? [],
      matchStatus: 'matched',
    };
  }

  /**
   * Candidatas à ficha: casa por CPF (dígitos) quando ambos têm CPF; se não
   * houver casamento por CPF, tenta por nome normalizado (sem acento/caixa).
   */
  private findCandidates(
    resident: Partial<ParseDocxResident>,
    rows: SpreadsheetImportRow[],
  ): SpreadsheetImportRow[] {
    const fichaCpf = digitsOnly(resident.cpf);
    if (fichaCpf) {
      const byCpf = rows.filter((r) => r.cpf && digitsOnly(r.cpf) === fichaCpf);
      if (byCpf.length > 0) return byCpf;
    }

    const fichaName = resident.name ? normalizeName(resident.name) : '';
    if (!fichaName) return [];
    return rows.filter((r) => (r.nameNormalized ?? (r.name ? normalizeName(r.name) : '')) === fichaName);
  }

  /**
   * O contato familiar da planilha vira/atualiza um relative de contato: quando
   * há familiares na ficha, atualiza o telefone do primeiro (o contato
   * principal) e avisa se divergir; quando não há, cria um relative de contato.
   */
  private applyFamilyContact(
    relatives: ParseDocxRelative[],
    familyContact: string | null,
    warnings: Record<string, string>,
  ): ParseDocxRelative[] {
    if (!familyContact) return relatives;

    if (relatives.length === 0) {
      return [{ name: 'Contato familiar', phone: familyContact, relationship: '' }];
    }

    const [first, ...rest] = relatives;
    if (first.phone && first.phone !== familyContact) {
      warnings.familyContact = `ficha=${first.phone}, planilha=${familyContact}`;
    }
    return [{ ...first, phone: familyContact }, ...rest];
  }
}
