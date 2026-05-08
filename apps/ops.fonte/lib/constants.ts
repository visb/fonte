import { IncidentSeverity } from '@fonte/types';

export const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; color: string; bg: string }> = {
  [IncidentSeverity.LOW]:      { label: 'Baixa',   color: '#16a34a', bg: '#dcfce7' },
  [IncidentSeverity.MEDIUM]:   { label: 'Média',   color: '#ca8a04', bg: '#fef9c3' },
  [IncidentSeverity.HIGH]:     { label: 'Alta',    color: '#ea580c', bg: '#ffedd5' },
  [IncidentSeverity.CRITICAL]: { label: 'Crítica', color: '#dc2626', bg: '#fee2e2' },
};

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PRE_ADMISSION: { label: 'Pré-admissão', color: '#6b7280' },
  ACTIVE:        { label: 'Ativo',        color: '#16a34a' },
  DISCIPLINE:    { label: 'Disciplina',   color: '#ca8a04' },
  TEMP_LEAVE:    { label: 'Saída temp.',  color: '#2563eb' },
  DISCHARGED:    { label: 'Alta',         color: '#9333ea' },
  EVADED:        { label: 'Evasão',       color: '#dc2626' },
};
