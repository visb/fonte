"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileType = exports.ResidentStatus = exports.Role = void 0;
var Role;
(function (Role) {
    Role["ADMIN"] = "ADMIN";
    Role["COORDINATOR"] = "COORDINATOR";
    Role["OPERATOR"] = "OPERATOR";
    Role["RELATIVE"] = "RELATIVE";
    Role["RESIDENT"] = "RESIDENT";
})(Role || (exports.Role = Role = {}));
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
//# sourceMappingURL=index.js.map