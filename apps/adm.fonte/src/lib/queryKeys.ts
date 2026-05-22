export const queryKeys = {
  houses: {
    all: ['houses'] as const,
    detail: (id: string) => ['houses', id] as const,
    ministries: (id: string) => ['houses', id, 'ministries'] as const,
    staff: (id: string) => ['houses', id, 'staff'] as const,
    residents: (id: string) => ['houses', id, 'residents'] as const,
    rules: (id: string) => ['houses', id, 'rules'] as const,
  },
  residents: {
    all: ['residents'] as const,
    list: (params: { search?: string; status?: string }) =>
      ['residents', 'list', params] as const,
    detail: (id: string) => ['residents', id] as const,
    relativesAll: ['relatives'] as const,
    relatives: (id: string) => ['relatives', id] as const,
    documents: (id: string) => ['resident-documents', id] as const,
    attachments: (id: string) => ['resident-attachments', id] as const,
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
  storeroom: {
    byHouse: (houseId: string) => ['storeroom', houseId] as const,
    movementsByHouse: (houseId: string) => ['storeroom-movements', houseId] as const,
  },
} as const;
