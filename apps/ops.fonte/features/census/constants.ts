import { ResidentStatus } from '@fonte/types';

/** Story 218 — status de quem pode ser reacolhido, como o operador lê na lista. */
export const LOOKUP_STATUS_LABELS: Partial<Record<ResidentStatus, string>> = {
  [ResidentStatus.DISCHARGED]: 'Alta',
  [ResidentStatus.EVADED]: 'Evasão',
  [ResidentStatus.ARCHIVED]: 'Arquivado',
};

/** Decisão 4: entrar no fluxo de adicionar filho exige rede. */
export const ADD_RESIDENT_OFFLINE_MESSAGE =
  'Sem conexão: para adicionar um filho é preciso estar online, para checar se ele já passou pela comunidade.';
