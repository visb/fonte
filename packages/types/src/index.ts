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
  // Registro histórico do import em lote sem correspondência na planilha de
  // referência: entra como arquivo morto, fora das contagens/listagens ativas.
  ARCHIVED = 'ARCHIVED',
}

// Filhos fisicamente presentes na casa (contagem de ocupação).
export const PRESENT_RESIDENT_STATUSES = [
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
] as const;

/**
 * Filho "ativo" = presente/em tratamento — acolhido cujo processo está em curso.
 * DIFERE de PRESENT_RESIDENT_STATUSES (ocupação física da casa) por incluir
 * PRE_ADMISSION: o filho em pré-admissão já é acolhido (é nesse status que o
 * wizard de acolhimento imprime as fichas), só não tem a admissão concluída.
 * Castigo (DISCIPLINE) e saída temporária (TEMP_LEAVE) continuam ativos.
 *
 * Fonte ÚNICA da definição (story 160): antes a lista era redeclarada em
 * resident.service e resident-receivable.service. Quem não está aqui já saiu ou
 * é registro morto: DISCHARGED, EVADED, CENSUS_ADDED, REJECTED_CENSUS, ARCHIVED.
 */
export const ACTIVE_RESIDENT_STATUSES: ResidentStatus[] = [
  ResidentStatus.PRE_ADMISSION,
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
];

/**
 * Story 196 — status a partir dos quais o filho pode receber baixa
 * (alta, evasão ou transferência). Fonte ÚNICA para os dois apps e para o
 * backend: a lista gateia o menu `⋮` da lista de filhos (`ops` e `adm`) e o
 * guard de transição de `ResidentService.update`.
 *
 * Quem já saiu (DISCHARGED/EVADED), quem é registro morto (ARCHIVED,
 * REJECTED_CENSUS), quem ainda não entrou (PRE_ADMISSION) e quem aguarda
 * aprovação da contagem (CENSUS_ADDED) não recebem baixa.
 */
export const REMOVABLE_RESIDENT_STATUSES: ResidentStatus[] = [
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
];

/**
 * Story 205 — vínculo filho↔ministério só existe para filho **em acolhimento**
 * (`REMOVABLE_RESIDENT_STATUSES`) **na mesma casa** do ministério. Fonte única
 * para o backend (guard de `addResident`, líder e ficha) e para as telas
 * ("Adicionar filho", seletor de líder) do `adm` e do `ops`.
 */
export function isMinistryEligibleResident(
  resident: { status: ResidentStatus | string; houseId: string | null },
  ministryHouseId: string,
): boolean {
  return (
    resident.houseId === ministryHouseId &&
    REMOVABLE_RESIDENT_STATUSES.includes(resident.status as ResidentStatus)
  );
}

/** Mensagem do 400 quando o filho não pode participar do ministério (story 205). */
export const MINISTRY_RESIDENT_NOT_ELIGIBLE_MESSAGE =
  'Só filho em acolhimento nesta casa pode participar do ministério.';

/** Ações de baixa de filho oferecidas pelo menu de remoção (story 196). */
export type ResidentRemovalAction = 'discharge' | 'evade' | 'transfer';

/**
 * Rótulos das ações de baixa. Ficam aqui porque dois apps escrevendo
 * "Declarar alta" por conta própria é como viram "Declarar Alta" e "Dar alta".
 */
export const RESIDENT_REMOVAL_LABELS: Record<
  ResidentRemovalAction,
  { label: string; description: string }
> = {
  discharge: { label: 'Declarar alta', description: 'Encerrar o acolhimento com alta.' },
  evade: { label: 'Evasão', description: 'Registrar saída por evasão.' },
  transfer: {
    label: 'Transferir para outra casa',
    description: 'Mover o filho para outra casa.',
  },
};

/**
 * Itens do menu `⋮` da lista de filhos (story 200). A saída da comunidade
 * (alta/evasão) e a transferência são ações separadas: quem é transferido
 * continua na comunidade, só muda de casa.
 */
export type ResidentRowAction = 'exit' | 'transfer';

export const RESIDENT_ROW_ACTION_LABELS: Record<ResidentRowAction, string> = {
  exit: 'Declarar saída da comunidade',
  transfer: 'Transferir de casa',
};

/** Quais ações de baixa cada item do menu oferece. */
export const RESIDENT_ROW_ACTIONS: Record<ResidentRowAction, ResidentRemovalAction[]> = {
  exit: ['discharge', 'evade'],
  transfer: ['transfer'],
};

/**
 * Disponibilidade de um template de documento por status do filho (story 160).
 * Ternário de propósito — configurar 9 status por template é granularidade que
 * ninguém pediu; se um dia precisar, ALL vira a lista completa sem quebrar dado.
 */
export enum TemplateAvailability {
  ALL = 'ALL',
  ACTIVE_ONLY = 'ACTIVE_ONLY',
  INACTIVE_ONLY = 'INACTIVE_ONLY',
}

/**
 * Story 178 — que tipo de documento um template descreve.
 *
 * `RESIDENT` é o comportamento de sempre (documento do filho) e é o DEFAULT em
 * toda leitura: um template de recibo nasce invisível para a aba de Anexos, para
 * o editor de documentos do filho e para o wizard de acolhimento, sem que
 * nenhuma dessas telas precise saber que recibos existem.
 */
export enum TemplateKind {
  RESIDENT = 'RESIDENT',
  RECEIPT = 'RECEIPT',
}

/**
 * Story 178 — tipo de recibo. É DADO (varchar no banco), não código: um tipo
 * novo não exige `ALTER TYPE` nem migration, só um resolver.
 */
