import { FollowUpType, ResidentStatus } from '@fonte/types';

export const RESIDENT_STATUS_FILTER_OPTIONS: ResidentStatus[] = [
  ResidentStatus.PRE_ADMISSION,
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
  ResidentStatus.DISCHARGED,
  ResidentStatus.EVADED,
];

export const DEFAULT_RESIDENT_STATUS_FILTER: ResidentStatus[] = [
  ResidentStatus.ACTIVE,
];

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  [FollowUpType.ADMISSION]: 'Admissão',
  [FollowUpType.READMISSION]: 'Reintrodução',
  [FollowUpType.DISCHARGE]: 'Alta',
  [FollowUpType.EVASION]: 'Evasão',
  [FollowUpType.MINISTRY_CHANGE]: 'Mudança de ministério',
  [FollowUpType.RELATIVE_ADDED]: 'Familiar cadastrado',
  [FollowUpType.DOCUMENT_ATTACHED]: 'Documento anexado',
  [FollowUpType.MONTHLY_CONTRIBUTION]: 'Contribuição mensal',
  [FollowUpType.DISCIPLINE]: 'Disciplina',
  [FollowUpType.BEHAVIOR_ASSESSMENT]: 'Avaliação de conduta',
  [FollowUpType.PROMOTED_TO_SERVANT]: 'Tornou-se servo',
  [FollowUpType.NOTE]: 'Observação',
};
