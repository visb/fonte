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
  SERVANT = 'SERVANT',
  RELATIVE = 'RELATIVE',
  RESIDENT = 'RESIDENT',
}

// Hierarquia espiritual do servo (role SERVANT). Independente do Role de sistema.
export enum ServantRank {
  ASPIRANTE = 'ASPIRANTE',
  CONSAGRADO = 'CONSAGRADO',
  ALIANCADO = 'ALIANCADO',
}

export enum ResidentStatus {
  PRE_ADMISSION = 'PRE_ADMISSION',
  ACTIVE = 'ACTIVE',
  DISCIPLINE = 'DISCIPLINE',
  TEMP_LEAVE = 'TEMP_LEAVE',
  DISCHARGED = 'DISCHARGED',
  EVADED = 'EVADED',
  // Adicionado pelo coordenador durante a contagem; aguarda aprovação do ADM.
  CENSUS_ADDED = 'CENSUS_ADDED',
  // Recusado pelo ADM na revisão da contagem (mantido para auditoria).
  REJECTED_CENSUS = 'REJECTED_CENSUS',
}

// Filhos fisicamente presentes na casa (contagem de ocupação).
export const PRESENT_RESIDENT_STATUSES = [
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
] as const;

export enum ProfileType {
  STAFF = 'STAFF',
  RELATIVE = 'RELATIVE',
  RESIDENT = 'RESIDENT',
}

export enum BibleCourseClassStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum BibleCourseEnrollmentStatus {
  ENROLLED = 'ENROLLED',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
}

export interface BibleClassGradeModuleColumn {
  id: string;
  name: string;
  sequence: number;
}

export interface BibleClassGradeCell {
  moduleId: string;
  examGrade: number | null;
  workGrade: number | null;
  moduleAverage: number | null;
}

export interface BibleClassGradeRow {
  enrollmentId: string;
  residentName: string;
  modules: BibleClassGradeCell[];
  average: number | null;
}

export interface BibleClassGrades {
  classId: string;
  modules: BibleClassGradeModuleColumn[];
  rows: BibleClassGradeRow[];
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
  PROMOTED_TO_SERVANT = 'PROMOTED_TO_SERVANT',
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
  collectedAmount: number | null;
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

// ─── Receivables (carnê de contribuição) ──────────────────────────────────────

export enum ReceivableStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELED = 'CANCELED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BASKET = 'BASKET',
  OTHER = 'OTHER',
}

export interface ResidentReceivable {
  id: string;
  residentId: string;
  referenceMonth: string; // YYYY-MM-01
  dueDate: string; // YYYY-MM-DD
  amount: number;
  familyInvestment: FamilyInvestment;
  paidAmount: number | null;
  paidFamilyInvestment: FamilyInvestment | null;
  mandatory: boolean;
  status: ReceivableStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  attachmentUrl: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface RegisterReceivablePaymentInput {
  paidAt: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  paidAmount?: number;
  paidFamilyInvestment?: FamilyInvestment;
  notes?: string;
}

export interface UpdateContributionPlanInput {
  familyInvestment: FamilyInvestment;
  familyInvestmentAmount?: number | null;
  contributionDueDay?: number | null;
}

export interface SetContributionExemptInput {
  exempt: boolean;
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

// ─── Notifications ────────────────────────────────────────────────────────────

export enum NotificationType {
  // ações de usuário
  ADMISSION_CREATED = 'ADMISSION_CREATED',
  PAYMENT_REGISTERED = 'PAYMENT_REGISTERED',
  INCIDENT_CREATED = 'INCIDENT_CREATED',
  RESIDENT_DISCHARGED = 'RESIDENT_DISCHARGED',
  // pedidos de aprovação (ops → adm)
  CAPACITY_CHANGE_REQUESTED = 'CAPACITY_CHANGE_REQUESTED',
  CAPACITY_CHANGE_APPROVED = 'CAPACITY_CHANGE_APPROVED',
  CAPACITY_CHANGE_REJECTED = 'CAPACITY_CHANGE_REJECTED',
  // contagem / chamada (ops → adm)
  CENSUS_RESIDENT_ADDED = 'CENSUS_RESIDENT_ADDED',
  CENSUS_CONCLUDED = 'CENSUS_CONCLUDED',
  // background workers
  RECEIVABLE_OVERDUE = 'RECEIVABLE_OVERDUE',
  ROUTINE_MISSING = 'ROUTINE_MISSING',
  REQUIRED_DOC_MISSING = 'REQUIRED_DOC_MISSING',
  // ... expandir conforme eventos cobertos
}

/** Estado de um pedido de alteração de capacidade de leitos (ops → adm). */
export enum HouseCapacityRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  recipientId: string | null;
  recipientRole: Role | null;
  houseId: string | null;
  read: boolean;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

/** Realtime payload pushed over the `notification:new` socket event. */
export type NotificationPushPayload = Notification;