export enum ReceiptType {
  ASSOCIATE_CONTRIBUTION = 'ASSOCIATE_CONTRIBUTION',
  /**
   * Story 193 — contribuição mensal do acolhido (carnê `resident_receivables`).
   * Segundo tipo com resolver, e a prova da aposta da 178: entrou como DADO,
   * sem migration nem `ALTER TYPE`.
   */
  RESIDENT_CONTRIBUTION = 'RESIDENT_CONTRIBUTION',
  /** Declarado de propósito; o resolver entra numa story própria. */
  PIZZA_SALE = 'PIZZA_SALE',
  /** Declarado de propósito; o resolver entra numa story própria. */
  BREAD_SALE = 'BREAD_SALE',
}

/** Sujeito de um recibo emitido. Polimórfico para comportar pizza/pão. */
export enum ReceiptSubjectType {
  ASSOCIATE_CHARGE = 'ASSOCIATE_CHARGE',
  /**
   * Story 193 — o sujeito é a PARCELA (`resident_receivables.id`), não o filho
   * nem o par (filho, mês): é o que faz `ux_issued_receipts_subject` dar de
   * graça o "um número por parcela".
   */
  RESIDENT_RECEIVABLE = 'RESIDENT_RECEIVABLE',
}

/**
 * Tipos de recibo com resolver implementado — o que a UI pode oferecer hoje.
 * Impede a tela de cadastrar um template cujo recibo ninguém sabe emitir.
 */
export const IMPLEMENTED_RECEIPT_TYPES: ReceiptType[] = [
  ReceiptType.ASSOCIATE_CONTRIBUTION,
  ReceiptType.RESIDENT_CONTRIBUTION,
];

/** Rótulo em pt-BR de cada tipo de recibo (usado na tela e nas mensagens de erro). */
export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  [ReceiptType.ASSOCIATE_CONTRIBUTION]: 'Contribuição mensal do associado',
  [ReceiptType.RESIDENT_CONTRIBUTION]: 'Contribuição mensal do acolhido',
  [ReceiptType.PIZZA_SALE]: 'Venda de pizza',
  [ReceiptType.BREAD_SALE]: 'Venda de pão',
};

/**
 * Story 212 — `code` do 404 de "nenhum template cadastrado para o tipo". Vai no
 * corpo junto com a `message` e o `receiptType`, para o cliente distinguir esse
 * 404 do de "parcela/cobrança inexistente" e oferecer o atalho de cadastro.
 */
export const RECEIPT_TEMPLATE_MISSING_CODE = 'RECEIPT_TEMPLATE_MISSING';

