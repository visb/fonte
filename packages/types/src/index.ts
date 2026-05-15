// ─── Resident Session ─────────────────────────────────────────────────────────

export interface ResidentUsageSession {
  secondsUsed: number;
  limitSeconds: number;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export enum MessageStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export enum WishlistStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ─── Support Groups ───────────────────────────────────────────────────────────

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export enum Role {
  ADMIN = 'ADMIN',
  COORDINATOR = 'COORDINATOR',
  OPERATOR = 'OPERATOR',
  RELATIVE = 'RELATIVE',
  RESIDENT = 'RESIDENT',
}

export enum ResidentStatus {
  PRE_ADMISSION = 'PRE_ADMISSION',
  ACTIVE = 'ACTIVE',
  DISCIPLINE = 'DISCIPLINE',
  TEMP_LEAVE = 'TEMP_LEAVE',
  DISCHARGED = 'DISCHARGED',
  EVADED = 'EVADED',
}

export enum ProfileType {
  STAFF = 'STAFF',
  RELATIVE = 'RELATIVE',
  RESIDENT = 'RESIDENT',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum MovementType {
  IN = 'IN',
  OUT = 'OUT',
}

// ─── Staff Permissions ─────────────────────────────────────────────────────────

export enum StaffPermissionType {
  MODERATE_MESSAGES = 'MODERATE_MESSAGES',
  SEND_MESSAGES_TO_FAMILIES = 'SEND_MESSAGES_TO_FAMILIES',
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export enum TimerResetFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
}

