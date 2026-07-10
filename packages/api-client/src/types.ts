import type {
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
} from '@fonte/types';
import {
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
  coordinatorId: string | null;
  coordinator: { id: string; name: string; whatsapp?: string | null } | null;
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
  leaderType: 'STAFF' | 'RESIDENT' | null;
  leaderName: string | null;
  filhoCount: number;
  servoCount: number;
}

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
  houseId: string | null;
  house: { id: string; name: string } | null;
  supportGroupId: string | null;
  supportGroup: { id: string; name: string } | null;
  rank: ServantRank | null;
  formerResidentId: string | null;
  promotedAt: string | null;
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
  houseId: string | null;
  house: { id: string; name: string } | null;
  supportGroupId: string | null;
  supportGroup: { id: string; name: string } | null;
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
  ministryId?: string | null;
  // Histórico de acolhimentos do import em lote (story 121). Quando presente com
  // mais de um item, o backend cria um `Admission` por par entrada→saída; o topo
  // do resident reflete o mais recente. Opcional — ignorado no create normal.
  admissions?: ImportAdmission[];
}

export type UpdateResidentInput = Partial<CreateResidentInput>;

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

export interface Admission {
  id: string;
  residentId: string;
  houseId: string;
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
  leaderType: 'STAFF' | 'RESIDENT' | null;
  leaderName: string | null;
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
  leaderType?: 'STAFF' | 'RESIDENT' | null;
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
  updatedAt: string;
}

export interface CreateDocumentTemplateInput {
  name: string;
  content: string;
  isRequired: boolean;
  signAtAdmission?: boolean;
}

export interface UpdateDocumentTemplateInput {
  name?: string;
  content?: string;
  isRequired?: boolean;
  signAtAdmission?: boolean;
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