/** Slug de nome de arquivo: minúsculas, sem acento, tudo que não é [a-z0-9] vira `-`. */
export function filenameSlug(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Story 212 — nome do arquivo do recibo da contribuição do filho:
 * `recibo-{nome-do-filho}-{MM}-{AAAA}.pdf`. Mês/ano saem da COMPETÊNCIA
 * (`reference_month`, `YYYY-MM-DD` ou `Date` de coluna `date`), não do
 * pagamento. Partes vazias somem sem deixar hífen duplo.
 */
export function residentReceiptFilename(
  residentName: string | null | undefined,
  referenceMonth: string | Date | null | undefined,
): string {
  let monthYear = '';
  if (referenceMonth instanceof Date) {
    if (!Number.isNaN(referenceMonth.getTime())) {
      monthYear = `${pad2(referenceMonth.getUTCMonth() + 1)}-${referenceMonth.getUTCFullYear()}`;
    }
  } else if (referenceMonth) {
    const match = /^(\d{4})-(\d{1,2})/.exec(referenceMonth);
    if (match) monthYear = `${pad2(Number(match[2]))}-${match[1]}`;
  }
  const parts = ['recibo', filenameSlug(residentName), monthYear].filter(Boolean);
  return `${parts.join('-')}.pdf`;
}

export function isResidentStatusActive(status: ResidentStatus | null | undefined): boolean {
  return !!status && ACTIVE_RESIDENT_STATUSES.includes(status);
}

/**
 * Predicado ÚNICO (backend + frontend) de "este template vale para este filho".
 * `availableFor` ausente/desconhecido conta como ALL: template legado (ou payload
 * sem o campo) nunca some da tela nem é recusado na geração.
 */
export function isTemplateAvailableForStatus(
  availableFor: TemplateAvailability | string | null | undefined,
  status: ResidentStatus | null | undefined,
): boolean {
  if (availableFor === TemplateAvailability.ACTIVE_ONLY) return isResidentStatusActive(status);
  if (availableFor === TemplateAvailability.INACTIVE_ONLY) return !!status && !isResidentStatusActive(status);
  return true;
}

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
 * Conclusão do curso bíblico FORA do sistema (story 127): fato histórico do
 * filho (não do acolhimento) — sobrevive a alta/evasão/readmissão e o exclui
 * das sugestões de matrícula. `markedBy` é nulo quando o usuário que marcou já
 * foi removido (FK ON DELETE SET NULL — o fato não se perde com o staff).
 */
export interface BibleCourseExternalCompletion {
  residentId: string;
  markedAt: string;
  markedBy: { id: string; name: string } | null;
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
  STABLE_UNION = 'STABLE_UNION',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
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

/**
 * Um acolhimento (par entrada→saída) detectado na planilha de referência
 * (story 121). A planilha pode trazer vários pares numa única linha (colunas
 * repetidas Entrada 1/Saída 1, Entrada 2/Saída 2, ...) — cada par vira um
 * `Admission`. `exitDate` fica `null` quando o acolhimento está em aberto
 * (tipicamente o mais recente).
 */
export interface ImportAdmission {
  entryDate: string; // ISO YYYY-MM-DD (um acolhimento sempre tem entrada)
  exitDate: string | null; // ISO YYYY-MM-DD ou null (acolhimento em aberto)
}

/** Uma linha da planilha de referência: um filho, já normalizado para o match. */
export interface SpreadsheetImportRow {
  houseName: string; // nome da aba
  name: string | null;
  nameNormalized: string | null; // lowercase, sem acento, trim, espaços colapsados
  cpf: string | null; // só dígitos
  familyContact: string | null;
  entryDate: string | null; // ISO YYYY-MM-DD — acolhimento mais recente (topo)
  exitDate: string | null; // ISO YYYY-MM-DD — acolhimento mais recente (topo)
  // Histórico de acolhimentos ordenado por entryDate ascendente (story 121). O
  // topo do resident (entryDate/exitDate acima) é sempre o mais recente (último).
  admissions: ImportAdmission[];
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

// ─── Import em lote — conflito e commit (story 103) ───────────────────────────

/**
 * Um filho já cadastrado que conflita com a ficha a importar — casado por nome
 * normalizado (sem acento) ou por CPF (dígitos). Alimenta o alerta inline do
 * front antes de aprovar o import.
 */
export interface ImportConflict {
  id: string;
  name: string;
  cpf: string | null;
  status: ResidentStatus;
  houseName: string | null;
}

/** Resposta da checagem de conflito do import. */
export interface CheckImportConflictResult {
  conflicts: ImportConflict[];
}

/** Um familiar do payload de commit do import (mínimo para satisfazer ≥1 relative). */
export interface CommitImportRelative {
  name: string;
  phone?: string | null;
  relationship?: string | null;
}

/** Quantas contribuições retroativas foram criadas/ignoradas no commit. */
export interface ImportContributionsSummary {
  created: number;
  skipped: number;
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

/**
 * Rótulo em pt-BR de cada forma de pagamento (story 193, decisão 12).
 *
 * Vivia só em `apps/adm.fonte/src/features/residents/constants.ts`, mas o
 * resolver do recibo do acolhido (backend) imprime `{{paymentMethod}}` — e
 * dicionário duplicado é como "Cartão de Crédito" e "Cartão de crédito" passam a
 * conviver. O `adm.fonte` reexporta daqui: nenhuma tela mudou de texto.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Dinheiro',
  [PaymentMethod.PIX]: 'PIX',
  [PaymentMethod.CREDIT_CARD]: 'Cartão de Crédito',
  [PaymentMethod.DEBIT_CARD]: 'Cartão de Débito',
  [PaymentMethod.BASKET]: 'Cesta',
  [PaymentMethod.OTHER]: 'Outro',
};

/**
 * Rótulo em pt-BR da modalidade de contribuição da família (story 193). Mesmo
 * motivo do mapa acima: o recibo do acolhido imprime `{{contributionPlan}}`, e
 * o rótulo tem que ser o MESMO que a tela mostra.
 */
export const FAMILY_INVESTMENT_LABELS: Record<FamilyInvestment, string> = {
  [FamilyInvestment.BASKET_500]: 'R$ 500 + cestas',
  [FamilyInvestment.PAYMENT_700]: 'R$ 700',
  [FamilyInvestment.SOCIAL]: 'Social',
  [FamilyInvestment.NEGOTIATED]: 'Negociado',
};

export interface ResidentReceivable {
  id: string;
  residentId: string;
  // Acolhimento dono da parcela (story 164). `null` em parcela órfã — filho sem
  // nenhum acolhimento vivo (dado legado do import em lote).
  admissionId: string | null;
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
  // Contribuições em produtos declaradas nesta parcela (story 112). Independem
  // do pagamento em dinheiro — uma parcela pode ter valor, produtos, ou ambos.
  productContributions?: ReceivableProductContribution[];
}

/**
 * Recorte do carnê para o `ops.fonte` (story 186) — resposta de
 * `GET /residents/:id/receivables/summary`.
 *
 * O servo declara **contribuição em produtos** (SERVANT+ desde a story 112) e,
 * para isso, só precisa localizar a parcela: mês de referência e status. Valor,
 * pagamento e histórico ficam de fora — histórico financeiro da família não é
 * assunto de todo operador da casa, e a rota cheia (`GET :id/receivables`) segue
 * `ADMIN`/`COORDINATOR`.
 *
 * **Não** estende `ResidentReceivable` de propósito: são contratos diferentes, e
 * acoplá-los faria um campo novo do carnê vazar para o recorte sem ninguém decidir.
 */
export interface ResidentReceivableSummary {
  id: string;
  referenceMonth: string; // YYYY-MM-01
  status: ReceivableStatus;
}

/**
 * Story 193 — recorte do carnê para o FAMILIAR (`GET /relatives/me/receivables`).
 *
 * Só o que já foi PAGO, e só o necessário para localizar a parcela e baixar o
 * recibo: competência, valor pago e forma de pagamento. Plano, produtos,
 * pendências e vencimento ficam de fora — cobrar pelo app do familiar é decisão
 * de produto que ninguém tomou (decisão 11), e a tela de recibo não é o lugar de
 * tomá-la sozinha.
 *
 * **Não** estende `ResidentReceivable` de propósito, pelo mesmo motivo do
 * `ResidentReceivableSummary`: campo novo do carnê não vaza para cá sem decisão.
 */
export interface RelativePaidReceivable {
  id: string;
  referenceMonth: string; // YYYY-MM-01
  paidAmount: number;
  paidAt: string | null; // YYYY-MM-DD
  paymentMethod: PaymentMethod | null;
}

// ─── Receivable Product Contributions (story 112) ──────────────────────────────

/**
 * Uma linha de contribuição em produtos numa parcela (`ResidentReceivable`).
 * Dois modos mutuamente exclusivos:
 *  - Catálogo: `inventoryItemId` preenchido → gera movimento IN no inventário
 *    (`inventoryMovementId` guarda o vínculo); `quantity`/`unit` obrigatórios.
 *  - Avulso: `description` preenchida (texto livre), sem item/movimento;
 *    `pendingDetailing = true` (logística distrincha depois). Não mexe no estoque.
 */
export interface ReceivableProductContribution {
  id: string;
  receivableId: string;
  inventoryItemId: string | null;
  inventoryMovementId: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  pendingDetailing: boolean;
  createdByName: string | null;
  createdAt: string;
}

/** Contribuições da casa agrupadas por filho e parcela, sem valores financeiros. */
export interface HouseProductContributionView {
  residentId: string;
  residentName: string;
  receivableId: string;
  referenceMonth: string;
  lines: ReceivableProductContribution[];
}

/** Uma linha declarada: item (catálogo) XOR descrição (avulso). */
export interface ProductContributionLineInput {
  inventoryItemId?: string;
  description?: string;
  quantity?: number;
  unit?: string;
}

export interface DeclareProductContributionInput {
  lines: ProductContributionLineInput[];
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

// ─── User Preferences (story 130) ───────────────────────────────────────────

/**
 * Mapa chave→valor das preferências de UI do usuário logado — exatamente o que
 * o cliente guarda em cache no `localStorage`. Cada tela usa a própria chave.
 */
export type UserPreferences = Record<string, unknown>;

/**
 * Preferência da listagem de filhos (chave `residents.filters`). Guarda os
 * filtros e a ordenação (escolha de exibição como as demais). `status` mantém a
 * distinção ausente vs presente-e-vazio: `''` = "Todos os status".
 */
export interface ResidentsFiltersPreference {
  status: string;
  house: string;
  overdue: boolean;
  sort: string;
}

/** Chave canônica da preferência de filtros da listagem de filhos. */
export const RESIDENTS_FILTERS_PREFERENCE_KEY = 'residents.filters';

// ─── Maioridade na data de nascimento (story 202) ────────────────────────────

/** Idade mínima (anos completos) de filho e servo no cadastro. */
export const MIN_PERSON_AGE = 18;

/** Mensagem única da recusa por idade — backend (400) e telas usam a mesma. */
export const MIN_AGE_MESSAGE =
  'A pessoa precisa ter pelo menos 18 anos. Confira a data de nascimento.';

/** Fuso da operação: "hoje" é a data civil daqui, não o dia UTC. */
export const OPERATION_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Fallback quando o runtime não tem `Intl` com fuso (Hermes antigo). O Brasil
 * não tem horário de verão desde 2019, então UTC−3 é exato para São Paulo.
 */
const SAO_PAULO_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Data de hoje (`YYYY-MM-DD`) no fuso da operação (`America/Sao_Paulo`). */
export function todayInSaoPaulo(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: OPERATION_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    const [year, month, day] = [part('year'), part('month'), part('day')];
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Runtime sem suporte a `timeZone`: cai no deslocamento fixo abaixo.
  }
  return new Date(now.getTime() + SAO_PAULO_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Maior data de nascimento (`YYYY-MM-DD`) de quem tem `MIN_PERSON_AGE` anos
 * completos em `today`. 29/02 vira 28/02 quando o ano alvo não é bissexto
 * (mesmo comportamento do `subYears` do date-fns).
 */
export function maxBirthDateFor(today: string): string {
  const match = ISO_DATE_PREFIX.exec(today);
  if (!match) throw new Error(`Data inválida: ${today}`);
  const year = Number(match[1]) - MIN_PERSON_AGE;
  const month = Number(match[2]);
  let day = Number(match[3]);
  if (month === 2 && day === 29 && !isLeapYear(year)) day = 28;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * `true` quando quem nasceu em `birthDate` tem `MIN_PERSON_AGE` anos completos
 * em `today` (ambos `YYYY-MM-DD`; um sufixo de hora é ignorado). Valor fora do
 * formato não é julgado aqui (`true`): checar formato é papel do DTO/schema.
 */
export function isAdultBirthDate(birthDate: string, today: string): boolean {
  const match = ISO_DATE_PREFIX.exec(birthDate);
  if (!match) return true;
  return match[0] <= maxBirthDateFor(today);
}

// ─── Coerência das datas de entrada e saída (story 203) ──────────────────────

/** `YYYY-MM-DD` → `dd/mm/aaaa` (sufixo de hora ignorado; fora do formato volta igual). */
export function formatIsoDateBr(date: string): string {
  const match = ISO_DATE_PREFIX.exec(date);
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * `true` quando `date` é depois de `today` (ambos `YYYY-MM-DD`; sufixo de hora
 * ignorado). Comparação em string: a ordem lexicográfica é a cronológica.
 * Hoje não é futuro. Valor fora do formato não é julgado aqui (`false`).
 */
export function isFutureDate(date: string, today: string): boolean {
  const match = ISO_DATE_PREFIX.exec(date);
  if (!match) return false;
  return match[0] > today.slice(0, 10);
}

/**
 * `true` quando `later` é anterior a `earlier` (ex.: saída antes da entrada).
 * Mesmo dia passa. Valor fora do formato não é julgado aqui (`false`).
 */
export function isDateBefore(later: string, earlier: string): boolean {
  const a = ISO_DATE_PREFIX.exec(later);
  const b = ISO_DATE_PREFIX.exec(earlier);
  if (!a || !b) return false;
  return a[0] < b[0];
}

/** Mensagens únicas da story 203 — backend (400) e telas usam as mesmas. */
export const ADMISSION_DATE_MESSAGES = {
  entryFuture: 'A data de entrada não pode ser no futuro.',
  exitBeforeEntry: (entryDate: string) =>
    `A data de saída não pode ser anterior à data de entrada (${formatIsoDateBr(entryDate)}).`,
  exitFuture: 'A data de saída não pode ser no futuro.',
  entryBeforePreviousExit: (previousExitDate: string) =>
    `A data de entrada não pode ser anterior à saída do acolhimento anterior (${formatIsoDateBr(previousExitDate)}).`,
} as const;

/** Qual campo a mensagem acusa — as telas põem o erro no campo certo. */
export interface AdmissionDatesIssue {
  field: 'entryDate' | 'exitDate';
  message: string;
}

/**
 * Regras da story 203 sobre um par entrada/saída (`YYYY-MM-DD`; vazio = não
 * informado). `check` limita o que é julgado (decisão 4: só a data informada
 * ou alterada) — por padrão julga tudo. A coerência do par (`exit >= entry`)
 * vale sempre que qualquer uma das duas é julgada.
 */
export function findAdmissionDatesIssue(
  dates: { entryDate?: string | null; exitDate?: string | null },
  options: {
    today: string;
    previousExitDate?: string | null;
    check?: { entryDate?: boolean; exitDate?: boolean };
  },
): AdmissionDatesIssue | null {
  const entry = dates.entryDate || null;
  const exit = dates.exitDate || null;
  const checkEntry = options.check?.entryDate ?? true;
  const checkExit = options.check?.exitDate ?? true;

  if (checkEntry && entry) {
    if (isFutureDate(entry, options.today)) {
      return { field: 'entryDate', message: ADMISSION_DATE_MESSAGES.entryFuture };
    }
    const previousExit = options.previousExitDate || null;
    if (previousExit && isDateBefore(entry, previousExit)) {
      return {
        field: 'entryDate',
        message: ADMISSION_DATE_MESSAGES.entryBeforePreviousExit(previousExit),
      };
    }
  }
  if (checkExit && exit && isFutureDate(exit, options.today)) {
    return { field: 'exitDate', message: ADMISSION_DATE_MESSAGES.exitFuture };
  }
  if ((checkEntry || checkExit) && entry && exit && isDateBefore(exit, entry)) {
    return { field: 'exitDate', message: ADMISSION_DATE_MESSAGES.exitBeforeEntry(entry) };
  }
  return null;
}

// ─── Acolhimentos do Histórico (story 215) ──────────────────────────────────

/**
 * Status de **saída** aceitos numa passagem encerrada criada/editada pela aba
 * Histórico: os mesmos status terminais que o import e a alta/evasão gravam nas
 * passagens. Status de acolhimento em curso ou da contagem não entram.
 */
export const ADMISSION_EXIT_STATUSES: ResidentStatus[] = [
  ResidentStatus.DISCHARGED,
  ResidentStatus.EVADED,
  ResidentStatus.ARCHIVED,
];

/** Passagem antiga (já encerrada) registrada pela aba Histórico — só ADMIN. */
export interface CreateAdmissionPayload {
  /** Nula só com status `ARCHIVED` (mesma regra do filho). */
  houseId?: string | null;
  entryDate: string;
  exitDate: string;
  status: ResidentStatus;
}

/**
 * Correção de passagem. No acolhimento **atual** só `entryDate` é aceito (casa
 * e status espelham a ficha e mudam por transição validada).
 */
export interface UpdateAdmissionPayload {
  houseId?: string | null;
  entryDate?: string;
  exitDate?: string;
  status?: ResidentStatus;
}

/** Mensagens únicas da story 215 — backend (400) e dialog usam as mesmas. */
export const ADMISSION_HISTORY_MESSAGES = {
  overlap: (entryDate: string | null, exitDate: string | null) =>
    `Este período se sobrepõe ao acolhimento de ${entryDate ? formatIsoDateBr(entryDate) : 'data desconhecida'} a ${exitDate ? formatIsoDateBr(exitDate) : 'hoje'}.`,
  afterCurrent: (currentEntryDate: string) =>
    `A passagem antiga precisa começar antes do acolhimento atual (${formatIsoDateBr(currentEntryDate)}).`,
  exitStatusRequired: 'Escolha um status de saída: Alta, Evasão ou Arquivado.',
  houseRequired: 'Informe a casa — só passagem arquivada pode ficar sem casa.',
  currentOnlyEntryDate:
    'No acolhimento atual só a data de entrada pode ser corrigida. Casa, saída e status mudam por transferência, alta ou readmissão.',
  exitDateRequired: 'Informe a data de saída — a passagem antiga precisa estar encerrada.',
} as const;

/** Período de uma passagem (`YYYY-MM-DD`; `exitDate` nulo = em aberto). */
export interface AdmissionPeriod {
  id?: string;
  entryDate: string | null;
  exitDate: string | null;
}

/**
 * Story 215 — primeira passagem de `others` que se sobrepõe a `period`.
 *
 * Intervalos fechados nas pontas que se tocam: sair num dia e entrar de novo no
 * mesmo dia **não** é sobreposição (é a regra da readmissão, story 203).
 * Passagem em aberto vai até "sempre"; passagem sem entrada conhecida não é
 * julgada (registro legado). A própria passagem (mesmo `id`) é ignorada.
 */
export function findAdmissionOverlap<T extends AdmissionPeriod>(
  period: AdmissionPeriod,
  others: readonly T[],
): T | null {
  const start = period.entryDate?.slice(0, 10);
  if (!start) return null;
  const end = period.exitDate?.slice(0, 10) ?? null;
  for (const other of others) {
    if (period.id && other.id === period.id) continue;
    const otherStart = other.entryDate?.slice(0, 10);
    if (!otherStart) continue;
    const otherEnd = other.exitDate?.slice(0, 10) ?? null;
    const startsBeforeOtherEnds = otherEnd === null || start < otherEnd;
    const otherStartsBeforeEnd = end === null || otherStart < end;
    if (startsBeforeOtherEnds && otherStartsBeforeEnd) return other;
  }
  return null;
}

// ─── Offline snapshot da casa (story 177) ────────────────────────────────────

/**
 * Janela máxima de delta aceita pelo `GET /houses/:houseId/offline-snapshot`.
 * `since` mais velho que isso é tratado como sincronização completa
 * (`full: true`) — é o reconciliador que fecha os buracos que o delta não
 * detecta (consentimento é append-only, anexo não tem `deleted_at`).
 */
export const SNAPSHOT_MAX_DELTA_AGE_DAYS = 30;

/**
 * Ids removidos do aparelho desde o `since` (story 177). Consentimento **não**
 * entra aqui: `consent_records` é append-only por desenho (revogação é linha
 * nova com `granted: false`), então nunca há o que apagar.
 */
export interface OfflineSnapshotDeleted {
  residents: string[];
  followUps: string[];
  receivables: string[];
}

/**
 * Formas concretas de cada bloco do snapshot. Os tipos de payload (`Resident`,
 * `ResidentAttachment`, `ConsentRecord`, `HouseMinistry`…) moram no
 * `@fonte/api-client`, que é quem descreve a serialização HTTP; aqui fica o
 * **envelope**, que é o contrato que o store offline do `ops.fonte` consome.
 */
export interface OfflineSnapshotShapes {
  resident: unknown;
  followUp: unknown;
  consent: unknown;
  receivable: unknown;
  attachment: unknown;
  ministry: unknown;
}

/**
 * Pacote offline de uma casa (story 177) — resposta de
 * `GET /houses/:houseId/offline-snapshot?since=<ISO>`.
 *
 * Só filhos **presentes** (`PRESENT_RESIDENT_STATUSES`) entram: quem saiu ou foi
 * arquivado não desce para o aparelho.
 *
 * - `syncedAt` é o relógio do **servidor** (com folga de 1s) e é o que o cliente
 *   guarda para o próximo `since`; nunca o relógio do aparelho.
 * - `full: true` → o cliente **substitui** o conteúdo do store; `false` → faz
 *   merge e aplica `deleted`.
 * - Os blocos de detalhe são indexados por `residentId`. No delta eles cobrem
 *   **todos** os filhos presentes da casa, não só os que aparecem em
 *   `residents`: registrar um evento na timeline não muda a linha do filho, e
 *   recortar o detalhe pela lista de filhos alterados esconderia o lançamento
 *   até a próxima sincronização completa.
 * - Exceção: `attachments` não tem como ser recortado por data (a tabela não tem
 *   `updated_at`), então vem completo **apenas** para os filhos que aparecem em
 *   `residents` — anexo novo de filho intocado espera o próximo `full`.
 */
export interface HouseOfflineSnapshot<S extends OfflineSnapshotShapes = OfflineSnapshotShapes> {
  syncedAt: string;
  full: boolean;
  residents: S['resident'][];
  followUps: Record<string, S['followUp'][]>;
  consents: Record<string, S['consent'][]>;
  receivables: Record<string, S['receivable'][]>;
  attachments: Record<string, S['attachment'][]>;
  ministries: S['ministry'][];
  deleted: OfflineSnapshotDeleted;
}

// ─── Auditoria de ações dos usuários (story 199) ─────────────────────────────

/** Resultado de um evento de auditoria. Eventos legados (antes da 199) vêm `null`. */
export enum AuditOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

/**
 * Motivo controlado de falha de login. Nunca serializa o erro nem o payload:
 * a resposta HTTP ao cliente continua a mesma ("Credenciais inválidas").
 */
export enum LoginFailureReason {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INACTIVE_USER = 'INACTIVE_USER',
  UNKNOWN_IDENTIFIER = 'UNKNOWN_IDENTIFIER',
  AMBIGUOUS_IDENTIFIER = 'AMBIGUOUS_IDENTIFIER',
  INVALID_INPUT = 'INVALID_INPUT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const LOGIN_FAILURE_REASON_LABELS: Record<LoginFailureReason, string> = {
  [LoginFailureReason.INVALID_CREDENTIALS]: 'Senha incorreta',
  [LoginFailureReason.INACTIVE_USER]: 'Usuário inativo',
  [LoginFailureReason.UNKNOWN_IDENTIFIER]: 'Identificador não encontrado',
  [LoginFailureReason.AMBIGUOUS_IDENTIFIER]: 'Identificador ambíguo',
  [LoginFailureReason.INVALID_INPUT]: 'Dados de entrada inválidos',
  [LoginFailureReason.RATE_LIMITED]: 'Bloqueado por excesso de tentativas',
  [LoginFailureReason.INTERNAL_ERROR]: 'Erro interno',
};

/** Tipos de recurso auditado. Os valores são o `target_type` gravado. */
export const AuditTargetType = {
  USER: 'user',
  RESIDENT: 'resident',
  RESIDENT_RELATIVE: 'relative',
  RESIDENT_RECEIVABLE: 'resident-receivable',
  RESIDENT_ATTACHMENT: 'resident-attachment',
  RESIDENT_DOCUMENT: 'resident-document',
  RESIDENT_FOLLOW_UP: 'resident-follow-up',
  PRODUCT_CONTRIBUTION: 'product-contribution',
  STAFF: 'staff',
  STAFF_ATTACHMENT: 'staff-attachment',
  STAFF_PERMISSION: 'staff-permission',
  HOUSE: 'house',
  HOUSE_PHOTO: 'house-photo',
  HOUSE_RULE: 'house-rule',
  MINISTRY: 'ministry',
  ADMISSION: 'admission',
} as const;
export type AuditTargetTypeValue = (typeof AuditTargetType)[keyof typeof AuditTargetType];

export const AUDIT_TARGET_TYPE_LABELS: Record<string, string> = {
  user: 'Usuário',
  resident: 'Filho',
  relative: 'Familiar',
  'resident-receivable': 'Parcela',
  'resident-attachment': 'Anexo do filho',
  'resident-document': 'Documento assinado',
  'resident-follow-up': 'Lançamento do filho',
  'product-contribution': 'Contribuição em produtos',
  staff: 'Servo',
  'staff-attachment': 'Anexo do servo',
  'staff-permission': 'Permissão do servo',
  house: 'Casa',
  'house-photo': 'Foto da casa',
  'house-rule': 'Regra da casa',
  ministry: 'Ministério',
  admission: 'Acolhimento',
  consent: 'Consentimento',
  'associate-charge': 'Cobrança de associado',
};

/** Catálogo tipado das ações auditadas (story 199). O valor é o `action` gravado. */
export const AuditAction = {
  LOGIN: 'auth.login',

  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DELETE: 'staff.delete',
  STAFF_SELF_UPDATE: 'staff.self_update',
  STAFF_PHOTO_UPDATE: 'staff.photo.update',
  STAFF_SIGNATURE_UPDATE: 'staff.signature.update',
  STAFF_SIGNATURE_REMOVE: 'staff.signature.remove',
  STAFF_ATTACHMENT_ADD: 'staff.attachment.add',
  STAFF_ATTACHMENT_REMOVE: 'staff.attachment.remove',
  STAFF_PERMISSION_GRANT: 'staff.permission.grant',
  STAFF_PERMISSION_REVOKE: 'staff.permission.revoke',

  RESIDENT_CREATE: 'resident.create',
  RESIDENT_IMPORT: 'resident.import',
  RESIDENT_UPDATE: 'resident.update',
  RESIDENT_IDENTITY_UPDATE: 'resident.identity.update',
  RESIDENT_STATUS_UPDATE: 'resident.status.update',
  RESIDENT_DELETE: 'resident.delete',
  RESIDENT_READMIT: 'resident.readmit',
  RESIDENT_PROMOTE: 'resident.promote',
  RESIDENT_PHOTO_UPDATE: 'resident.photo.update',
  RESIDENT_RELATIVE_CREATE: 'resident.relative.create',
  RESIDENT_RELATIVE_RESPONSIBLE: 'resident.relative.responsible',
  RESIDENT_RELATIVE_DELETE: 'resident.relative.delete',

  // Story 215 — passagens da aba Histórico (alvo `admission`, filho como principal).
  ADMISSION_CREATE: 'admission.create',
  ADMISSION_UPDATE: 'admission.update',

  RESIDENT_CONTRIBUTION_PLAN: 'resident.contribution_plan.update',
  RESIDENT_CONTRIBUTION_EXEMPT: 'resident.contribution_exempt.update',
  RESIDENT_RECEIVABLE_PAYMENT: 'resident.receivable.payment',
  RESIDENT_RECEIVABLE_REOPEN: 'resident.receivable.reopen',
  RESIDENT_CONTRIBUTION_CREATE: 'resident.contribution.create',
  RESIDENT_CONTRIBUTION_BULK: 'resident.contribution.bulk',

  RESIDENT_ATTACHMENT_ADD: 'resident.attachment.add',
  RESIDENT_ATTACHMENT_REMOVE: 'resident.attachment.remove',
  RESIDENT_FOLLOW_UP_ATTACHMENT: 'resident.follow_up.attachment',
  RESIDENT_DOCUMENT_SIGNED: 'resident.document.signed',

  RESIDENT_DOCUMENT_RENDER: 'resident.document.render',
  RESIDENT_DOCUMENT_PDF: 'resident.document.pdf',
  RESIDENT_DOCUMENT_COMBINED_PDF: 'resident.document.combined-pdf',
  RESIDENT_RECEIVABLE_RECEIPT: 'resident.receivable.receipt',
  RELATIVE_RECEIVABLE_RECEIPT: 'relative.receivable.receipt',

  HOUSE_CREATE: 'house.create',
  HOUSE_UPDATE: 'house.update',
  HOUSE_DELETE: 'house.delete',
  HOUSE_PHOTO_ADD: 'house.photo.add',
  HOUSE_PHOTO_REMOVE: 'house.photo.remove',
  HOUSE_RULE_CREATE: 'house.rule.create',
  HOUSE_RULE_DELETE: 'house.rule.delete',
  MINISTRY_CREATE: 'ministry.create',
  MINISTRY_UPDATE: 'ministry.update',
  MINISTRY_DELETE: 'ministry.delete',
  MINISTRY_RESIDENT_ADD: 'ministry.resident.add',
  MINISTRY_RESIDENT_REMOVE: 'ministry.resident.remove',
  MINISTRY_STAFF_ADD: 'ministry.staff.add',
  MINISTRY_STAFF_REMOVE: 'ministry.staff.remove',

  CENSUS_RESIDENT_ADD: 'census.resident.add',
  CENSUS_CONCLUDE: 'census.conclude',
  CENSUS_APPROVE: 'census.approve',
  CENSUS_REJECT: 'census.reject',

  PRODUCT_CONTRIBUTION_DECLARE: 'resident.product_contribution.declare',
  PRODUCT_CONTRIBUTION_REMOVE: 'resident.product_contribution.remove',
} as const;
export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Login',
  'staff.create': 'Servo criado',
  'staff.update': 'Servo editado',
  'staff.delete': 'Servo removido',
  'staff.self_update': 'Perfil próprio editado',
  'staff.photo.update': 'Foto do servo alterada',
  'staff.signature.update': 'Assinatura alterada',
  'staff.signature.remove': 'Assinatura removida',
  'staff.attachment.add': 'Anexo do servo adicionado',
  'staff.attachment.remove': 'Anexo do servo removido',
  'staff.permission.grant': 'Permissão concedida',
  'staff.permission.revoke': 'Permissão revogada',
  'resident.create': 'Filho cadastrado',
  'resident.import': 'Filho importado',
  'resident.update': 'Ficha do filho editada',
  'resident.identity.update': 'Identidade do filho corrigida',
  'resident.status.update': 'Status do filho alterado',
  'resident.delete': 'Filho excluído',
  'resident.readmit': 'Filho reacolhido',
  'resident.promote': 'Filho promovido a servo',
  'resident.photo.update': 'Foto do filho alterada',
  'resident.relative.create': 'Familiar adicionado',
  'resident.relative.responsible': 'Responsável definido',
  'resident.relative.delete': 'Familiar removido',
  'admission.create': 'Passagem antiga registrada',
  'admission.update': 'Acolhimento corrigido',
  'resident.contribution_plan.update': 'Plano de contribuição alterado',
  'resident.contribution_exempt.update': 'Isenção de contribuição alterada',
  'resident.receivable.payment': 'Pagamento de parcela registrado',
  'resident.receivable.reopen': 'Parcela reaberta',
  'resident.contribution.create': 'Contribuição lançada',
  'resident.contribution.bulk': 'Contribuições lançadas em lote',
  'resident.attachment.add': 'Anexo do filho adicionado',
  'resident.attachment.remove': 'Anexo do filho removido',
  'resident.follow_up.attachment': 'Comprovante anexado',
  'resident.document.signed': 'Documento assinado anexado',
  'resident.document.render': 'Documento visualizado',
  'resident.document.pdf': 'PDF de documento gerado',
  'resident.document.combined-pdf': 'PDF combinado gerado',
  'resident.receivable.receipt': 'Recibo de contribuição gerado',
  'relative.receivable.receipt': 'Recibo baixado pelo familiar',
  'house.create': 'Casa criada',
  'house.update': 'Casa editada',
  'house.delete': 'Casa removida',
  'house.photo.add': 'Foto da casa adicionada',
  'house.photo.remove': 'Foto da casa removida',
  'house.rule.create': 'Regra da casa criada',
  'house.rule.delete': 'Regra da casa removida',
  'ministry.create': 'Ministério criado',
  'ministry.update': 'Ministério editado',
  'ministry.delete': 'Ministério removido',
  'ministry.resident.add': 'Filho incluído no ministério',
  'ministry.resident.remove': 'Filho removido do ministério',
  'ministry.staff.add': 'Servo incluído no ministério',
  'ministry.staff.remove': 'Servo removido do ministério',
  'census.resident.add': 'Filho incluído na contagem',
  'census.conclude': 'Contagem concluída',
  'census.approve': 'Inclusão da contagem aprovada',
  'census.reject': 'Inclusão da contagem rejeitada',
  'resident.product_contribution.declare': 'Recebimento de produtos declarado',
  'resident.product_contribution.remove': 'Declaração de produtos removida',
  // Eventos pré-existentes (leitura/LGPD) — preservados e só rotulados.
  'resident.read': 'Ficha do filho consultada',
  'staff.read': 'Ficha do servo consultada',
  'resident.data_export': 'Dados do filho exportados',
  'resident.anonymize': 'Filho anonimizado',
  'consent.grant': 'Consentimento registrado',
  'consent.revoke': 'Consentimento revogado',
  'consent.self_grant': 'Consentimento próprio registrado',
  'consent.self_revoke': 'Consentimento próprio revogado',
  'associate.charge.receipt': 'Recibo de associado gerado',
  'lgpd.retention.run': 'Rotina de retenção executada',
};

/** Rótulos legíveis dos campos que aparecem na tabela Antes/Depois. */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  birthDate: 'Nascimento',
  cpf: 'CPF',
  rg: 'RG',
  status: 'Status',
  userId: 'Acesso',
  houseId: 'Casa',
  ministryId: 'Ministério',
  entryDate: 'Entrada',
  exitDate: 'Saída',
  gender: 'Gênero',
  nationality: 'Nacionalidade',
  city: 'Cidade',
  state: 'Estado',
  address: 'Endereço',
  contactPhone: 'Telefone',
  email: 'E-mail',
  maritalStatus: 'Estado civil',
  children: 'Filhos',
  occupation: 'Profissão',
  education: 'Escolaridade',
  healthIssues: 'Problemas de saúde',
  continuousMedication: 'Medicação contínua',
  religion: 'Religião',
  addiction: 'Dependência',
  weight: 'Peso',
  height: 'Altura',
  familyInvestment: 'Plano de contribuição',
  familyInvestmentAmount: 'Valor do plano',
  contributionDueDay: 'Dia de vencimento',
  contributionExempt: 'Isento de contribuição',
  photoUrl: 'Foto',
  photoThumbUrl: 'Miniatura da foto',
  signatureUrl: 'Assinatura',
  whatsapp: 'WhatsApp',
  role: 'Perfil de acesso',
  rank: 'Nível',
  supportGroupId: 'Grupo de apoio',
  isActive: 'Ativo',
  phone: 'Telefone',
  relationship: 'Parentesco',
  isResponsible: 'Responsável',
  referenceMonth: 'Competência',
  dueDate: 'Vencimento',
  amount: 'Valor',
  paidAt: 'Pago em',
  paymentMethod: 'Forma de pagamento',
  paidAmount: 'Valor pago',
  paidFamilyInvestment: 'Plano pago',
  notes: 'Observações',
  attachmentUrl: 'Comprovante',
  fileUrl: 'Arquivo',
  signedFileUrl: 'Documento assinado',
  mimeType: 'Tipo do arquivo',
  sizeBytes: 'Tamanho',
  templateId: 'Template',
  permissionType: 'Permissão',
  staffId: 'Servo',
  residentId: 'Filho',
  date: 'Data',
  type: 'Tipo',
  receivableId: 'Parcela',
  inventoryItemId: 'Produto',
  description: 'Descrição',
  quantity: 'Quantidade',
  unit: 'Unidade',
  pendingDetailing: 'Pendente de detalhamento',
  leaderId: 'Líder',
  leaderType: 'Tipo de líder',
  coordinatorId: 'Coordenador titular',
  isMotherHouse: 'Casa mãe',
  generalCapacity: 'Capacidade geral',
  staffCapacity: 'Capacidade de servos',
  title: 'Título',
  content: 'Conteúdo',
  url: 'Arquivo',
};

/** Marcador gravado no lugar de qualquer arquivo/URL (story 199 — nunca a URL). */
export const AUDIT_FILE_MARKER = '[arquivo]';

/** Uma linha da tabela Campo / Antes / Depois. `redacted` = dado protegido. */
export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
  redacted: boolean;
}
