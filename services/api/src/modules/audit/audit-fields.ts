import type { AuditFieldMap } from './audit-diff';

/**
 * Listas explícitas de campos por domínio (story 199). Campo fora da lista não
 * entra no log. Dados de saúde/religião/texto livre são `redacted` (LGPD art. 5,
 * II — dado sensível); documentos e contatos são `masked`; arquivos são `file`.
 */

export const RESIDENT_AUDIT_FIELDS: AuditFieldMap = {
  name: 'plain',
  birthDate: 'plain',
  cpf: 'masked',
  rg: 'masked',
  status: 'plain',
  userId: 'plain',
  houseId: 'plain',
  ministryId: 'plain',
  entryDate: 'plain',
  exitDate: 'plain',
  gender: 'plain',
  nationality: 'plain',
  city: 'plain',
  state: 'plain',
  address: 'redacted',
  contactPhone: 'masked',
  email: 'masked',
  maritalStatus: 'plain',
  children: 'plain',
  occupation: 'plain',
  education: 'plain',
  healthIssues: 'redacted',
  continuousMedication: 'redacted',
  religion: 'redacted',
  addiction: 'redacted',
  weight: 'redacted',
  height: 'redacted',
  familyInvestment: 'plain',
  familyInvestmentAmount: 'plain',
  contributionDueDay: 'plain',
  contributionExempt: 'plain',
  photoUrl: 'file',
};

/**
 * Story 215 — passagem editada pela aba Histórico: só os campos editáveis ali.
 * Saúde/peso/investimento ficam de fora (são da ficha, não desta tela).
 */
export const ADMISSION_AUDIT_FIELDS: AuditFieldMap = {
  residentId: 'plain',
  houseId: 'plain',
  entryDate: 'plain',
  exitDate: 'plain',
  status: 'plain',
};

/** Exclusões (soft delete): só o vínculo — nada de cópia da ficha no log. */
export const RESIDENT_DELETE_AUDIT_FIELDS: AuditFieldMap = {
  status: 'plain',
  houseId: 'plain',
  entryDate: 'plain',
  exitDate: 'plain',
};

export const STAFF_DELETE_AUDIT_FIELDS: AuditFieldMap = {
  houseId: 'plain',
  role: 'plain',
  isActive: 'plain',
};

export const STAFF_AUDIT_FIELDS: AuditFieldMap = {
  name: 'plain',
  whatsapp: 'masked',
  birthDate: 'plain',
  cpf: 'masked',
  rg: 'masked',
  nationality: 'plain',
  gender: 'plain',
  city: 'plain',
  state: 'plain',
  address: 'redacted',
  maritalStatus: 'plain',
  children: 'plain',
  occupation: 'plain',
  education: 'plain',
  religion: 'redacted',
  houseId: 'plain',
  photoUrl: 'file',
  signatureUrl: 'file',
  rank: 'plain',
  supportGroupId: 'plain',
  // Vindos do User ligado (nunca senha/hash).
  email: 'masked',
  role: 'plain',
  isActive: 'plain',
};

export const RELATIVE_AUDIT_FIELDS: AuditFieldMap = {
  name: 'plain',
  phone: 'masked',
  relationship: 'plain',
  isResponsible: 'plain',
  residentId: 'plain',
};

export const RECEIVABLE_AUDIT_FIELDS: AuditFieldMap = {
  referenceMonth: 'plain',
  dueDate: 'plain',
  amount: 'plain',
  status: 'plain',
  paidAt: 'plain',
  paymentMethod: 'plain',
  paidAmount: 'plain',
  paidFamilyInvestment: 'plain',
  notes: 'redacted',
  attachmentUrl: 'file',
};

export const FOLLOW_UP_AUDIT_FIELDS: AuditFieldMap = {
  date: 'plain',
  type: 'plain',
  description: 'redacted',
  attachmentUrl: 'file',
};

export const RESIDENT_ATTACHMENT_AUDIT_FIELDS: AuditFieldMap = {
  residentId: 'plain',
  fileUrl: 'file',
};

export const RESIDENT_DOCUMENT_AUDIT_FIELDS: AuditFieldMap = {
  templateId: 'plain',
  signedFileUrl: 'file',
};

export const PRODUCT_CONTRIBUTION_AUDIT_FIELDS: AuditFieldMap = {
  receivableId: 'plain',
  inventoryItemId: 'plain',
  description: 'plain',
  quantity: 'plain',
  unit: 'plain',
  pendingDetailing: 'plain',
};

export const STAFF_ATTACHMENT_AUDIT_FIELDS: AuditFieldMap = {
  staffId: 'plain',
  mimeType: 'plain',
  sizeBytes: 'plain',
  fileUrl: 'file',
};

export const STAFF_PERMISSION_AUDIT_FIELDS: AuditFieldMap = {
  staffId: 'plain',
  permissionType: 'plain',
};

export const HOUSE_AUDIT_FIELDS: AuditFieldMap = {
  name: 'plain',
  address: 'plain',
  city: 'plain',
  state: 'plain',
  phone: 'plain',
  coordinatorId: 'plain',
  isMotherHouse: 'plain',
  generalCapacity: 'plain',
  staffCapacity: 'plain',
};

export const HOUSE_PHOTO_AUDIT_FIELDS: AuditFieldMap = {
  url: 'file',
};

export const HOUSE_RULE_AUDIT_FIELDS: AuditFieldMap = {
  title: 'plain',
  content: 'plain',
};

export const MINISTRY_AUDIT_FIELDS: AuditFieldMap = {
  name: 'plain',
  leaderId: 'plain',
  leaderType: 'plain',
};

/** Vínculo filho↔ministério visto pela ficha (story 205 + 199). */
export const RESIDENT_MINISTRY_AUDIT_FIELDS: AuditFieldMap = {
  ministryId: 'plain',
};

export const MINISTRY_STAFF_AUDIT_FIELDS: AuditFieldMap = {
  staffId: 'plain',
};
