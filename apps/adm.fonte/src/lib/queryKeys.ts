export const queryKeys = {
  houses: {
    all: ['houses'] as const,
    detail: (id: string) => ['houses', id] as const,
    ministries: (id: string) => ['houses', id, 'ministries'] as const,
    staff: (id: string) => ['houses', id, 'staff'] as const,
    residents: (id: string) => ['houses', id, 'residents'] as const,
    rules: (id: string) => ['houses', id, 'rules'] as const,
    capacityRequests: (id: string) => ['houses', id, 'capacity-requests'] as const,
    capacityRequest: (requestId: string) =>
      ['houses', 'capacity-request', requestId] as const,
  },
  residents: {
    all: ['residents'] as const,
    list: (params: { search?: string; status?: string; houseId?: string; overdueContribution?: boolean }) =>
      ['residents', 'list', params] as const,
    detail: (id: string) => ['residents', id] as const,
    relativesAll: ['relatives'] as const,
    relatives: (id: string) => ['relatives', id] as const,
    documents: (id: string) => ['resident-documents', id] as const,
    attachments: (id: string) => ['resident-attachments', id] as const,
    admissions: (id: string) => ['resident-admissions', id] as const,
    followUps: (id: string) => ['resident-follow-ups', id] as const,
    receivables: (id: string) => ['residents', id, 'receivables'] as const,
    consents: (id: string) => ['residents', id, 'consents'] as const,
    audit: (id: string) => ['residents', id, 'audit'] as const,
  },
  staff: {
    all: ['staff'] as const,
    detail: (id: string) => ['staff', id] as const,
    permissions: (id: string) => ['staff', id, 'permissions'] as const,
  },
  appSettings: {
    current: ['app-settings'] as const,
  },
  ministries: {
    all: ['ministries'] as const,
  },
  documentTemplates: {
    all: ['document-templates'] as const,
  },
  supportGroups: {
    all: ['support-groups'] as const,
    detail: (id: string) => ['support-groups', id] as const,
    meetings: (id: string) => ['support-groups', id, 'meetings'] as const,
    meetingDetail: (meetingId: string) => ['support-groups', 'meeting', meetingId] as const,
    relativeCheckins: (meetingId: string) => ['support-groups', 'meeting', meetingId, 'relative-checkins'] as const,
    relativeHistory: (relativeId: string) => ['support-groups', 'relative', relativeId, 'history'] as const,
    residentHistory: (residentId: string) => ['support-groups', 'resident', residentId, 'history'] as const,
  },
  bibleCourses: {
    all: ['bible-courses'] as const,
    list: (status?: string) => ['bible-courses', 'list', status ?? null] as const,
    detail: (id: string) => ['bible-courses', id] as const,
    modules: ['bible-courses', 'modules'] as const,
    grades: (classId: string) => ['bible-courses', classId, 'grades'] as const,
  },
  storeroom: {
    byHouse: (houseId: string) => ['storeroom', houseId] as const,
    movementsByHouse: (houseId: string) => ['storeroom-movements', houseId] as const,
  },
  supplyRoom: {
    byHouse: (houseId: string) => ['supply-room', houseId] as const,
    movementsByHouse: (houseId: string) => ['supply-room-movements', houseId] as const,
  },
  billing: {
    filhos: {
      all: ['billing', 'filhos'] as const,
      report: (params: { month: string; houseId?: string }) =>
        ['billing', 'filhos', 'report', params] as const,
    },
    streetSales: {
      report: (params: { type: string; month: string; houseId?: string }) =>
        ['billing', 'street-sales', 'report', params] as const,
    },
  },
  staffMe: {
    current: ['staff', 'me'] as const,
  },
  messages: {
    all: ['messages'] as const,
    conversations: ['messages', 'conversations'] as const,
    directConversations: ['messages', 'direct-conversations'] as const,
    thread: (residentId: string, relativeId: string) =>
      ['messages', 'thread', residentId, relativeId] as const,
    directThread: (staffId: string, relativeId: string) =>
      ['messages', 'direct-thread', staffId, relativeId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  census: {
    pending: (houseId: string) => ['census', houseId, 'pending'] as const,
  },
  backup: {
    all: ['backup'] as const,
  },
} as const;
