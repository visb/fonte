import type {
  AuditChange,
  AuditOutcome,
  LoginFailureReason,
  ResidentStatus,
  ImportAdmission,
  Gender,
  MaritalStatus,
  MessageStatus,
  ProfileType,
  Role,
  ServantRank,
  WishlistStatus,
  IncidentSeverity,
  MovementType,
  StaffPermissionType,
  TimerResetFrequency,
  FollowUpType,
  FollowUpAccessLevel,
  FamilyInvestment,
  PaginatedResponse,
  ContributionReportItem,
  ContributionsReportResponse,
  GetContributionsReportParams,
  ReceivableStatus,
  PaymentMethod,
  ResidentReceivable,
  ResidentReceivableSummary,
  RelativePaidReceivable,
  RegisterReceivablePaymentInput,
  UpdateContributionPlanInput,
  SetContributionExemptInput,
  ReceivableProductContribution,
  ProductContributionLineInput,
  DeclareProductContributionInput,
  StreetSaleType,
  StreetSale,
  StreetSalesReportResponse,
  StreetSalesReportByHouse,
  Associate,
  AssociateListItem,
  AssociateDetail,
  PaginatedAssociates,
  AssociateSubscription,
  AssociateCharge,
  AssociateStatus,
  SubscriptionStatus,
  ChargeStatus,
  AssociatePublicView,
  AssociateCancelView,
  SubscribeInput,
  SubscribeResult,
  AssociatesOverview,
  AssociatesOverviewMonth,
  AssociatesOverviewCurrent,
  SupplyRoomCategory,
  Notification,
  UnreadCountResponse,
  NotificationPushPayload,
  Payable,
  PayablesSummary,
  CreatePayableInput,
  UpdatePayableInput,
  PayPayableInput,
  ListPayablesParams,
  PayablesSummaryParams,
  Activity,
  ActivityHouseRef,
  ActivityStaffRef,
  CreateActivityInput,
  UpdateActivityInput,
  ChangeActivityStatusInput,
  ListActivitiesParams,
  ActivityComment,
  CreateActivityCommentInput,
  ActivityEvent,
  ActivityAttachment,
  ActivityAttachmentType,
  StaffAttachment,
  Event,
  EventFilter,
  CreateEventInput,
  UpdateEventInput,
  ListEventsParams,
  EventPublic,
  EventRegistration,
  RegisterToEventInput,
  EventRegistrationResult,
  RegistrationField,
  RegistrationFieldType,
  RegistrationAnswerValue,
  RegistrationFileResult,
  EventPaymentMethod,
  EventPaymentInfo,
  PayEventInput,
  PayEventResult,
  PixPaymentResult,
  EventInviteResult,
  EventInviteSkipped,
  EventInviteSkipReason,
  CommitImportRelative,
  ImportContributionsSummary,
  UserPreferences,
  ResidentsFiltersPreference,
  StaffFiltersPreference,
  TemplateAvailability,
  TemplateKind,
  ReceiptType,
  HouseOfflineSnapshot,
  OfflineSnapshotDeleted,
} from '@fonte/types';
import {
  SNAPSHOT_MAX_DELTA_AGE_DAYS,
  NotificationType,
  HouseCapacityRequestStatus,
  PayableStatus,
  PayableCategory,
  ActivityStatus,
  ActivityEventType,
  REGISTRATION_FIELD_TYPES,
  EventPaymentStatus,
  EventAudience,
} from '@fonte/types';

export type { ContributionReportItem, ContributionsReportResponse, GetContributionsReportParams };
export type {
  ReceivableStatus,
  PaymentMethod,
  ResidentReceivable,
  ResidentReceivableSummary,
  RelativePaidReceivable,
  RegisterReceivablePaymentInput,
  UpdateContributionPlanInput,
  SetContributionExemptInput,
  ReceivableProductContribution,
  ProductContributionLineInput,
  DeclareProductContributionInput,
};
export type { StreetSaleType, StreetSale, StreetSalesReportResponse, StreetSalesReportByHouse };
export type {
  Associate,
  AssociateListItem,
  AssociateDetail,
  PaginatedAssociates,
  AssociateSubscription,
  AssociateCharge,
  AssociateStatus,
  SubscriptionStatus,
  ChargeStatus,
  AssociatePublicView,
  AssociateCancelView,
  SubscribeInput,
  SubscribeResult,
  AssociatesOverview,
  AssociatesOverviewMonth,
  AssociatesOverviewCurrent,
};
export type { SupplyRoomCategory };

export { PayableStatus, PayableCategory };
export type {
  Payable,
  PayablesSummary,
  CreatePayableInput,
  UpdatePayableInput,
  PayPayableInput,
  ListPayablesParams,
  PayablesSummaryParams,
};

