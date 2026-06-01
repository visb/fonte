import type {
  ResidentStatus,
  Gender,
  MaritalStatus,
  MessageStatus,
  ProfileType,
  Role,
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
  StreetSaleType,
  StreetSale,
  StreetSalesReportResponse,
  StreetSalesReportByHouse,
  SupplyRoomCategory,
} from '@fonte/types';

export type { ContributionReportItem, ContributionsReportResponse, GetContributionsReportParams };
export type { StreetSaleType, StreetSale, StreetSalesReportResponse, StreetSalesReportByHouse };
export type { SupplyRoomCategory };

export type { FamilyInvestment };

export type { PaginatedResponse };

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
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
  coordinator: { id: string; name: string; phone?: string | null } | null;
  phone: string | null;
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
}

export type UpdateHouseInput = Partial<CreateHouseInput>;

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
  phone: string | null;
  photoUrl: string | null;
  houseId: string | null;
  house: { id: string; name: string } | null;
  supportGroupId: string | null;
  supportGroup: { id: string; name: string } | null;
  user: { email: string; role: Role };
}

export interface StaffMe {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
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
  email: string;
  password: string;
  role: Role;
  houseId?: string | null;
  supportGroupId?: string | null;
  phone?: string | null;
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string | null;
  houseId?: string | null;
  supportGroupId?: string | null;
  email?: string;
  role?: Role;
  password?: string;
}

export interface UpdateStaffMeInput {
  name?: string;
  phone?: string | null;
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
  lastContributionDate: string | null;
  photoUrl: string | null;
  house: { id: string; name: string } | null;
  houseId: string;
  ministry: { id: string; name: string } | null;
  ministryId: string | null;
}

export interface CreateResidentInput {
  name: string;
  houseId: string;
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
}

export type UpdateResidentInput = Partial<CreateResidentInput>;

export interface ResidentMe {
  id: string;
  name: string;
  houseId: string;
  userId: string;
  photoUrl: string | null;
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
  overdueContribution?: boolean;
}

export interface ResidentDocument {
  id: string;
  residentId: string;
  templateId: string;
  templateName: string;
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

// ─── Document Template ───────────────────────────────────────────────────────

export interface DocumentTemplate {
  id: string;
  name: string;
  content: string;
  isRequired: boolean;
  updatedAt: string;
}

export interface CreateDocumentTemplateInput {
  name: string;
  content: string;
  isRequired: boolean;
}

export interface UpdateDocumentTemplateInput {
  name?: string;
  content?: string;
  isRequired?: boolean;
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

export interface ParseDocxRelative {
  name: string;
  phone: string;
  relationship: string;
}

export interface ParseDocxResult {
  resident: Record<string, unknown>;
  relatives: ParseDocxRelative[];
  warnings: Record<string, string>;
  houseName: string;
  rawText: string;
  photoBase64: string | null;
}

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
