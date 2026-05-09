import type {
  ResidentStatus,
  Gender,
  MaritalStatus,
  Role,
  IncidentSeverity,
  MovementType,
} from '@fonte/types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
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
  ministryId: string;
  ministryName: string;
  leaderId: string | null;
  leaderType: 'STAFF' | 'RESIDENT' | null;
  leaderName: string | null;
}

export interface AddMinistryInput {
  ministryId: string;
  leaderId?: string | null;
  leaderType?: 'STAFF' | 'RESIDENT' | null;
}

export interface UpdateMinistryAssignmentInput {
  leaderId: string | null;
  leaderType: 'STAFF' | 'RESIDENT' | null;
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
  houseId: string;
  house: { id: string; name: string } | null;
  user: { email: string; role: Role };
}

export interface StaffMe {
  id: string;
  name: string;
  phone: string | null;
  houseId: string;
  house: { id: string; name: string } | null;
  user: { email: string; role: Role };
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  houseId: string;
  phone?: string | null;
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string | null;
  houseId?: string;
  email?: string;
  role?: Role;
  password?: string;
}

// ─── Resident ────────────────────────────────────────────────────────────────

export interface Resident {
  id: string;
  name: string;
  status: ResidentStatus;
  birthDate: string | null;
  cpf: string | null;
  rg: string | null;
  gender: Gender | null;
  address: string | null;
  entryDate: string | null;
  exitDate: string | null;
  contactPhone: string | null;
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
  familyInvestment: string | null;
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
  address?: string | null;
  contactPhone?: string | null;
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
  familyInvestment?: string | null;
  ministryId?: string | null;
}

export type UpdateResidentInput = Partial<CreateResidentInput>;

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

// ─── Ministry ────────────────────────────────────────────────────────────────

export interface Ministry {
  id: string;
  name: string;
}

export interface CreateMinistryInput {
  name: string;
}

export interface UpdateMinistryInput {
  name?: string;
}

// ─── Relative ────────────────────────────────────────────────────────────────

export interface Relative {
  id: string;
  name: string;
  phone: string | null;
  relationship: string | null;
}

export interface CreateRelativeInput {
  name: string;
  residentId: string;
  phone?: string | null;
  relationship?: string | null;
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
