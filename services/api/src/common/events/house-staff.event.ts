/**
 * EventEmitter2 event emitted by the StaffService whenever a staff mutation may
 * change a house's staffCount or staffing (create, update, removal). The
 * HouseService listens for it to invalidate the cached `house:list` payload.
 *
 * Lives outside both modules (no DI) to avoid coupling StaffModule to the house
 * cache — same pattern as {@link RESIDENT_COUNTS_CHANGED_EVENT}.
 */
export const HOUSE_STAFF_CHANGED_EVENT = 'house.staff.changed';
