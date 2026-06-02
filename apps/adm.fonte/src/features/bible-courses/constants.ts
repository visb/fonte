import type { BibleCourseClassStatus, BibleCourseEnrollmentStatus } from '@fonte/api-client';

export const CLASS_STATUS_LABELS: Record<BibleCourseClassStatus, string> = {
  PLANNED: 'Planejada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
};

export const CLASS_STATUS_BADGE: Record<BibleCourseClassStatus, string> = {
  PLANNED: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export const CLASS_STATUS_OPTIONS: { value: BibleCourseClassStatus; label: string }[] = [
  { value: 'PLANNED', label: CLASS_STATUS_LABELS.PLANNED },
  { value: 'IN_PROGRESS', label: CLASS_STATUS_LABELS.IN_PROGRESS },
  { value: 'COMPLETED', label: CLASS_STATUS_LABELS.COMPLETED },
];

export const ENROLLMENT_STATUS_LABELS: Record<BibleCourseEnrollmentStatus, string> = {
  ENROLLED: 'Matriculado',
  COMPLETED: 'Concluído',
  DROPPED: 'Desistente',
};

export const ENROLLMENT_STATUS_BADGE: Record<BibleCourseEnrollmentStatus, string> = {
  ENROLLED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  DROPPED: 'bg-amber-100 text-amber-700',
};

/** Course class lasts ~2.5 months. */
export const CLASS_DURATION_DAYS = 75;
