import { IncidentCategory } from '@fonte/types';

/** Story 230: labels pt-BR das categorias (o contrato não carrega texto de UI). */
export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  [IncidentCategory.AGGRESSION]: 'Agressão/briga',
  [IncidentCategory.DISRESPECT]: 'Desrespeito/desobediência',
  [IncidentCategory.EVASION]: 'Evasão ou tentativa',
  [IncidentCategory.SUBSTANCE_USE]: 'Uso de substância',
  [IncidentCategory.ACTIVITY_REFUSAL]: 'Recusa de atividade/ministério',
  [IncidentCategory.PROPERTY_DAMAGE]: 'Dano ao patrimônio',
  [IncidentCategory.HEALTH]: 'Saúde/mal-estar',
  [IncidentCategory.GOOD_BEHAVIOR]: 'Bom comportamento',
  [IncidentCategory.HELPING_OTHERS]: 'Ajuda ao próximo',
  [IncidentCategory.ACTIVITY_HIGHLIGHT]: 'Destaque em atividade/ministério',
  [IncidentCategory.SPIRITUAL_LIFE]: 'Vida espiritual',
  [IncidentCategory.TREATMENT_PROGRESS]: 'Superação/progresso no tratamento',
  [IncidentCategory.OTHER]: 'Outros',
};

export const INCIDENT_NO_CATEGORY_LABEL = 'Sem categoria';

/**
 * Label exibido no card/acompanhamento. `null`/ausente (ocorrência anterior à
 * story 230 ou cache persistido antes dela) e valor desconhecido viram
 * "Sem categoria".
 */
export function incidentCategoryLabel(category: string | null | undefined): string {
  return INCIDENT_CATEGORY_LABELS[category as IncidentCategory] ?? INCIDENT_NO_CATEGORY_LABEL;
}
