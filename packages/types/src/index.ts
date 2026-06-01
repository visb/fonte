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

// ─── Family Investment ────────────────────────────────────────────────────────

export enum FamilyInvestment {
  BASKET_500 = 'BASKET_500',
  PAYMENT_700 = 'PAYMENT_700',
  SOCIAL = 'SOCIAL',
  NEGOTIATED = 'NEGOTIATED',
}

// ─── Follow Up ───────────────────────────────────────────────────────────────

export enum FollowUpType {
  ADMISSION = 'ADMISSION',
  READMISSION = 'READMISSION',
  DISCHARGE = 'DISCHARGE',
  EVASION = 'EVASION',
  MINISTRY_CHANGE = 'MINISTRY_CHANGE',
  RELATIVE_ADDED = 'RELATIVE_ADDED',
  DOCUMENT_ATTACHED = 'DOCUMENT_ATTACHED',
  MONTHLY_CONTRIBUTION = 'MONTHLY_CONTRIBUTION',
  DISCIPLINE = 'DISCIPLINE',
  BEHAVIOR_ASSESSMENT = 'BEHAVIOR_ASSESSMENT',
  NOTE = 'NOTE',
}

export enum FollowUpAccessLevel {
  ALL = 'ALL',
  ADMINISTRATION = 'ADMINISTRATION',
}

export interface ResidentFollowUp {
  id: string;
  residentId: string;
  date: string;
  type: FollowUpType;
  description: string | null;
  accessLevel: FollowUpAccessLevel;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Contributions Report ─────────────────────────────────────────────────────

export interface ContributionReportItem {
  residentId: string;
  residentName: string;
  houseId: string;
  houseName: string;
  familyInvestment: FamilyInvestment;
  expectedAmount: number;
  paid: boolean;
  paidAt: string | null;
}

export interface ContributionsReportResponse {
  month: string;
  items: ContributionReportItem[];
  totalResidents: number;
  totalPaid: number;
  totalPending: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
}

export interface GetContributionsReportParams {
  month: string; // YYYY-MM
  houseId?: string;
}

// ─── Supply Room ─────────────────────────────────────────────────────────────

export enum SupplyRoomCategory {
  CLEANING = 'CLEANING',
  HYGIENE = 'HYGIENE',
  PPE = 'PPE',
  OFFICE = 'OFFICE',
  OTHER = 'OTHER',
}

// ─── Street Sales ─────────────────────────────────────────────────────────────

export enum StreetSaleType {
  BREAD = 'BREAD',
  PIZZA = 'PIZZA',
}

export interface StreetSale {
  id: string;
  houseId: string;
  houseName: string;
  registeredById: string;
  date: string;
  type: StreetSaleType;
  quantity: number;
  amountPix: number;
  amountCash: number;
  amountCard: number;
  totalAmount: number;
  createdAt: string;
}

export interface StreetSalesReportPeriod {
  period: string;
  totalPix: number;
  totalCash: number;
  totalCard: number;
  totalAmount: number;
  totalQuantity: number;
}

export interface StreetSalesReportByHouse {
  houseId: string;
  houseName: string;
  totalPix: number;
  totalCash: number;
  totalCard: number;
  totalAmount: number;
  totalQuantity: number;
}

export interface StreetSalesReportResponse {
  type: StreetSaleType;
  weeklyTotals: StreetSalesReportPeriod[];
  monthlyTotals: StreetSalesReportPeriod[];
  byHouse: StreetSalesReportByHouse[];
  currentPeriodTotal: number;
  previousPeriodTotal: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