export { ActivityStatus, ActivityEventType, REGISTRATION_FIELD_TYPES };
export type {
  Activity,
  ActivityHouseRef,
  ActivityStaffRef,
  CreateActivityInput,
  UpdateActivityInput,
  ChangeActivityStatusInput,
  ListActivitiesParams,
  ActivityComment,
  CreateActivityCommentInput,
  ActivityEvent,
  ActivityAttachment,
  ActivityAttachmentType,
  StaffAttachment,
};

export { EventPaymentStatus, EventAudience };
export type {
  Event,
  EventFilter,
  CreateEventInput,
  UpdateEventInput,
  ListEventsParams,
  EventPublic,
  EventRegistration,
  RegisterToEventInput,
  EventRegistrationResult,
  RegistrationField,
  RegistrationFieldType,
  RegistrationAnswerValue,
  RegistrationFileResult,
  EventPaymentMethod,
  EventPaymentInfo,
  PayEventInput,
  PayEventResult,
  PixPaymentResult,
  EventInviteResult,
  EventInviteSkipped,
  EventInviteSkipReason,
};

export type { FamilyInvestment };

export type { PaginatedResponse };

export { NotificationType };
export type { Notification, UnreadCountResponse, NotificationPushPayload };

export interface ListNotificationsParams {
  unreadOnly?: boolean;
  page?: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  /** E-mail ou telefone. */
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  profileType: ProfileType;
}

export interface ChangePasswordInput {
  newPassword: string;
}

// ─── House ───────────────────────────────────────────────────────────────────

export interface HousePhoto {
  id: string;
  filename: string;
  url: string;
  createdAt: string;
}

