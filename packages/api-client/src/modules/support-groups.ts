import type { AxiosInstance } from 'axios';
import type {
  SupportGroup,
  CreateSupportGroupInput,
  UpdateSupportGroupInput,
  SupportGroupMeeting,
  SupportGroupMeetingDetail,
  SupportGroupCheckin,
  SupportGroupRelativeCheckin,
  CreateMeetingInput,
  AddCheckinInput,
  RelativeCheckinInput,
} from '../types.js';

export function createSupportGroupsModule(http: AxiosInstance) {
  return {
    list: () =>
      http.get<SupportGroup[]>('/support-groups').then((r) => r.data),
    create: (data: CreateSupportGroupInput) =>
      http.post<SupportGroup>('/support-groups', data).then((r) => r.data),
    getById: (id: string) =>
      http.get<SupportGroup>(`/support-groups/${id}`).then((r) => r.data),
    update: (id: string, data: UpdateSupportGroupInput) =>
      http.patch<SupportGroup>(`/support-groups/${id}`, data).then((r) => r.data),
    delete: (id: string) => http.delete(`/support-groups/${id}`),

    listAllMeetings: () =>
      http.get<SupportGroupMeeting[]>('/support-groups/meetings').then((r) => r.data),
    listMeetings: (groupId: string) =>
      http.get<SupportGroupMeeting[]>(`/support-groups/${groupId}/meetings`).then((r) => r.data),
    createMeeting: (groupId: string, data: CreateMeetingInput) =>
      http.post<SupportGroupMeeting>(`/support-groups/${groupId}/meetings`, data).then((r) => r.data),
    getMeeting: (meetingId: string) =>
      http.get<SupportGroupMeetingDetail>(`/support-groups/meetings/${meetingId}`).then((r) => r.data),

    addCheckin: (meetingId: string, data: AddCheckinInput) =>
      http.post<SupportGroupCheckin>(`/support-groups/meetings/${meetingId}/checkins`, data).then((r) => r.data),
    removeCheckin: (meetingId: string, checkinId: string) =>
      http.delete(`/support-groups/meetings/${meetingId}/checkins/${checkinId}`),

    addRelativeCheckin: (data: RelativeCheckinInput): Promise<SupportGroupRelativeCheckin> =>
      http.post<SupportGroupRelativeCheckin>('/support-groups/relative-checkin', data).then((r) => r.data),
  };
}
