import type { DocumentTemplate, ResidentDocument } from '@fonte/api-client';
import { isTemplateAvailableForStatus, type ResidentStatus } from '@fonte/types';

/**
 * Story 160 — templates obrigatórios que o wizard de acolhimento cobra do filho.
 * Um obrigatório que não vale para o status atual sai da conta: pela decisão 3
 * (PRE_ADMISSION é ativo) nada de razoável some daqui, mas um obrigatório
 * marcado como "só não-ativos" travaria o gate do acolhimento para sempre —
 * seria impossível assinar um documento que o backend se recusa a gerar.
 */
export function requiredTemplatesForStatus(
  templates: DocumentTemplate[],
  status: ResidentStatus | null | undefined,
): DocumentTemplate[] {
  return templates.filter(
    (t) => t.isRequired && isTemplateAvailableForStatus(t.availableFor, status),
  );
}

/** Gate "todos os documentos obrigatórios assinados" do wizard de acolhimento. */
export function allRequiredDocsSigned(
  templates: DocumentTemplate[],
  signedDocs: ResidentDocument[],
  status: ResidentStatus | null | undefined,
): boolean {
  const signed = new Map(signedDocs.map((d) => [d.templateId, d]));
  return requiredTemplatesForStatus(templates, status).every((t) => signed.get(t.id)?.signed);
}