export interface House {
  id: string;
  name: string;
  generalCapacity: number | null;
  staffCapacity: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  /** Coordenador titular — a referência/contato da casa (story 194). */
  coordinatorId: string | null;
  coordinator: { id: string; name: string; whatsapp?: string | null } | null;
  /**
   * Coordenadores da casa (story 194): lista derivada de `Staff` (house_id +
   * role COORDINATOR + não desligado), com o titular incluído. Opcional porque
   * só o detalhe (`GET /houses/:id`) popula — `findAll` não agrega.
   */
  coordinators?: HouseStaffSummary[];
  phone: string | null;
  isMotherHouse: boolean;
  thumbnailUrl: string | null;
  photos: HousePhoto[];
  activeResidentsCount: number;
  staffCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHouseInput {
  name: string;
  generalCapacity?: number | null;
  staffCapacity?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  coordinatorId?: string | null;
  phone?: string | null;
  isMotherHouse?: boolean;
}

export type UpdateHouseInput = Partial<CreateHouseInput>;

export { HouseCapacityRequestStatus };

export interface HouseCapacityRequest {
  id: string;
  houseId: string;
  requestedGeneralCapacity: number;
  requestedStaffCapacity: number;
  previousGeneralCapacity: number | null;
  previousStaffCapacity: number | null;
  status: HouseCapacityRequestStatus;
  requestedById: string;
  requestedBy?: { id: string; name: string } | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCapacityRequestInput {
  generalCapacity: number;
  staffCapacity: number;
}

// ─── Census (contagem) ───────────────────────────────────────────────────────

export interface CensusConcludeInput {
  houseId: string;
  confirmedCount: number;
  total: number;
}

export interface CensusPendingResident {
  id: string;
  name: string;
  photoThumbUrl: string | null;
  entryDate: string | null;
  createdAt: string;
}

export interface HouseMinistry {
  id: string;
  name: string;
  leaderId: string | null;
  // Story 205: filho em acolhimento na casa volta a poder liderar.
  leaderType: MinistryLeaderType | null;
  leaderName: string | null;
  // Story 207: nível do líder servo; líder filho ou sem líder → null.
  leaderRank: ServantRank | null;
  // Só filhos em acolhimento na casa do ministério (story 205, decisão 8).
  filhoCount: number;
  servoCount: number;
}

export type MinistryLeaderType = 'STAFF' | 'RESIDENT';

export interface AddMinistryInput {
  name: string;
}

export interface HouseRule {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface CreateHouseRuleInput {
  title: string;
  content: string;
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export interface Staff {
  id: string;
  name: string;
  // WhatsApp do servo — também é o identificador de login (story 97).
  whatsapp: string | null;
  photoUrl: string | null;
  // Assinatura do usuário para documentos gerados (story 128). URL assinada na leitura.
  signatureUrl?: string | null;
  houseId: string | null;
  house: { id: string; name: string } | null;
  supportGroupId: string | null;
  supportGroup: { id: string; name: string } | null;
  rank: ServantRank | null;
  formerResidentId: string | null;
  promotedAt: string | null;
  /** Story 217 — data do desligamento (`YYYY-MM-DD`); `null` = servo ativo. */
  dismissedAt?: string | null;
  // Ficha pessoal (espelha os dados do filho)
  birthDate: string | null;
  cpf: string | null;
  rg: string | null;
  nationality: string | null;
  gender: Gender | null;
  city: string | null;
  state: string | null;
  address: string | null;
  maritalStatus: MaritalStatus | null;
  children: number;
  occupation: string | null;
  education: string | null;
  religion: string | null;
  user: { email: string | null; role: Role };
  /** Conta de acesso do servo (coluna `user_id`; já vinha na resposta — story 199 tipou). */
  userId?: string;
}

/**
 * Resumo devolvido por `GET /houses/:id/staff` (story 181).
 *
 * A rota nunca devolveu a entidade `Staff` inteira — são só estas quatro
 * colunas, por minimização de dado pessoal (a rota é lida por SERVANT). O tipo
 * existe para o contrato parar de mentir `Staff[]`.
 */
export interface HouseStaffSummary {
  id: string;
  name: string;
  whatsapp: string | null;
  photoUrl: string | null;
}

/** Ministério liderado por um servo, como vem em `HouseStaffMember.ledMinistries`. */
export interface LedMinistrySummary {
  id: string;
  name: string;
}

/**
 * Linha de `GET /houses/:id/staff` (story 204): o resumo da 181 mais o papel do
 * usuário e os ministérios (não excluídos) que o servo lidera. Aditivo — quem só
 * lê as quatro colunas do resumo segue funcionando.
 */
export interface HouseStaffMember extends HouseStaffSummary {
  role: Role;
  /** Story 207: nível do servo; `null` para coordenador/admin ou servo sem nível. */
  rank: ServantRank | null;
  ledMinistries: LedMinistrySummary[];
}

export interface PromoteToServantInput {
  email?: string;
  password?: string;
  houseId?: string;
  rank?: ServantRank;
  date?: string;
}

export interface StaffMe {
  id: string;
  userId: string;
  name: string;
  whatsapp: string | null;
  photoUrl: string | null;
  // Assinatura do usuário para documentos gerados (story 128). URL assinada na leitura.
  signatureUrl?: string | null;
  houseId: string | null;
  house: { id: string; name: string } | null;
  supportGroupId: string | null;
  supportGroup: { id: string; name: string } | null;
  // Story 207: nível do servo (a rota sempre devolveu; o tipo passa a declarar).
  // Opcional: o staff persistido de login antigo pode não ter o campo.
  rank?: ServantRank | null;
  user: { email: string; role: Role };
  permissions: StaffPermissionType[];
}

export interface CreateStaffInput {
  name: string;
  email?: string | null;
  password: string;
  role: Role;
  houseId?: string | null;
  supportGroupId?: string | null;
  whatsapp?: string | null;
  rank?: ServantRank | null;
  // Ficha pessoal (espelha os dados do filho)
  birthDate?: string | null;
  cpf?: string | null;
  rg?: string | null;
  nationality?: string | null;
  gender?: Gender | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  maritalStatus?: MaritalStatus | null;
  children?: number;
  occupation?: string | null;
  education?: string | null;
  religion?: string | null;
}

export type UpdateStaffInput = Partial<CreateStaffInput>;

export interface UpdateStaffMeInput {
  name?: string;
  whatsapp?: string | null;
  email?: string;
}

// ─── Resident ────────────────────────────────────────────────────────────────

export interface Resident {
  id: string;
  name: string;
  status: ResidentStatus;
  userId: string | null;
  user: { email: string } | null;
  birthDate: string | null;
  cpf: string | null;
  rg: string | null;
  nationality: string | null;
  city: string | null;
  state: string | null;
  gender: Gender | null;
  address: string | null;
  entryDate: string | null;
  exitDate: string | null;
  contactPhone: string | null;
  email: string | null;
  maritalStatus: MaritalStatus | null;
  children: number;
  occupation: string | null;
  education: string | null;
  religion: string | null;
  addiction: string | null;
  healthIssues: string | null;
  continuousMedication: string | null;
  weight: number | null;
  height: number | null;
  familyInvestment: FamilyInvestment | null;
  familyInvestmentAmount: number | null;
  contributionDueDay: number | null;
  contributionExempt: boolean;
  lastContributionDate: string | null;
  photoUrl: string | null;
  photoThumbUrl: string | null;
  house: { id: string; name: string } | null;
  // Nulo só para ARCHIVED (import sem correspondência na planilha).
  houseId: string | null;
  // Story 205: só filho em acolhimento tem ministério (saída/transferência zera).
  ministry: { id: string; name: string } | null;
  ministryId: string | null;
}

export interface CreateResidentInput {
  name: string;
  // Obrigatória para todo status exceto ARCHIVED.
  houseId?: string | null;
  birthDate?: string | null;
  cpf?: string | null;
  status?: ResidentStatus;
  entryDate?: string | null;
  exitDate?: string | null;
  gender?: Gender | null;
  rg?: string | null;
  nationality?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  maritalStatus?: MaritalStatus | null;
  children?: number;
  occupation?: string | null;
  guardianId?: string | null;
  education?: string | null;
  healthIssues?: string | null;
  continuousMedication?: string | null;
  religion?: string | null;
  addiction?: string | null;
  weight?: number | null;
  height?: number | null;
  familyInvestment?: FamilyInvestment | null;
  familyInvestmentAmount?: number | null;
  contributionDueDay?: number | null;
  // Story 205: ministério no acolhimento/ficha. 400 se o filho não estiver em
  // acolhimento na casa do ministério; `null` tira do ministério.
  ministryId?: string | null;
  // Histórico de acolhimentos do import em lote (story 121). Quando presente com
  // mais de um item, o backend cria um `Admission` por par entrada→saída; o topo
  // do resident reflete o mais recente. Opcional — ignorado no create normal.
  admissions?: ImportAdmission[];
}

export type UpdateResidentInput = Partial<CreateResidentInput>;

// Correção dos "dados de identidade" na reintrodução (story 147). Só os 5 campos
// não-editáveis do banner; endpoint dedicado `PATCH /residents/:id/identity`.
export interface UpdateResidentIdentityInput {
  name?: string;
  cpf?: string | null;
  rg?: string | null;
  birthDate?: string | null;
  gender?: Gender | null;
}

export interface ResidentMe {
  id: string;
  name: string;
  houseId: string;
  userId: string;
  photoUrl: string | null;
  photoThumbUrl: string | null;
}

export interface GenerateResidentAccessInput {
  email: string;
  password: string;
}

export interface ResetResidentPasswordInput {
  password: string;
}

export interface ListResidentsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ResidentStatus;
  houseId?: string;
  overdueContribution?: boolean;
  /** Coluna de ordenação (story 129). Backend default: `name`. */
  sort?: 'entryDate' | 'name';
  /** Direção da ordenação (story 129). Backend default: `asc`. */
  order?: 'asc' | 'desc';
}

export interface ResidentDocument {
  id: string;
  residentId: string;
  templateId: string;
  templateName: string;
  signAtAdmission: boolean;
  signed: boolean;
  signedFileUrl: string | null;
  signedAt: string | null;
  withinWindow: boolean;
}

export interface ResidentAttachment {
  id: string;
  residentId: string;
  filename: string;
  fileUrl: string;
  createdAt: string;
}

// Ordem devolvida por `GET /residents/:id/admissions`: entrada DESC (NULLS LAST),
// desempate por criação DESC — índice 0 é o acolhimento ATUAL (story 164).
export interface Admission {
  id: string;
  residentId: string;
  // Nullable desde a migration `AllowNullResidentHouse` (filho ARCHIVED sem casa).
  houseId: string | null;
  house: { id: string; name: string } | null;
  ministryId: string | null;
  entryDate: string | null;
  exitDate: string | null;
  status: string;
  healthIssues: string | null;
  continuousMedication: string | null;
  weight: number | null;
  height: number | null;
  familyInvestment: FamilyInvestment | null;
  familyInvestmentAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReadmitResidentInput {
  houseId: string;
  entryDate?: string | null;
  address?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  maritalStatus?: string | null;
  children?: number;
  occupation?: string | null;
  education?: string | null;
  religion?: string | null;
  addiction?: string | null;
  healthIssues?: string | null;
  continuousMedication?: string | null;
  weight?: number | null;
  height?: number | null;
  familyInvestment?: FamilyInvestment | null;
  familyInvestmentAmount?: number | null;
  contributionDueDay?: number | null;
}

// ─── Follow Up ───────────────────────────────────────────────────────────────

export type { FollowUpType, FollowUpAccessLevel };

export interface ResidentFollowUp {
  id: string;
  residentId: string;
  date: string;
  type: FollowUpType;
  description: string | null;
  accessLevel: FollowUpAccessLevel;
  attachmentUrl: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFollowUpInput {
  date: string;
  type: FollowUpType;
  description?: string;
  accessLevel: FollowUpAccessLevel;
}

// ─── Incident ────────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  date: string;
  severity: IncidentSeverity;
  description: string;
  houseId: string;
  responsible: { id: string; name: string };
  resident: { id: string; name: string } | null;
}

export interface CreateIncidentInput {
  date: string;
  severity: IncidentSeverity;
  description: string;
  houseId: string;
  responsibleId: string;
  residentId?: string | null;
}

// ─── Storeroom ───────────────────────────────────────────────────────────────

export interface StoreroomItem {
  id: string;
  name: string;
  unit: string;
  houseId: string;
  currentQuantity: number;
  weeklyAverageUsage: number | null;
  weeklyAverageCalculatedAt: string | null;
  weeklyAverageWindowStart: string | null;
  weeklyAverageWindowEnd: string | null;
}

export interface CreateItemInput {
  name: string;
  unit: string;
  houseId: string;
}

export interface UpdateItemInput {
  name?: string;
  unit?: string;
}

export interface StoreroomMovement {
  id: string;
  itemId: string;
  item: { id: string; name: string; unit: string };
  type: MovementType;
  quantity: number;
  responsibleId: string;
  responsible: { id: string; name: string };
  date: string;
  notes: string | null;
}

export interface CreateMovementInput {
  itemId: string;
  type: MovementType;
  quantity: number;
  responsibleId: string;
  date: string;
  notes?: string | null;
}

// ─── Supply Room ─────────────────────────────────────────────────────────────

export interface SupplyRoomItem {
  id: string;
  name: string;
  unit: string;
  category: SupplyRoomCategory;
  houseId: string;
  currentQuantity: number;
}

export interface CreateSupplyItemInput {
  name: string;
  unit: string;
  category: SupplyRoomCategory;
  houseId: string;
}

export interface UpdateSupplyItemInput {
  name?: string;
  unit?: string;
  category?: SupplyRoomCategory;
}

export interface SupplyRoomMovement {
  id: string;
  itemId: string;
  item: { id: string; name: string; unit: string; category: SupplyRoomCategory };
  type: MovementType;
  quantity: number;
  responsibleId: string;
  responsible: { id: string; name: string };
  date: string;
  notes: string | null;
}

export interface CreateSupplyMovementInput {
  itemId: string;
  type: MovementType;
  quantity: number;
  responsibleId: string;
  date: string;
  notes?: string | null;
}

// ─── Ministry ────────────────────────────────────────────────────────────────

export interface Ministry {
  id: string;
  name: string;
}

// Story 205: filho (FILHO) volta a ser membro, ao lado dos servos (SERVO). Só
// filho em acolhimento na casa do ministério aparece.
export interface MinistryMember {
  id: string;
  name: string;
  role: 'FILHO' | 'SERVO';
}

export interface MinistryDetail {
  id: string;
  name: string;
  houseId: string;
  leaderId: string | null;
  leaderType: MinistryLeaderType | null;
  leaderName: string | null;
  // Story 207: nível do líder servo; líder filho ou sem líder → null.
  leaderRank: ServantRank | null;
  members: MinistryMember[];
}

export interface MinistryTask {
  id: string;
  title: string;
  completed: boolean;
  repetition: 'NONE' | 'DAILY';
  completedAt: string | null;
  createdAt: string;
}

export interface CreateMinistryInput {
  name: string;
}

export interface UpdateMinistryInput {
  name?: string;
  leaderId?: string | null;
  leaderType?: MinistryLeaderType | null;
}

export interface CreateMinistryTaskInput {
  title: string;
  repetition?: 'NONE' | 'DAILY';
}

export interface UpdateMinistryTaskInput {
  title?: string;
  completed?: boolean;
  repetition?: 'NONE' | 'DAILY';
}

// ─── Relative ────────────────────────────────────────────────────────────────

export interface Relative {
  id: string;
  name: string;
  phone: string | null;
  relationship: string | null;
  isResponsible: boolean;
  userId: string | null;
}

export interface RelativeMe {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  relationship: string | null;
  residentId: string;
  residentName: string;
  residentPhotoUrl: string | null;
  houseId: string;
  houseName: string;
  houseAddress: string | null;
  houseCity: string | null;
  housePhone: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
}

export interface UpdateRelativeMeInput {
  name?: string;
  phone?: string | null;
}

export interface CreateRelativeInput {
  name: string;
  residentId: string;
  phone?: string | null;
  relationship?: string | null;
  isResponsible?: boolean;
}

export interface GenerateRelativeAccessInput {
  email: string;
  password: string;
}

export interface ResetRelativePasswordInput {
  password: string;
}

// ─── Staff Permissions ────────────────────────────────────────────────────────

export interface StaffPermission {
  id: string;
  staffId: string;
  permissionType: StaffPermissionType;
  createdAt: string;
}

export interface AddStaffPermissionInput {
  type: StaffPermissionType;
}

// ─── Support Group Relative Checkin ──────────────────────────────────────────

export interface SupportGroupRelativeCheckin {
  id: string;
  meetingId: string;
  relativeId: string;
  relativeName: string;
  checkedInAt: string;
}

export interface RelativeCheckinInput {
  token: string;
}

// ─── Support Group ────────────────────────────────────────────────────────────

export interface SupportGroup {
  id: string;
  name: string;
  churchName: string;
  address: string;
  coordinatorId: string | null;
  coordinatorName: string | null;
  dayOfWeek: number;
  createdAt: string;
}

export interface CreateSupportGroupInput {
  name: string;
  churchName: string;
  address: string;
  coordinatorId?: string | null;
  dayOfWeek: number;
}

export type UpdateSupportGroupInput = Partial<CreateSupportGroupInput>;

export interface SupportGroupMeeting {
  id: string;
  supportGroupId: string;
  supportGroupName: string;
  date: string;
  notes: string | null;
  checkinToken: string;
  checkinCount: number;
  relativeCheckinCount: number;
  createdAt: string;
}

export interface MeetingRelativeCheckin {
  id: string;
  relativeId: string;
  relativeName: string;
  residentId: string;
  residentName: string;
}

export interface RelativeCheckinHistoryItem {
  meetingId: string;
  date: string;
  groupName: string;
}

export interface SupportGroupMeetingDetail {
  id: string;
  supportGroupId: string;
  supportGroupName: string;
  date: string;
  notes: string | null;
  checkinToken: string;
  checkins: SupportGroupCheckin[];
}

export interface SupportGroupCheckin {
  id: string;
  meetingId: string;
  residentId: string;
  residentName: string;
  checkedInAt: string;
}

export interface CreateMeetingInput {
  date: string;
  notes?: string | null;
}

export interface AddCheckinInput {
  residentId: string;
}

// ─── Bible Course ────────────────────────────────────────────────────────────

export type BibleCourseClassStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
export type BibleCourseEnrollmentStatus = 'ENROLLED' | 'COMPLETED' | 'DROPPED';

export interface BibleCourseClass {
  id: string;
  name: string;
  houseId: string;
  houseName: string;
  startDate: string;
  endDate: string;
  status: BibleCourseClassStatus;
  enrollmentCount: number;
  createdAt: string;
}

export interface BibleCourseEnrollment {
  id: string;
  residentId: string;
  residentName: string;
  residentHouseId: string | null;
  residentHouseName: string | null;
  // Thumb do filho na listagem de matriculados (story 180); null sem foto.
  residentPhotoThumbUrl: string | null;
  status: BibleCourseEnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  notes: string | null;
}

export interface BibleCourseClassDetail {
  id: string;
  name: string;
  houseId: string;
  houseName: string;
  startDate: string;
  endDate: string;
  status: BibleCourseClassStatus;
  notes: string | null;
  createdAt: string;
  enrollments: BibleCourseEnrollment[];
}

export interface CreateBibleCourseClassInput {
  name: string;
  houseId: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
}

export interface UpdateBibleCourseClassInput {
  name?: string;
  houseId?: string;
  startDate?: string;
  endDate?: string;
  status?: BibleCourseClassStatus;
  notes?: string | null;
}

export interface EnrollResidentInput {
  residentId: string;
  notes?: string | null;
}

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

export interface BulkEnrollInput {
  residentIds: string[];
}

export interface BulkEnrollResult {
  enrolled: number;
}

export interface UpdateBibleCourseEnrollmentInput {
  status?: BibleCourseEnrollmentStatus;
  notes?: string | null;
}

export interface BibleCourseModule {
  id: string;
  name: string;
  sequence: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBibleCourseModuleInput {
  name: string;
  sequence?: number;
  notes?: string | null;
}

export interface UpdateBibleCourseModuleInput {
  name?: string;
  sequence?: number;
  notes?: string | null;
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

export interface UpsertBibleGradeInput {
  examGrade?: number | null;
  workGrade?: number | null;
}

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

// ─── Document Template ───────────────────────────────────────────────────────

export interface DocumentTemplate {
  id: string;
  name: string;
  content: string;
  isRequired: boolean;
  signAtAdmission: boolean;
  // Story 160 — para quais filhos este documento pode ser gerado (por status).
  availableFor: TemplateAvailability;
  // Story 178 — que tipo de documento o template descreve. Legado (e omissão do
  // backend) é RESIDENT: o consumidor de documento de filho não muda de vida.
  kind: TemplateKind;
  // Story 178 — só em kind = RECEIPT: qual recibo este template imprime.
  receiptType: ReceiptType | null;
  updatedAt: string;
}

export interface CreateDocumentTemplateInput {
  name: string;
  content: string;
  isRequired: boolean;
  signAtAdmission?: boolean;
  availableFor?: TemplateAvailability;
  kind?: TemplateKind;
  receiptType?: ReceiptType;
}

export interface UpdateDocumentTemplateInput {
  name?: string;
  content?: string;
  isRequired?: boolean;
  signAtAdmission?: boolean;
  availableFor?: TemplateAvailability;
  kind?: TemplateKind;
  receiptType?: ReceiptType | null;
}

// ─── LGPD ─────────────────────────────────────────────────────────────────────

// Documento a assinar no acolhimento (template signAtAdmission) + status.
export interface AdmissionDocument {
  templateId: string;
  templateName: string;
  signed: boolean;
  signedFileUrl: string | null;
  signedAt: string | null;
  pdfPath: string;
}

export type ConsentPurpose = 'IMAGE_PUBLICATION' | 'RELIGIOUS_DISCLOSURE';
export type ConsentSubjectType = 'RESIDENT' | 'RELATIVE';

export interface ConsentStatus {
  purpose: ConsentPurpose;
  granted: boolean;
  termVersion: string | null;
  since: string | null;
}

export interface ConsentRecord {
  id: string;
  subjectType: ConsentSubjectType;
  subjectId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  termVersion: string | null;
  recordedByUserId: string | null;
  createdAt: string;
}

export interface RegisterConsentInput {
  subjectType: ConsentSubjectType;
  subjectId: string;
  purpose: ConsentPurpose;
  termVersion?: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  role: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  httpMethod: string | null;
  path: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// ─── Auditoria de ações (story 199) ──────────────────────────────────────────

/** Filtros de `GET /audit`. Datas em ISO 8601; período padrão: últimos 30 dias. */
export interface AuditEventFilters {
  from?: string;
  to?: string;
  userId?: string;
  houseId?: string;
  action?: string;
  targetType?: string;
  /** Casa como alvo OU recurso principal (ex.: filho da parcela). */
  targetId?: string;
  outcome?: AuditOutcome;
  cursor?: string;
  /** Default 50, máximo 100. */
  limit?: number;
}

export interface AuditEventSummary {
  id: string;
  createdAt: string;
  action: string;
  /** `null` em eventos legados (antes da story 199). */
  outcome: AuditOutcome | null;
  reason: LoginFailureReason | null;
  userId: string | null;
  userName: string | null;
  role: string | null;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  houseId: string | null;
  houseName: string | null;
  previousHouseId: string | null;
  previousHouseName: string | null;
  parentType: string | null;
  parentId: string | null;
  parentName: string | null;
  changedFields: string[] | null;
  /** `false` = evento legado: sem diff nem contexto ("detalhe indisponível"). */
  hasDetail: boolean;
}

export interface AuditEventDetail extends AuditEventSummary {
  changes: AuditChange[] | null;
  context: Record<string, unknown> | null;
  httpMethod: string | null;
  path: string | null;
  ipAddress: string | null;
  correlationId: string | null;
}

export interface AuditEventPage {
  items: AuditEventSummary[];
  nextCursor: string | null;
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  id: string;
  timerResetFrequency: TimerResetFrequency;
  dailyUsageMinutes: number;
  updatedAt: string;
}

export interface UpdateAppSettingsInput {
  timerResetFrequency?: TimerResetFrequency;
  dailyUsageMinutes?: number;
}

// ─── User Preferences (story 130) ─────────────────────────────────────────────

export type { UserPreferences, ResidentsFiltersPreference, StaffFiltersPreference };

// ─── Resident Session ─────────────────────────────────────────────────────────

export interface UsageSessionToday {
  secondsUsed: number;
  limitSeconds: number;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  residentId: string | null;
  relativeId: string;
  staffId: string | null;
  senderUserId: string;
  senderName: string;
  senderProfileType: string;
  recipientName: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  status: MessageStatus;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface Conversation {
  residentId: string;
  residentName: string;
  relativeId: string;
  relativeName: string;
  relativePhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  pendingCount: number;
  houseId: string;
  houseName: string;
}

export interface DirectConversation {
  staffId: string;
  staffName: string;
  relativeId: string;
  relativeName: string;
  relativePhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  residentId: string;
  residentName: string;
}

export interface StaffThreadSummary {
  staffId: string;
  staffName: string;
  staffPhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface SendMessageInput {
  residentId: string;
  relativeId: string;
  content?: string;
  attachmentUrl?: string;
  attachmentType?: string;
}

export interface SendDirectMessageInput {
  staffId: string;
  relativeId: string;
  content?: string;
  attachmentUrl?: string;
  attachmentType?: string;
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export interface WishlistItem {
  id: string;
  residentId: string;
  description: string;
  quantity: number;
  status: WishlistStatus;
  isRemovalRequested: boolean;
  rejectionReason: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddWishlistItemInput {
  description: string;
  quantity?: number;
}

export interface RejectWishlistItemInput {
  reason?: string;
}

export interface WishlistPendingItem extends WishlistItem {
  residentName: string;
}

// ─── Resident Import ──────────────────────────────────────────────────────────

export interface BulkCreateContributionsInput {
  months: { date: string }[];
}

/** Payload do commit do import aprovado (story 103). */
export interface CommitImportPayload {
  resident: CreateResidentInput;
  relatives: CommitImportRelative[];
  contributionMonths: string[];
  photoBase64?: string | null;
}

/** Um arquivo de ficha cujo nome casa com um filho já cadastrado. */
export interface ImportFileMatch {
  fileName: string;
  residentId: string;
  residentName: string;
}

/** Resposta do check-files: fichas que casam com filhos já cadastrados. */
export interface CheckImportFilesResult {
  matches: ImportFileMatch[];
}

/** Resposta do commit do import: filho criado + resumo das contribuições. */
export interface CommitImportResult {
  resident: Resident;
  contributionsCreated: ImportContributionsSummary;
}

export type {
  ParseDocxRelative,
  ParseDocxResult,
  MatchStatus,
  ImportPreviewResult,
  SpreadsheetImportRow,
  ImportAdmission,
  ParseSpreadsheetResult,
  ImportConflict,
  CheckImportConflictResult,
  CommitImportRelative,
  ImportContributionsSummary,
  ResidentLookupItem,
} from '@fonte/types';

// ─── Street Sales ─────────────────────────────────────────────────────────────

export interface CreateStreetSaleInput {
  houseId: string;
  date: string;
  type: StreetSaleType;
  quantity: number;
  amountPix: number;
  amountCash: number;
  amountCard: number;
}

export type UpdateStreetSaleInput = Partial<CreateStreetSaleInput>;

export interface GetStreetSalesReportParams {
  type: StreetSaleType;
  month: string;
  houseId?: string;
}

// ─── Associados ─────────────────────────────────────────────────────────────────

export interface CreateAssociateInput {
  name: string;
  whatsapp: string;
  email?: string;
  contributionAmount: number;
  dueDay: number;
}

export type UpdateAssociateInput = Partial<CreateAssociateInput>;

// ─── Backup ───────────────────────────────────────────────────────────────────

export interface BackupListItem {
  key: string;
  size: number;
  createdAt: string;
}

export interface BackupSummary {
  skipped: boolean;
  reason?: string;
  dumpKey?: string;
  dumpSize?: number;
  filesCopied?: number;
  filesTotal?: number;
  prunedDumps?: string[];
}

// ─── Observabilidade (story 191) ──────────────────────────────────────────────

/**
 * `GET /observability/health` — liveness PÚBLICO (compose/nginx). De propósito
 * não expõe memória, versão nem rotas: quem sonda o host não ganha nada.
 */
export interface ObservabilityHealth {
  status: 'ok' | 'degraded';
  uptimeSec: number;
  db: 'up' | 'down';
}

/** Saúde do processo. Em 1 vCPU, `eventLoopLagMs` é o sinal mais importante. */
export interface ObservabilityRuntime {
  uptimeSec: number;
  eventLoopLagMs: { p50: number; p99: number; max: number };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  /** % de CPU do processo desde a leitura anterior. */
  cpuPercent: number;
  nodeVersion: string;
}

/**
 * Agregado de uma rota desde o boot (ou desde o último `reset`). `route` é a
 * chave `${METHOD} ${path normalizado}`; rotas acima do cap de cardinalidade
 * caem na chave `OTHER`.
 *
 * `p50`/`p95` são aproximados por histograma de buckets fixos, e `avgDbMs` é
 * PARCIAL (o TypeORM só reporta duração de query acima de 1ms) — a contagem
 * `avgDbQueries` é o número confiável para caçar N+1.
 */
export interface ObservabilityRouteStats {
  route: string;
  count: number;
  errors: number;
  avgDurationMs: number;
  maxDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  avgCpuMs: number;
  avgDbQueries: number;
  avgDbMs: number;
  avgHeapDeltaKb: number;
  lastAt: string;
}

/** Item do ring buffer das últimas requisições. Sem dado pessoal (LGPD). */
export interface ObservabilityRecentRequest {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  cpuMs: number;
  dbQueries: number;
  dbMs: number;
  heapDeltaKb: number;
  at: string;
}

/** `GET /observability/stats` (ADMIN). Janela viva do processo, não histórico. */
export interface ObservabilityStats {
  startedAt: string;
  runtime: ObservabilityRuntime;
  routes: ObservabilityRouteStats[];
  recent: ObservabilityRecentRequest[];
}

/** `POST /observability/reset` (ADMIN). */
export interface ObservabilityResetResponse {
  startedAt: string;
}

// ─── Offline snapshot da casa (story 177) ─────────────────────────────────────

export type { OfflineSnapshotDeleted };
export { SNAPSHOT_MAX_DELTA_AGE_DAYS };

/**
 * Pacote offline de uma casa: resposta de
 * `GET /houses/:houseId/offline-snapshot?since=<ISO>`.
 *
 * Substitui o fan-out de `1 + N×4` requests que o `ops.fonte` fazia para aquecer
 * a casa. `syncedAt` é o relógio do servidor e é o que o cliente guarda para o
 * próximo `since`; `full: true` manda substituir o store em vez de mesclar.
 *
 * O bloco `receivables` leva o **recorte** do carnê (story 186) — mês, status e
 * o filho dono da parcela —, nunca valor ou pagamento: o pacote vai para o
 * aparelho de todo operador da casa.
 */
export type HouseOfflineSnapshotResponse = HouseOfflineSnapshot<{
  resident: Resident;
  followUp: ResidentFollowUp;
  consent: ConsentRecord;
  receivable: ResidentReceivableSummary & { residentId: string };
  attachment: ResidentAttachment;
  ministry: HouseMinistry;
}>;
