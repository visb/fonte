import mammoth from 'mammoth';
import { FamilyInvestment, Gender, MaritalStatus } from '@fonte/types';
import type { ResidentFormData } from './residentSchema';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DraftRelative {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  include: boolean;
}

export interface ParseResult {
  resident: Partial<ResidentFormData>;
  relatives: DraftRelative[];
  /** Fields where parser found a value but it may need manual review */
  warnings: Partial<Record<keyof ResidentFormData, string>>;
  /** House name extracted (needs to be matched to houseId by caller) */
  houseName: string;
  rawText: string;
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export async function parseDocx(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  return parseText(text);
}

export function parseText(text: string): ParseResult {
  const resident: Partial<ResidentFormData> = {};
  const warnings: Partial<Record<keyof ResidentFormData, string>> = {};

  // ── name ──────────────────────────────────────────────────────────────────
  const nameMatch = text.match(/NOME\s*:\s*([^\n]+)/i);
  if (nameMatch) {
    // Strip trailing numeric artifacts from table cell borders
    const raw = nameMatch[1].trim().replace(/\s+\d[\d\s]*$/, '').trim();
    if (raw) resident.name = raw;
  }

  // ── entryDate ─────────────────────────────────────────────────────────────
  const entryMatch = text.match(/DATA\s+DO\s+ACOLHIMENTO\s*:\s*([\d]{1,2}\/[\d]{1,2}(?:\/[\d]{2,4})?)/i);
  if (entryMatch) {
    const parsed = parseBRDate(entryMatch[1]);
    if (parsed) resident.entryDate = parsed;
  }

  // ── birthDate ─────────────────────────────────────────────────────────────
  const birthMatch = text.match(/DATA\s+DE\s+NASCIMENTO\s*:\s*([\d]{1,2}\/[\d]{1,2}\/[\d]{2,4})/i);
  if (birthMatch) {
    const parsed = parseBRDate(birthMatch[1]);
    if (parsed) resident.birthDate = parsed;
  }

  // ── gender ────────────────────────────────────────────────────────────────
  const genderMatch = text.match(/SEXO\s*:\s*(\w+)/i);
  if (genderMatch) {
    const v = genderMatch[1].toLowerCase();
    if (v.includes('masc') || v.includes('male') || v === 'm') {
      resident.gender = Gender.MALE;
    } else if (v.includes('fem') || v === 'f') {
      resident.gender = Gender.FEMALE;
    }
  }

  // ── cpf ───────────────────────────────────────────────────────────────────
  const cpfMatch = text.match(/CPF\s*:\s*([\d]{3}[\s.\-]*[\d]{3}[\s.\-]*[\d]{3}[\s.\-]*[\d]{2})/i);
  if (cpfMatch) {
    resident.cpf = formatCPF(cpfMatch[1].replace(/\D/g, ''));
  }

  // ── address ───────────────────────────────────────────────────────────────
  const addrMatch = text.match(/ENDERE[ÇC]O\s*:\s*([^\n]+?)(?=\s*TELEFONE|\s*CONTATO|\n)/i);
  if (addrMatch) {
    const addr = addrMatch[1].trim();
    if (addr) resident.address = addr;
  }

  // ── maritalStatus ─────────────────────────────────────────────────────────
  const maritalMatch = text.match(/ESTADO\s+CIVIL\s*:\s*(\w+)/i);
  if (maritalMatch) {
    const v = maritalMatch[1].toLowerCase();
    if (v.includes('solt') || v.includes('single')) {
      resident.maritalStatus = MaritalStatus.SINGLE;
    } else if (v.includes('cas') || v.includes('marr')) {
      resident.maritalStatus = MaritalStatus.MARRIED;
    } else if (v.includes('divor') || v.includes('separ')) {
      resident.maritalStatus = MaritalStatus.DIVORCED;
    }
  }

  // ── children ──────────────────────────────────────────────────────────────
  const childrenMatch = text.match(/FILHOS\s*:\s*(\d+)/i);
  if (childrenMatch) {
    resident.children = childrenMatch[1];
  }

  // ── occupation ────────────────────────────────────────────────────────────
  const occMatch = text.match(/PROF(?:ISS[ÃA]O)?\s*:\s*([^\n]+?)(?=\s*RESP|\s*INFORMA|\n)/i);
  if (occMatch) {
    const occ = occMatch[1].trim();
    if (occ) resident.occupation = occ;
  }

  // ── Section: INFORMAÇÕES NECESSÁRIAS ─────────────────────────────────────
  // Extract the numbered items 1-7

  // 1. Education
  const eduMatch = extractNumberedItem(text, 1);
  if (eduMatch) resident.education = eduMatch;

  // 2. Health issues
  const healthMatch = extractNumberedItem(text, 2);
  if (healthMatch) {
    const lower = healthMatch.toLowerCase();
    if (lower === 'não' || lower === 'nao' || lower === 'não.' || lower === 'n') {
      // "Não" means no health issues — leave empty (better than filling "Não")
    } else if (lower === 'sim' || lower === 's') {
      warnings.healthIssues = 'A ficha indica que há problema de saúde. Preencha o detalhe manualmente.';
    } else {
      resident.healthIssues = healthMatch;
    }
  }

  // 3. Continuous medication
  const medMatch = extractNumberedItem(text, 3);
  if (medMatch) {
    const lower = medMatch.toLowerCase();
    if (lower === 'não' || lower === 'nao' || lower === 'não.' || lower === 'n') {
      // No medication — leave empty
    } else if (lower === 'sim' || lower === 's') {
      warnings.continuousMedication = 'A ficha indica uso de medicação. Preencha o nome do medicamento manualmente.';
    } else {
      resident.continuousMedication = medMatch;
    }
  }

  // 4. Religion
  const religionMatch = extractNumberedItem(text, 4);
  if (religionMatch) {
    // Remove the sub-question "QUAL?" if it crept in
    resident.religion = religionMatch.replace(/^\s*QUAL\s*\??/i, '').trim() || undefined;
  }

  // 5. Addiction
  const addictionMatch = extractNumberedItem(text, 5);
  if (addictionMatch) {
    resident.addiction = addictionMatch;
  }

  // 6. Weight / Height
  const whMatch = extractNumberedItem(text, 6);
  if (whMatch) {
    // Expect format: "1,92 / 80 kl" or "1,92 / 80 kg" or "92 / 80" etc.
    const parsed = parseWeightHeight(whMatch);
    if (parsed.height) resident.height = String(parsed.height);
    if (parsed.weight) resident.weight = String(parsed.weight);
  }

  // 7. Family investment
  const investMatch = extractNumberedItem(text, 7);
  // Also try the standalone "INVENSTIMENTO" field (typo in original form)
  const investAlt = text.match(/INVE[NSS]+TIMENTO[^:]*:\s*([^\n]+)/i)?.[1]?.trim();
  const investRaw = investMatch || investAlt || '';
  if (investRaw) {
    const fi = parseInvestment(investRaw);
    if (fi) resident.familyInvestment = fi;
  }

  // ── houseName ─────────────────────────────────────────────────────────────
  const houseMatch = text.match(/FAR[AÁ]\s+O\s+TRATAMENTO\s+NA\s+FONTE\s*:\s*([^\n]+)/i);
  const houseName = houseMatch ? houseMatch[1].trim() : '';

  // ── relatives from phone field ────────────────────────────────────────────
  const phoneFieldMatch = text.match(/TELEFONE[^:]*:\s*([^\n]+)/i);
  const relatives = phoneFieldMatch ? parsePhones(phoneFieldMatch[1]) : [];

  return {
    resident,
    relatives,
    warnings,
    houseName,
    rawText: text,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the answer for numbered item N in "INFORMAÇÕES NECESSÁRIAS" block */
function extractNumberedItem(text: string, n: number): string | undefined {
  // Match: "N." or "N -" at start, capture until next numbered item or end of section
  const next = n + 1;
  const pattern = new RegExp(
    `${n}\\s*\\.\\s*[^?\\n]+\\?\\s*([^\\n]+?)(?=\\s*${next}\\s*[.\\-]|\\s*FARÁ|\\s*RESPONS|\\s*PARA\\s+USO|$)`,
    'is',
  );
  const m = text.match(pattern);
  if (!m) return undefined;
  const value = m[1].trim();
  return value || undefined;
}

/** Parse Brazilian date "DD/MM/YYYY" or "DD/MM/YY" → "YYYY-MM-DD" */
function parseBRDate(str: string): string | undefined {
  const parts = str.split('/');
  if (parts.length < 2) return undefined;
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  let year = parts[2] ?? '';
  if (!year) return undefined;
  if (year.length === 2) {
    year = Number(year) > 30 ? `19${year}` : `20${year}`;
  }
  const d = new Date(`${year}-${month}-${day}`);
  if (isNaN(d.getTime())) return undefined;
  return `${year}-${month}-${day}`;
}

/** Format 11-digit string to "000.000.000-00" */
function formatCPF(digits: string): string {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Parse "1,92 / 80 kl" → { height: 192, weight: 80 } */
function parseWeightHeight(str: string): { height?: number; weight?: number } {
  // Try "H / W" pattern
  const m = str.match(/([\d][,.][\d]+)\s*[/\|\\]\s*(\d+)/);
  if (m) {
    const heightRaw = m[1].replace(',', '.');
    const h = parseFloat(heightRaw);
    const height = h < 3 ? Math.round(h * 100) : Math.round(h); // 1.92 → 192, or 192 → 192
    const weight = parseInt(m[2], 10);
    return { height, weight };
  }
  return {};
}

/** Map investment text to FamilyInvestment enum */
function parseInvestment(raw: string): FamilyInvestment | undefined {
  const lower = raw.toLowerCase().replace(/\s/g, '');
  if (lower.includes('social')) return FamilyInvestment.SOCIAL;
  // Extract numeric part
  const num = parseFloat(raw.replace(',', '.').replace(/[^\d.]/g, ''));
  if (isNaN(num)) return undefined;
  if (num >= 700) return FamilyInvestment.PAYMENT_700;
  if (num >= 500) return FamilyInvestment.BASKET_500;
  if (num > 0) return FamilyInvestment.NEGOTIATED;
  return undefined;
}

/**
 * Parse relatives from the phone field.
 * Input example: "(47)984037330 Carla (mãe) / (41)99651834 Fernando"
 * Returns array of DraftRelative.
 */
function parsePhones(raw: string): DraftRelative[] {
  // Split on " / " or " | " separators
  const segments = raw.split(/\s*[\/|]\s*/);
  const results: DraftRelative[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Try to extract phone: (DD)NNNNNNNNN or (DD) NNNNNN-NNNN
    const phoneMatch = trimmed.match(/\((\d{2})\)\s*([\d\s\-]+)/);
    if (!phoneMatch) continue;

    const ddd = phoneMatch[1];
    const number = phoneMatch[2].replace(/\D/g, '');
    const phone = `(${ddd})${number.slice(0, 5)}-${number.slice(5)}`;

    // Rest after phone is name + optional relationship in parens
    const rest = trimmed.replace(phoneMatch[0], '').trim();
    const relMatch = rest.match(/\(([^)]+)\)/);
    const relationship = relMatch ? capitalizeFirst(relMatch[1].trim()) : '';
    const name = rest.replace(/\([^)]+\)/g, '').trim();

    if (!name && !phone) continue;

    results.push({
      id: crypto.randomUUID(),
      name: name || 'Familiar',
      phone: phone,
      relationship,
      include: true,
    });
  }

  return results;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
