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

/**
 * Filho elegível para sugestão de matrícula no curso bíblico (story 99): interno
 * ativo com tempo mínimo de casa e sem matrícula ativa, de qualquer casa. A
 * `houseName` é a casa atual (útil porque o interno é realocado ao matricular).
 */
export interface EligibleResident {
  id: string;
  name: string;
  photoThumbUrl: string | null;
  entryDate: string;
  monthsInTreatment: number;
  houseId: string;
  houseName: string;
}

/**
 * Foto da galeria de uma turma do curso bíblico (story 92). Espelha o padrão de
 * `ActivityAttachment` simplificado (só imagens, sem comment/duration). A
 * `fileUrl` chega assinada pelo `StorageUrlInterceptor` em modo S3.
 */
export interface BibleCourseClassPhoto {
  id: string;
  classId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId: string;
  createdAt: string;
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

// ─── Staff Attachments ─────────────────────────────────────────────────────────

/**
 * Anexo genérico do servo (story 98) — documentos e imagens (contratos,
 * comprovantes etc). Espelha o `ActivityAttachment` simplificado (sem
 * comment/duration/fileType).
 */
export interface StaffAttachment {
  id: string;
  staffId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdByUserId: string;
  createdAt: string;
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

// ─── Import em lote — parse da planilha de referência (.xlsx) ──────────────────

/** Uma linha da planilha de referência: um filho, já normalizado para o match. */
export interface SpreadsheetImportRow {
  houseName: string; // nome da aba
  name: string | null;
  nameNormalized: string | null; // lowercase, sem acento, trim, espaços colapsados
  cpf: string | null; // só dígitos
  familyContact: string | null;
  entryDate: string | null; // ISO YYYY-MM-DD
  exitDate: string | null; // ISO YYYY-MM-DD
  contributionMonths: string[]; // competências pagas: ['2023-01-01', ...]
}

/** Resultado stateless do parse da planilha de referência. */
export interface ParseSpreadsheetResult {
  rows: SpreadsheetImportRow[];
  houses: string[]; // abas consideradas (uma por casa)
  skipped: number; // linhas descartadas (sem nome e sem cpf)
  ignoredSheets: string[]; // abas ignoradas (ex.: curso bíblico)
}

// ─── Import em lote — cross-match ficha × planilha (story 102) ─────────────────

/** Um familiar extraído da ficha `.docx`. */
export interface ParseDocxRelative {
  name: string;
  phone: string;
  relationship: string;
}

/** Resultado da extração de uma ficha `.docx` pela IA. */
export interface ParseDocxResult {
  resident: Record<string, unknown>;
  relatives: ParseDocxRelative[];
  warnings: Record<string, string>;
  houseName: string;
  rawText: string;
  photoBase64: string | null;
}

/**
 * Status do cross-match entre a ficha `.docx` e a planilha de referência:
 * `matched` (uma linha correspondente, ficha enriquecida), `ambiguous` (mais de
 * uma linha candidata, não enriquece) ou `unmatched` (nenhuma linha, só a ficha).
 */
export type MatchStatus = 'matched' | 'ambiguous' | 'unmatched';

/**
 * Ficha extraída já cruzada com a planilha de referência e enriquecida com os
 * campos priorizados da planilha (entryDate, exitDate, familyContact,
 * contributionMonths). O histórico de contribuição viaja no payload de preview
 * para ser persistido no commit (story 103); não é persistido aqui.
 */
export interface ImportPreviewResult extends ParseDocxResult {
  matchedHouseName: string | null; // nome da casa (aba) da linha casada
  contributionMonths: string[]; // competências pagas vindas da planilha
  matchStatus: MatchStatus;
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
  /** URL do boleto/conta anexado na criação (null quando sem anexo). */
  attachmentUrl: string | null;
  /** Nome original do arquivo anexado, para exibição. */
  attachmentName: string | null;
  /** URL do comprovante de pagamento (anexado ao dar baixa). */
  paymentReceiptUrl: string | null;
  /** Nome original do comprovante de pagamento. */
  paymentReceiptName: string | null;
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
  /**
   * Descrição em **markdown** (story 72). Suporta negrito, itálico, listas e
   * links (http/https/mailto). É sanitizada no backend ao salvar (HTML bruto e
   * protocolos de link perigosos removidos) e deve ser sanitizada de novo no
   * render (DOMPurify no adm; render lib com HTML off no ops).
   * Opcional no payload (story 71): a LISTAGEM (`GET /activities`) omite o campo;
   * o DETALHE (`GET /activities/:id`) sempre o inclui (string ou null).
   * Consumidores que precisam da descrição devem usar getById.
   */
  description?: string | null;
  status: ActivityStatus;
  houseId: string | null;
  house: ActivityHouseRef | null;
  responsibleStaffId: string | null;
  responsible: ActivityStaffRef | null;
  createdByUserId: string;
  /** Criador (staff) resolvido pelo nome quando disponível; null se não for staff. */
  createdBy: ActivityStaffRef | null;
  /**
   * Anexos da própria atividade (story 73; `commentId` null). Embutido no
   * DETALHE (`GET /activities/:id`); a LISTAGEM não traz. Vazio quando não há.
   */
  attachments?: ActivityAttachment[];
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

/** Comentário (texto puro) de uma atividade — story 65. */
export interface ActivityComment {
  id: string;
  activityId: string;
  body: string;
  /** Autor resolvido (staff) pelo nome quando disponível; null se não for staff. */
  author: ActivityStaffRef | null;
  /** Anexos deste comentário (story 73). Vazio quando não há. */
  attachments?: ActivityAttachment[];
  createdByUserId: string;
  createdAt: string;
}

export interface CreateActivityCommentInput {
  /**
   * Texto do comentário. Opcional (story 74): um comentário só de áudio é criado
   * com body vazio e o anexo de áudio é enviado em seguida.
   */
  body?: string;
}

/**
 * Tipo de anexo derivado do mimetype: `image`/`document` (story 73) e `audio`
 * (story 74). O front escolhe o player/preview por este campo.
 */
export type ActivityAttachmentType = 'image' | 'document' | 'audio';

/**
 * Anexo de uma atividade ou de um comentário (story 73). `commentId` nulo =
 * anexo da própria atividade; preenchido = anexo daquele comentário. A `fileUrl`
 * chega assinada pelo `StorageUrlInterceptor` em modo S3. `canDelete` indica se o
 * usuário autenticado pode excluir este anexo (autoridade no backend; o front só
 * espelha mostrando/escondendo o botão).
 */
export interface ActivityAttachment {
  id: string;
  activityId: string;
  commentId: string | null;
  fileUrl: string;
  fileName: string;
  fileType: ActivityAttachmentType;
  mimeType: string;
  sizeBytes: number;
  /**
   * Duração em segundos para anexos de áudio (story 74); medida no cliente. Null
   * para anexos não-áudio ou quando não foi informada.
   */
  durationSeconds?: number | null;
  createdByUserId: string;
  createdAt: string;
  canDelete: boolean;
}

/** Tipos de evento registrados na trilha de auditoria de uma atividade — story 66. */
export enum ActivityEventType {
  CREATED = 'CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  TITLE_CHANGED = 'TITLE_CHANGED',
  DESCRIPTION_CHANGED = 'DESCRIPTION_CHANGED',
  RESPONSIBLE_CHANGED = 'RESPONSIBLE_CHANGED',
  COMMENTED = 'COMMENTED',
  DELETED = 'DELETED',
}

/**
 * Evento (só-leitura, append-only) do histórico de uma atividade — story 66.
 * Gerado pelo backend a cada mutação relevante. `metadata` carrega o contexto
 * do evento (ex.: `{ from, to }` em STATUS_CHANGED, `{ commentId }` em COMMENTED).
 */
export interface ActivityEvent {
  id: string;
  activityId: string;
  type: ActivityEventType;
  /** Ator (staff) resolvido pelo nome quando disponível; null se não for staff. */
  actor: ActivityStaffRef | null;
  actorUserId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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


// ─── Events (eventos da comunidade — story 56) ──────────────────────────────────

export type EventFilter = 'all' | 'upcoming' | 'past';

/**
 * Tipos de campo do formulário de inscrição customizável (story 68). O admin
 * monta os campos extras por cima da base fixa (name/contact/email?).
 */
export type RegistrationFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'email'
  | 'phone'
  | 'file';

export const REGISTRATION_FIELD_TYPES: RegistrationFieldType[] = [
  'short_text',
  'long_text',
  'number',
  'boolean',
  'select',
  'multi_select',
  'date',
  'email',
  'phone',
  'file',
];

/**
 * Definição de um campo custom do formulário de inscrição (story 68). Mora em
 * `Event.registrationFields`. `id` é estável (gerado na criação) para casar
 * resposta↔campo mesmo se o label mudar.
 */
export interface RegistrationField {
  id: string;
  label: string;
  type: RegistrationFieldType;
  required: boolean;
  /** Ordem de exibição (asc). */
  order: number;
  /** Obrigatório e não-vazio só para select/multi_select. */
  options?: string[];
  placeholder?: string;
}

/**
 * Audiência de um evento (story 94).
 *  - `PUBLIC`   — voltado ao público externo (famílias/comunidade). Aparece no
 *    portal público e pode aceitar inscrição/cobrança. Default.
 *  - `INTERNAL` — voltado aos servos (Staff). Só divulgação: nunca aparece no
 *    portal público, nunca aceita inscrição nem cobrança.
 */
export enum EventAudience {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
}

export interface Event {
  id: string;
  title: string;
  description: string;
  /** ISO string. Início do evento. */
  startAt: string;
  /** ISO string ou null. Fim do evento (opcional). */
  endAt: string | null;
  location: string | null;
  /** Audiência do evento (story 94). INTERNAL = só servos, fora do portal público. */
  audience: EventAudience;
  /** null = vagas ilimitadas. */
  capacity: number | null;
  /** Inscrição habilitada (story 67). false = evento só-divulgação. */
  registrationEnabled: boolean;
  /** Cobrança da inscrição habilitada (story 69). false = inscrição grátis. */
  paymentEnabled: boolean;
  /** Preço líquido da inscrição em centavos (story 69). null quando grátis. */
  priceCents: number | null;
  /** Campos custom do formulário de inscrição (story 68). [] = só base fixa. */
  registrationFields: RegistrationField[];
  /** URL servida/assinada do banner (null quando sem banner). Nunca é a chave crua. */
  bannerUrl: string | null;
  /** ISO string ou null. Abertura da janela de inscrição. */
  registrationOpensAt: string | null;
  /** ISO string ou null. Fechamento da janela de inscrição. */
  registrationClosesAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description: string;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  /** Audiência do evento (story 94). Default PUBLIC. INTERNAL força inscrição/cobrança off. */
  audience?: EventAudience;
  capacity?: number | null;
  /** Inscrição habilitada (story 67). Default false: evento só-divulgação. */
  registrationEnabled?: boolean;
  /** Cobrança da inscrição (story 69). Default false: inscrição grátis. */
  paymentEnabled?: boolean;
  /** Preço líquido em centavos (story 69). Obrigatório quando paymentEnabled. */
  priceCents?: number | null;
  /** Campos custom do formulário de inscrição (story 68). */
  registrationFields?: RegistrationField[];
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface ListEventsParams {
  filter?: EventFilter;
  limit?: number;
  offset?: number;
}

// ─── Convite de servos por WhatsApp (story 95) ───────────────────────────────

/**
 * Motivo pelo qual um servo foi pulado no lote de convites (story 95):
 *  - `NOT_FOUND`   — staffId não corresponde a um servo ativo;
 *  - `NO_WHATSAPP` — servo sem número de WhatsApp normalizável para E.164;
 *  - `SEND_FAILED` — a Meta não aceitou o envio (best-effort, falha logada).
 */
export type EventInviteSkipReason = 'NOT_FOUND' | 'NO_WHATSAPP' | 'SEND_FAILED';

export interface EventInviteSkipped {
  staffId: string;
  reason: EventInviteSkipReason;
}

/** Resumo do disparo de convites de um evento aos servos (story 95). */
export interface EventInviteResult {
  /** staffIds cujo convite a Meta aceitou. */
  sent: string[];
  /** Servos pulados, com o motivo. Falha individual não aborta o lote. */
  skipped: EventInviteSkipped[];
}

// ─── Event registrations / public events (story 58) ─────────────────────────────

export interface EventPublic {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  bannerUrl: string | null;
  /** null = vagas ilimitadas. */
  capacity: number | null;
  /** Vagas restantes; null quando ilimitado. Nunca negativo. */
  spotsLeft: number | null;
  /** Campos custom do formulário de inscrição (story 68), p/ o portal renderizar. */
  registrationFields: RegistrationField[];
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  /**
   * Inscrição habilitada no evento (story 95). false = evento só-divulgação
   * (ou interno) acessado por link direto: o portal mostra a info sem o
   * formulário de inscrição.
   */
  registrationEnabled: boolean;
  /** Inscrição aberta agora (janela respeitada, não passado, não esgotado). */
  registrationOpen: boolean;
  /** Cobrança da inscrição habilitada (story 69). */
  paymentEnabled: boolean;
  /** Preço líquido em centavos (story 69). null quando grátis. */
  priceCents: number | null;
}

/** Valor primitivo/array que uma resposta de campo custom pode assumir (story 68). */
export type RegistrationAnswerValue = string | number | boolean | string[];

/**
 * Estado do pagamento de uma inscrição (story 69).
 *  - `NONE`    — inscrição grátis (evento sem cobrança);
 *  - `PENDING` — inscrição paga aguardando pagamento;
 *  - `PAID`    — pagamento confirmado pelo gateway (webhook);
 *  - `FAILED`  — pagamento recusado pelo gateway.
 */
export enum EventPaymentStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

/** Método de pagamento avulso da inscrição (story 69). */
export type EventPaymentMethod = 'credit_card' | 'pix';

export interface EventRegistration {
  id: string;
  eventId: string;
  name: string;
  contact: string;
  email: string | null;
  /**
   * Respostas dos campos custom (story 68). Mapa `{ [fieldId]: value }`.
   * Campos `file` chegam ao admin como URL assinada do arquivo.
   */
  answers: Record<string, RegistrationAnswerValue>;
  /** Estado do pagamento da inscrição (story 69). */
  paymentStatus: EventPaymentStatus;
  /** Valor gross-up cobrado em centavos (story 69). null quando grátis. */
  amountCents: number | null;
  createdAt: string;
}

export interface RegisterToEventInput {
  name: string;
  contact: string;
  email?: string | null;
  /** Respostas dos campos custom (story 68). `file` carrega a storage key. */
  answers?: Record<string, RegistrationAnswerValue>;
}

/** Resposta do upload de arquivo de inscrição (campo `file`, story 68). */
export interface RegistrationFileResult {
  fileKey: string;
}

export interface EventRegistrationResult {
  id: string;
  eventId: string;
  name: string;
  /** Estado do pagamento (story 69). `NONE` p/ inscrição grátis. */
  paymentStatus: EventPaymentStatus;
  /**
   * Token de pagamento da inscrição (story 69). Presente só p/ inscrição paga;
   * abre a página pública `/pagamento/:token` (parte [[70]]).
   */
  paymentToken: string | null;
}

// ─── Event payments (story 69) ──────────────────────────────────────────────────

/** Dados da inscrição p/ a página pública de pagamento (story 69). */
export interface EventPaymentInfo {
  eventTitle: string;
  /** Valor gross-up a cobrar em centavos. */
  amountCents: number;
  paymentStatus: EventPaymentStatus;
  /** Método já escolhido numa tentativa anterior, se houver. */
  paymentMethod: EventPaymentMethod | null;
  registrantName: string;
}

/** Body do POST de pagamento por token (story 69). Cartão exige `cardToken`. */
export interface PayEventInput {
  method: EventPaymentMethod;
  /** Token do cartão tokenizado client-side (obrigatório p/ credit_card). */
  cardToken?: string;
}

/** Resultado de uma cobrança PIX (copia-e-cola + QR) (story 69). */
export interface PixPaymentResult {
  qrCode: string | null;
  qrCodeUrl: string | null;
  expiresAt: string | null;
}

/** Resposta do POST de pagamento (story 69). PIX traz o `pix`; cartão não. */
export interface PayEventResult {
  paymentStatus: EventPaymentStatus;
  method: EventPaymentMethod;
  pix: PixPaymentResult | null;
}
