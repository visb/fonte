export interface ResidentUsageSession {
    secondsUsed: number;
    limitSeconds: number;
}
export declare enum MessageStatus {
    PENDING_APPROVAL = "PENDING_APPROVAL",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export declare enum WishlistStatus {
    PENDING_APPROVAL = "PENDING_APPROVAL",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export declare const DAY_OF_WEEK_LABELS: Record<number, string>;
export declare enum Role {
    ADMIN = "ADMIN",
    COORDINATOR = "COORDINATOR",
    SERVANT = "SERVANT",
    RELATIVE = "RELATIVE",
    RESIDENT = "RESIDENT"
}
export declare enum ServantRank {
    ASPIRANTE = "ASPIRANTE",
    CONSAGRADO = "CONSAGRADO",
    ALIANCADO = "ALIANCADO"
}
export declare enum ResidentStatus {
    PRE_ADMISSION = "PRE_ADMISSION",
    ACTIVE = "ACTIVE",
    DISCIPLINE = "DISCIPLINE",
    TEMP_LEAVE = "TEMP_LEAVE",
    DISCHARGED = "DISCHARGED",
    EVADED = "EVADED"
}
export declare enum ProfileType {
    STAFF = "STAFF",
    RELATIVE = "RELATIVE",
    RESIDENT = "RESIDENT"
}
export declare enum BibleCourseClassStatus {
    PLANNED = "PLANNED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED"
}
export declare enum BibleCourseEnrollmentStatus {
    ENROLLED = "ENROLLED",
    COMPLETED = "COMPLETED",
    DROPPED = "DROPPED"
}
export declare enum Gender {
    MALE = "MALE",
    FEMALE = "FEMALE"
}
export declare enum MaritalStatus {
    SINGLE = "SINGLE",
    MARRIED = "MARRIED",
    DIVORCED = "DIVORCED"
}
export declare enum IncidentSeverity {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum MovementType {
    IN = "IN",
    OUT = "OUT"
}
export declare enum StaffPermissionType {
    MODERATE_MESSAGES = "MODERATE_MESSAGES",
    SEND_MESSAGES_TO_FAMILIES = "SEND_MESSAGES_TO_FAMILIES"
}
export declare enum TimerResetFrequency {
    DAILY = "DAILY",
    WEEKLY = "WEEKLY",
    BIWEEKLY = "BIWEEKLY"
}
export declare enum FamilyInvestment {
    BASKET_500 = "BASKET_500",
    PAYMENT_700 = "PAYMENT_700",
    SOCIAL = "SOCIAL",
    NEGOTIATED = "NEGOTIATED"
}
export declare enum FollowUpType {
    ADMISSION = "ADMISSION",
    READMISSION = "READMISSION",
    DISCHARGE = "DISCHARGE",
    EVASION = "EVASION",
    MINISTRY_CHANGE = "MINISTRY_CHANGE",
    RELATIVE_ADDED = "RELATIVE_ADDED",
    DOCUMENT_ATTACHED = "DOCUMENT_ATTACHED",
    MONTHLY_CONTRIBUTION = "MONTHLY_CONTRIBUTION",
    DISCIPLINE = "DISCIPLINE",
    BEHAVIOR_ASSESSMENT = "BEHAVIOR_ASSESSMENT",
    PROMOTED_TO_SERVANT = "PROMOTED_TO_SERVANT",
    NOTE = "NOTE"
}
export declare enum FollowUpAccessLevel {
    ALL = "ALL",
    ADMINISTRATION = "ADMINISTRATION"
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
    month: string;
    houseId?: string;
}
export declare enum SupplyRoomCategory {
    CLEANING = "CLEANING",
    HYGIENE = "HYGIENE",
    PPE = "PPE",
    OFFICE = "OFFICE",
    OTHER = "OTHER"
}
export declare enum StreetSaleType {
    BREAD = "BREAD",
    PIZZA = "PIZZA"
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
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
