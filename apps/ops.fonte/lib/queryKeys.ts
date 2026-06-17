export const queryKeys = {
  residents: {
    all: ['residents'] as const,
    byHouse: (houseId: string) => ['residents', houseId] as const,
    countByHouse: (houseId: string) => ['residents-count', houseId] as const,
    detail: (id: string) => ['resident', id] as const,
    attachments: (id: string) => ['resident-attachments', id] as const,
    followUps: (id: string) => ['resident-follow-ups', id] as const,
    consents: (id: string) => ['resident-consents', id] as const,
  },
  relatives: {
    byResident: (residentId: string) => ['relatives', residentId] as const,
  },
  houses: {
    all: ['houses'] as const,
    detail: (id: string) => ['house', id] as const,
    ministries: (houseId: string) => ['house-ministries', houseId] as const,
  },
  ministries: {
    byHouse: (houseId: string) => ['ministries', houseId] as const,
    detail: (id: string) => ['ministry', id] as const,
    tasks: (id: string) => ['ministry-tasks', id] as const,
    houseResidents: (houseId: string) => ['house-residents-for-ministry', houseId] as const,
    houseStaff: (houseId: string) => ['house-staff-for-ministry', houseId] as const,
  },
  incidents: {
    all: ['incidents'] as const,
    byHouse: (houseId: string) => ['incidents', houseId] as const,
    todayByHouse: (houseId: string) => ['incidents-today', houseId] as const,
  },
  activities: {
    all: ['activities'] as const,
    byHouse: (houseId: string) => ['activities', houseId] as const,
  },
  storeroom: {
    allItems: ['storeroom-items'] as const,
    items: (houseId: string) => ['storeroom-items', houseId] as const,
    allMovements: ['storeroom-movements'] as const,
    movements: (itemId: string) => ['storeroom-movements', itemId] as const,
  },
  supplyRoom: {
    allItems: ['supply-room-items'] as const,
    items: (houseId: string) => ['supply-room-items', houseId] as const,
    allMovements: ['supply-room-movements'] as const,
    movements: (itemId: string) => ['supply-room-movements', itemId] as const,
  },
  supportGroups: {
    all: ['support-groups'] as const,
    allMeetings: ['support-group-meetings'] as const,
    meetings: (groupId: string) => ['support-group-meetings', groupId] as const,
    meetingDetail: (id: string) => ['support-group-meeting', id] as const,
  },
  messages: {
    conversations: ['messages-conversations'] as const,
    myConversations: ['messages-my-conversations'] as const,
    thread: (residentId: string, relativeId: string) => ['messages-thread', residentId, relativeId] as const,
    pending: ['messages-pending'] as const,
    directConversations: ['messages-direct-conversations'] as const,
    directThread: (staffId: string, relativeId: string) => ['messages-direct-thread', staffId, relativeId] as const,
    houseRelatives: (houseId: string | null | undefined) => ['house-relatives-messages', houseId] as const,
  },
  wishlist: {
    items: (residentId: string) => ['wishlist', residentId] as const,
    pending: ['wishlist-pending'] as const,
  },
  streetSales: {
    all: ['street-sales'] as const,
    byHouse: (houseId: string) => ['street-sales', houseId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
} as const;
