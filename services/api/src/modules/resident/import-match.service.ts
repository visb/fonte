import { Injectable } from '@nestjs/common';
import { ImportAdmission, MatchStatus, SpreadsheetImportRow } from '@fonte/types';
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

    const fichaEntryDates = this.readFichaEntryDates(resident);
    if (fichaEntryDates.length > 1) {
      // Ficha com mais de uma data de acolhimento (readmissão): une as entradas
      // da ficha com os pares da planilha e fecha os acolhimentos anteriores com
      // as datas de saída da planilha — vira histórico de múltiplos internamentos.
      const merged = this.mergeFichaAdmissions(fichaEntryDates, row.admissions ?? []);
      resident.admissions = merged;
      const latest = merged[merged.length - 1];
      resident.entryDate = latest.entryDate;
      resident.exitDate = latest.exitDate;
      const previousOpen = merged.slice(0, -1).some((a) => !a.exitDate);
      warnings.entryDate = previousOpen
        ? `A ficha traz ${merged.length} datas de acolhimento e o histórico foi montado, mas não foi encontrada data de saída na planilha para acolhimento anterior. Confira o histórico e informe a saída.`
        : `A ficha traz ${merged.length} datas de acolhimento. O histórico foi montado com as datas de saída da planilha — confira as datas.`;
    } else {
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

      // Histórico de acolhimentos da planilha (story 121): a planilha é a fonte de
      // verdade. Propaga os pares entrada→saída para o commit criar os `Admission`.
      if (row.admissions?.length) {
        resident.admissions = row.admissions;
      }
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
   * Datas de acolhimento extraídas da ficha quando ela traz mais de uma
   * (readmissões). A IA devolve strings — valida o formato ISO e devolve
   * ordenado ascendente, sem duplicatas.
   */
  private readFichaEntryDates(resident: Partial<ParseDocxResident>): string[] {
    const raw = resident.entryDates;
    if (!Array.isArray(raw)) return [];
    const valid = raw.filter(
      (d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d),
    );
    return [...new Set(valid)].sort();
  }

  /**
   * Une as datas de entrada da ficha com os pares da planilha e fecha cada
   * acolhimento com a data de saída da planilha que cai no intervalo
   * [entrada, próxima entrada). Acolhimento sem saída correspondente fica em
   * aberto (`exitDate: null`) — tipicamente o mais recente.
   */
  private mergeFichaAdmissions(
    fichaEntryDates: string[],
    rowAdmissions: ImportAdmission[],
  ): ImportAdmission[] {
    const entries = [
      ...new Set([...fichaEntryDates, ...rowAdmissions.map((a) => a.entryDate)]),
    ].sort();
    const exits = rowAdmissions
      .map((a) => a.exitDate)
      .filter((d): d is string => d !== null)
      .sort();
    return entries.map((entryDate, index) => {
      const next = entries[index + 1];
      const exitDate =
        exits.find((e) => e >= entryDate && (next === undefined || e < next)) ?? null;
      return { entryDate, exitDate };
    });
  }

  /**
   * O contato familiar da planilha vira/atualiza relatives de contato. A célula
   * pode trazer VÁRIOS números separados por "/" ou "|" (ex.:
   * "998009667 / 996317707") — cada número é um contato distinto, nunca um único
   * telefone concatenado. Quando há familiares na ficha, o primeiro número
   * atualiza o telefone do contato principal (avisando se divergir) e os demais
   * números ainda não presentes viram novos relatives; quando não há, cada número
   * cria um relative de contato.
   */
  private applyFamilyContact(
    relatives: ParseDocxRelative[],
    familyContact: string | null,
    warnings: Record<string, string>,
  ): ParseDocxRelative[] {
    if (!familyContact) return relatives;

    const contacts = this.splitFamilyContacts(familyContact);
    if (contacts.length === 0) return relatives;

    // Sem familiares na ficha: cada número da planilha vira um relative de contato.
    if (relatives.length === 0) {
      return contacts.map((phone) => ({ name: 'Contato familiar', phone, relationship: '' }));
    }

    const [first, ...rest] = relatives;
    const [primary, ...extras] = contacts;

    // Primeiro número → telefone do contato principal; avisa se divergir do que a
    // ficha trouxe (comparação por dígitos, ignorando formatação).
    if (first.phone && digitsOnly(first.phone) !== digitsOnly(primary)) {
      warnings.familyContact = `ficha=${first.phone}, planilha=${familyContact}`;
    }
    const updated: ParseDocxRelative[] = [{ ...first, phone: primary }, ...rest];

    // Números adicionais da planilha ainda não representados entre os familiares
    // viram novos relatives de contato (nunca concatenados num telefone só).
    const known = new Set(updated.map((r) => digitsOnly(r.phone)).filter(Boolean));
    for (const phone of extras) {
      const digits = digitsOnly(phone);
      if (known.has(digits)) continue;
      known.add(digits);
      updated.push({ name: 'Contato familiar', phone, relationship: '' });
    }
    return updated;
  }

  /**
   * Divide o contato familiar da planilha nos números individuais, separados por
   * "/" ou "|". Descarta pedaços sem dígitos (separadores soltos, texto vazio).
   */
  private splitFamilyContacts(familyContact: string): string[] {
    return familyContact
      .split(/[/|]/)
      .map((part) => part.trim())
      .filter((part) => digitsOnly(part).length > 0);
  }
}
