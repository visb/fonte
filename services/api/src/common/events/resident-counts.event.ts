/**
 * EventEmitter2 event emitted by the ResidentService whenever a resident
 * mutation may change the per-house "filhos" count (create, status/house
 * change, readmission, removal, promotion to servant). The HouseService
 * listens for it to invalidate the cached resident-count map.
 *
 * Lives outside both modules (no DI) to avoid a Resident↔House import cycle.
 */
export const RESIDENT_COUNTS_CHANGED_EVENT = 'resident.counts.changed';
