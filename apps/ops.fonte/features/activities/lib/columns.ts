import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { ACTIVITY_COLUMNS } from '@/features/activities/constants';

export interface ActivityColumnData {
  status: ActivityStatus;
  title: string;
  data: Activity[];
}

/**
 * Distribui as atividades pelas colunas de `ACTIVITY_COLUMNS`, na ordem delas.
 * Toda coluna aparece, mesmo vazia (story 208, decisão 3).
 */
export function groupActivitiesByStatus(activities: Activity[]): ActivityColumnData[] {
  return ACTIVITY_COLUMNS.map(({ status, title }) => ({
    status,
    title,
    data: activities.filter((a) => a.status === status),
  }));
}

/**
 * Aba inicial: a primeira coluna, na ordem, que tem itens. Tudo vazio abre em
 * Rascunhos, onde fica o quick-add (decisão 5).
 */
export function initialActivityTab(columns: ActivityColumnData[]): ActivityStatus {
  return columns.find((c) => c.data.length > 0)?.status ?? ActivityStatus.DRAFT;
}
