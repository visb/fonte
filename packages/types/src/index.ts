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

// ─── Payables (contas a pagar — story 47) ──────────────────────────────────────

export enum PayableStatus {
  OPEN = 'OPEN',
  PAID = 'PAID',
}

export enum PayableCategory {
  UTILITIES = 'UTILITIES',
  SUPPLIES = 'SUPPLIES',
  MAINTENANCE = 'MAINTENANCE',
  PAYROLL = 'PAYROLL',
  TAXES = 'TAXES',
  OTHER = 'OTHER',
}

export interface Payable {
  id: string;
  description: string;
  /** Valor em centavos (padrão do repo). */
  amount: number;
  dueDate: string;
  category: PayableCategory;
  supplier: string | null;
  status: PayableStatus;
  paidAt: string | null;
  notes: string | null;
  /** URL do comprovante/boleto anexado (null quando sem anexo). */
  attachmentUrl: string | null;
  /** Nome original do arquivo anexado, para exibição. */
  attachmentName: string | null;
  /** Derivado em runtime: dueDate < hoje && status === OPEN. Não persistido. */
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayablesSummary {
  /** Total em aberto (status OPEN), em centavos. */
  totalOpen: number;
  /** Total pago (status PAID), em centavos. */
  totalPaid: number;
  /** Total vencido (OPEN && dueDate < hoje), em centavos. */
  totalOverdue: number;
  countOpen: number;
  countPaid: number;
  countOverdue: number;
}

export interface CreatePayableInput {
  description: string;
  amount: number;
  dueDate: string;
  category: PayableCategory;
  supplier?: string | null;
  notes?: string | null;
}

export type UpdatePayableInput = Partial<CreatePayableInput>;

export interface PayPayableInput {
  paidAt?: string;
}

export interface ListPayablesParams {
  status?: PayableStatus;
  category?: PayableCategory;
  from?: string;
  to?: string;
}

export interface PayablesSummaryParams {
  from?: string;
  to?: string;
}

// ─── Activities (board Kanban) ──────────────────────────────────────────────────

export enum ActivityStatus {
  DRAFT = 'DRAFT',
  REQUESTED = 'REQUESTED',
  TODO = 'TODO',
  DOING = 'DOING',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
}

/** Resumo de casa carregado na listagem de atividades. */
export interface ActivityHouseRef {
  id: string;
  name: string;
}

/** Resumo do staff responsável carregado na listagem de atividades. */
export interface ActivityStaffRef {
  id: string;
  name: string;
  userId: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  houseId: string | null;
  house: ActivityHouseRef | null;
  responsibleStaffId: string | null;
  responsible: ActivityStaffRef | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityInput {
  title: string;
  description?: string | null;
  houseId?: string | null;
  status?: ActivityStatus;
  responsibleStaffId?: string | null;
}

export interface UpdateActivityInput {
  title?: string;
  description?: string | null;
  houseId?: string | null;
  responsibleStaffId?: string | null;
}

export interface ChangeActivityStatusInput {
  status: ActivityStatus;
  responsibleStaffId?: string | null;
}

export interface ListActivitiesParams {
  houseId?: string;
  status?: ActivityStatus;
  responsibleStaffId?: string;
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

// ─── Associados (faturamento/cobrança recorrente) ───────────────────────────────

/** Status do associado, derivado da assinatura. PENDING ao cadastrar (story 37). */
export enum AssociateStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
}

/** Status da assinatura recorrente no gateway (comportamento na story 38). */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
}

/** Status de uma cobrança (adesão ou recorrente) (comportamento na story 38). */
export enum ChargeStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export interface AssociateSubscription {
  id: string;
  associateId: string;
  gatewaySubscriptionId: string | null;
  netAmount: number;
  feeAmount: number;
  grossAmount: number;
  status: SubscriptionStatus;
  startedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssociateCharge {
  id: string;
  associateId: string;
  subscriptionId: string | null;
  gatewayChargeId: string | null;
  netAmount: number;
  feeAmount: number;
  grossAmount: number;
  status: ChargeStatus;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Associate {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  contributionAmount: number;
  dueDay: number;
  status: AssociateStatus;
  gatewayCustomerId: string | null;
  paymentToken: string;
  createdAt: string;
  updatedAt: string;
}

/** Item da listagem: associado + última cobrança (para a tela de gestão). */
export interface AssociateListItem extends Associate {
  lastCharge: AssociateCharge | null;
}

/** Detalhe: associado + assinatura + histórico de cobranças. */
export interface AssociateDetail extends Associate {
  subscription: AssociateSubscription | null;
  charges: AssociateCharge[];
}

/** Página de associados (story 46 — scroll infinito via paginação real). */
export interface PaginatedAssociates {
  items: AssociateListItem[];
  total: number;
}

// ─── Checkout público do associado (story 38 — consumido pela página [[40]]) ─────

/**
 * Dados mínimos para pré-preencher a página pública de pagamento. Acesso por
 * `payment_token` (sem JWT). NÃO vazar dados sensíveis (whatsapp, e-mail, ids do
 * gateway) — só o necessário ao checkout.
 */
export interface AssociatePublicView {
  name: string;
  suggestedAmount: number;
  dueDay: number;
  status: AssociateStatus;
  /** Já existe assinatura ativa? Evita adesão duplicada na página. */
  hasActiveSubscription: boolean;
}

/**
 * Corpo do POST /public/associates/:token/subscribe.
 * O valor é FIXO (= contribution_amount do cadastro), então só o cartão é enviado.
 */
export interface SubscribeInput {
  /** Token do cartão tokenizado client-side na Pagar.me (PAN nunca chega aqui). */
  cardToken: string;
}

/** Resposta do subscribe: estado após criar assinatura + 1ª cobrança PENDING. */
export interface SubscribeResult {
  status: AssociateStatus;
  subscription: AssociateSubscription;
  charge: AssociateCharge;
  /** URL de checkout do gateway, quando aplicável (fluxo hosted/redirect). */
  checkoutUrl: string | null;
}

/**
 * Dados mínimos da página pública de autocancelamento (story 45). Resolve por
 * `payment_token`; não vaza dados sensíveis. Reutilizada como resposta do POST
 * de cancelamento (idempotente → sempre `status: CANCELED`).
 */
export interface AssociateCancelView {
  name: string;
  status: AssociateStatus;
  /** Há assinatura ativa/cancelável? Após cancelar, sempre `false`. */
  hasActiveSubscription: boolean;
}

// ─── Overview de faturamento dos associados (story 44 — só leitura) ──────────────

/** Ponto da série histórica: esperado vs arrecadado de um mês. */
export interface AssociatesOverviewMonth {
  /** 'YYYY-MM'. */
  month: string;
  /** Soma de grossAmount das charges com due_date no mês. */
  expectedGross: number;
  /** Soma de netAmount das charges com due_date no mês. */
  expectedNet: number;
  /** Soma de grossAmount das charges PAID com paid_at no mês. */
  collectedGross: number;
  /** Soma de netAmount das charges PAID com paid_at no mês. */
  collectedNet: number;
}

/** Índices e totais do mês corrente. */
export interface AssociatesOverviewCurrent {
  expectedGross: number;
  expectedNet: number;
  collectedGross: number;
  collectedNet: number;
  /** Associados criados no mês (exclui soft-deleted). */
  newAssociates: number;
  /** Nº de assinaturas ACTIVE. */
  activeSubscriptions: number;
  /** Ativos ÷ associados não-cancelados (0..1). */
  recurrenceRate: number;
  /** Assinaturas canceladas no mês. */
  churnCount: number;
  /** Cancelados no mês ÷ ativos no início do mês (0..1). */
  churnRate: number;
  /** Charges FAILED ou (PENDING vencida) no mês. */
  delinquentCharges: number;
  /** Associados atualmente PAST_DUE. */
  pastDueAssociates: number;
}

/**
 * Visão de gestão do faturamento de associados (story 44). Agregação de leitura
 * sobre `associate_charges`/`associate_subscriptions`/`associates`. ADMIN only.
 */
export interface AssociatesOverview {
  /** Série dos últimos N meses (ordem cronológica crescente). */
  months: AssociatesOverviewMonth[];
  /** Métricas do mês corrente. */
  current: AssociatesOverviewCurrent;
}

