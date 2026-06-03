"use strict";
// ─── Resident Session ─────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreetSaleType = exports.SupplyRoomCategory = exports.FollowUpAccessLevel = exports.FollowUpType = exports.FamilyInvestment = exports.TimerResetFrequency = exports.StaffPermissionType = exports.MovementType = exports.IncidentSeverity = exports.MaritalStatus = exports.Gender = exports.BibleCourseEnrollmentStatus = exports.BibleCourseClassStatus = exports.ProfileType = exports.ResidentStatus = exports.ServantRank = exports.Role = exports.DAY_OF_WEEK_LABELS = exports.WishlistStatus = exports.MessageStatus = void 0;
// ─── Messages ─────────────────────────────────────────────────────────────────
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    MessageStatus["APPROVED"] = "APPROVED";
    MessageStatus["REJECTED"] = "REJECTED";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
// ─── Wishlist ─────────────────────────────────────────────────────────────────
var WishlistStatus;
(function (WishlistStatus) {
    WishlistStatus["PENDING_APPROVAL"] = "PENDING_APPROVAL";
    WishlistStatus["APPROVED"] = "APPROVED";
    WishlistStatus["REJECTED"] = "REJECTED";
})(WishlistStatus || (exports.WishlistStatus = WishlistStatus = {}));
exports.DAY_OF_WEEK_LABELS = {
    0: 'Domingo',
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
};
var Role;
(function (Role) {
    Role["ADMIN"] = "ADMIN";
    Role["COORDINATOR"] = "COORDINATOR";
    Role["SERVANT"] = "SERVANT";
    Role["RELATIVE"] = "RELATIVE";
    Role["RESIDENT"] = "RESIDENT";
})(Role || (exports.Role = Role = {}));
// Hierarquia espiritual do servo (role SERVANT). Independente do Role de sistema.
var ServantRank;
(function (ServantRank) {
    ServantRank["ASPIRANTE"] = "ASPIRANTE";
    ServantRank["CONSAGRADO"] = "CONSAGRADO";
    ServantRank["ALIANCADO"] = "ALIANCADO";
})(ServantRank || (exports.ServantRank = ServantRank = {}));
var ResidentStatus;
(function (ResidentStatus) {
    ResidentStatus["PRE_ADMISSION"] = "PRE_ADMISSION";
    ResidentStatus["ACTIVE"] = "ACTIVE";
    ResidentStatus["DISCIPLINE"] = "DISCIPLINE";
    ResidentStatus["TEMP_LEAVE"] = "TEMP_LEAVE";
    ResidentStatus["DISCHARGED"] = "DISCHARGED";
    ResidentStatus["EVADED"] = "EVADED";
})(ResidentStatus || (exports.ResidentStatus = ResidentStatus = {}));
var ProfileType;
(function (ProfileType) {
    ProfileType["STAFF"] = "STAFF";
    ProfileType["RELATIVE"] = "RELATIVE";
    ProfileType["RESIDENT"] = "RESIDENT";
})(ProfileType || (exports.ProfileType = ProfileType = {}));
var BibleCourseClassStatus;
(function (BibleCourseClassStatus) {
    BibleCourseClassStatus["PLANNED"] = "PLANNED";
    BibleCourseClassStatus["IN_PROGRESS"] = "IN_PROGRESS";
    BibleCourseClassStatus["COMPLETED"] = "COMPLETED";
})(BibleCourseClassStatus || (exports.BibleCourseClassStatus = BibleCourseClassStatus = {}));
var BibleCourseEnrollmentStatus;
(function (BibleCourseEnrollmentStatus) {
    BibleCourseEnrollmentStatus["ENROLLED"] = "ENROLLED";
    BibleCourseEnrollmentStatus["COMPLETED"] = "COMPLETED";
    BibleCourseEnrollmentStatus["DROPPED"] = "DROPPED";
})(BibleCourseEnrollmentStatus || (exports.BibleCourseEnrollmentStatus = BibleCourseEnrollmentStatus = {}));
var Gender;
(function (Gender) {
    Gender["MALE"] = "MALE";
    Gender["FEMALE"] = "FEMALE";
})(Gender || (exports.Gender = Gender = {}));
var MaritalStatus;
(function (MaritalStatus) {
    MaritalStatus["SINGLE"] = "SINGLE";
    MaritalStatus["MARRIED"] = "MARRIED";
    MaritalStatus["DIVORCED"] = "DIVORCED";
})(MaritalStatus || (exports.MaritalStatus = MaritalStatus = {}));
var IncidentSeverity;
(function (IncidentSeverity) {
    IncidentSeverity["LOW"] = "LOW";
    IncidentSeverity["MEDIUM"] = "MEDIUM";
    IncidentSeverity["HIGH"] = "HIGH";
    IncidentSeverity["CRITICAL"] = "CRITICAL";
})(IncidentSeverity || (exports.IncidentSeverity = IncidentSeverity = {}));
var MovementType;
(function (MovementType) {
    MovementType["IN"] = "IN";
    MovementType["OUT"] = "OUT";
})(MovementType || (exports.MovementType = MovementType = {}));
// ─── Staff Permissions ─────────────────────────────────────────────────────────
var StaffPermissionType;
(function (StaffPermissionType) {
    StaffPermissionType["MODERATE_MESSAGES"] = "MODERATE_MESSAGES";
    StaffPermissionType["SEND_MESSAGES_TO_FAMILIES"] = "SEND_MESSAGES_TO_FAMILIES";
})(StaffPermissionType || (exports.StaffPermissionType = StaffPermissionType = {}));
// ─── App Settings ─────────────────────────────────────────────────────────────
var TimerResetFrequency;
(function (TimerResetFrequency) {
    TimerResetFrequency["DAILY"] = "DAILY";
    TimerResetFrequency["WEEKLY"] = "WEEKLY";
    TimerResetFrequency["BIWEEKLY"] = "BIWEEKLY";
})(TimerResetFrequency || (exports.TimerResetFrequency = TimerResetFrequency = {}));
// ─── Family Investment ────────────────────────────────────────────────────────
var FamilyInvestment;
(function (FamilyInvestment) {
    FamilyInvestment["BASKET_500"] = "BASKET_500";
    FamilyInvestment["PAYMENT_700"] = "PAYMENT_700";
    FamilyInvestment["SOCIAL"] = "SOCIAL";
    FamilyInvestment["NEGOTIATED"] = "NEGOTIATED";
})(FamilyInvestment || (exports.FamilyInvestment = FamilyInvestment = {}));
// ─── Follow Up ───────────────────────────────────────────────────────────────
var FollowUpType;
(function (FollowUpType) {
    FollowUpType["ADMISSION"] = "ADMISSION";
    FollowUpType["READMISSION"] = "READMISSION";
    FollowUpType["DISCHARGE"] = "DISCHARGE";
    FollowUpType["EVASION"] = "EVASION";
    FollowUpType["MINISTRY_CHANGE"] = "MINISTRY_CHANGE";
    FollowUpType["RELATIVE_ADDED"] = "RELATIVE_ADDED";
    FollowUpType["DOCUMENT_ATTACHED"] = "DOCUMENT_ATTACHED";
    FollowUpType["MONTHLY_CONTRIBUTION"] = "MONTHLY_CONTRIBUTION";
    FollowUpType["DISCIPLINE"] = "DISCIPLINE";
    FollowUpType["BEHAVIOR_ASSESSMENT"] = "BEHAVIOR_ASSESSMENT";
    FollowUpType["PROMOTED_TO_SERVANT"] = "PROMOTED_TO_SERVANT";
    FollowUpType["NOTE"] = "NOTE";
})(FollowUpType || (exports.FollowUpType = FollowUpType = {}));
var FollowUpAccessLevel;
(function (FollowUpAccessLevel) {
    FollowUpAccessLevel["ALL"] = "ALL";
    FollowUpAccessLevel["ADMINISTRATION"] = "ADMINISTRATION";
})(FollowUpAccessLevel || (exports.FollowUpAccessLevel = FollowUpAccessLevel = {}));
// ─── Supply Room ─────────────────────────────────────────────────────────────
var SupplyRoomCategory;
(function (SupplyRoomCategory) {
    SupplyRoomCategory["CLEANING"] = "CLEANING";
    SupplyRoomCategory["HYGIENE"] = "HYGIENE";
    SupplyRoomCategory["PPE"] = "PPE";
    SupplyRoomCategory["OFFICE"] = "OFFICE";
    SupplyRoomCategory["OTHER"] = "OTHER";
})(SupplyRoomCategory || (exports.SupplyRoomCategory = SupplyRoomCategory = {}));
// ─── Street Sales ─────────────────────────────────────────────────────────────
var StreetSaleType;
(function (StreetSaleType) {
    StreetSaleType["BREAD"] = "BREAD";
    StreetSaleType["PIZZA"] = "PIZZA";
})(StreetSaleType || (exports.StreetSaleType = StreetSaleType = {}));
//# sourceMappingURL=index.js.map