export const queryKeys = {
  relativeMe: ['relative-me'] as const,
  consents: ['consents', 'me'] as const,
  messages: {
    thread: (residentId: string, relativeId: string) =>
      ['messages', 'thread', residentId, relativeId] as const,
    houseStaffThreads: ['messages', 'house-staff-threads'] as const,
    directThread: (staffId: string, relativeId: string) =>
      ['messages', 'direct-thread', staffId, relativeId] as const,
  },
  wishlist: {
    byResident: (residentId: string) => ['wishlist', residentId] as const,
  },
} as const;
