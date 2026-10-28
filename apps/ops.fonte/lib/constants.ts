import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { IncidentType } from '@fonte/types';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Story 229: tipo da ocorrência (substituiu a severidade) — rótulo, ícone e cores. */
export const INCIDENT_TYPE_CONFIG: Record<
  IncidentType,
  { label: string; icon: IconName; iconSelected: IconName; color: string; bg: string }
> = {
  [IncidentType.POSITIVE]: {
    label: 'Positiva',
    icon: 'thumbs-up-outline',
    iconSelected: 'thumbs-up',
    color: '#16a34a',
    bg: '#dcfce7',
  },
  [IncidentType.NEGATIVE]: {
    label: 'Negativa',
    icon: 'thumbs-down-outline',
    iconSelected: 'thumbs-down',
    color: '#dc2626',
    bg: '#fee2e2',
  },
};

/** Ordem de exibição no seletor: positiva à esquerda, negativa à direita. */
export const INCIDENT_TYPES: IncidentType[] = [IncidentType.POSITIVE, IncidentType.NEGATIVE];

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PRE_ADMISSION: { label: 'Pré-admissão', color: '#6b7280' },
  ACTIVE:        { label: 'Ativo',        color: '#16a34a' },
  DISCIPLINE:    { label: 'Disciplina',   color: '#ca8a04' },
  TEMP_LEAVE:    { label: 'Saída temp.',  color: '#2563eb' },
  DISCHARGED:    { label: 'Alta',         color: '#9333ea' },
  EVADED:        { label: 'Evasão',       color: '#dc2626' },
  ARCHIVED:      { label: 'Arquivado',    color: '#6b7280' },
};
