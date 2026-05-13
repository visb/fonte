import type { AxiosInstance } from 'axios';
import type { Conversation, DirectConversation, Message, SendDirectMessageInput, SendMessageInput, StaffThreadSummary } from '../types.js';

export function createMessagesModule(http: AxiosInstance) {
  return {
    getConversations: (): Promise<Conversation[]> =>
      http.get<Conversation[]>('/messages/conversations').then((r) => r.data),
    getMyConversations: (): Promise<Conversation[]> =>
      http.get<Conversation[]>('/messages/my-conversations').then((r) => r.data),
    getThread: (residentId: string, relativeId: string): Promise<Message[]> =>
      http
        .get<Message[]>(`/messages/conversations/${residentId}/${relativeId}`)
        .then((r) => r.data),
    getPending: (): Promise<Message[]> =>
      http.get<Message[]>('/messages/pending').then((r) => r.data),
    send: (data: SendMessageInput): Promise<Message> =>
      http.post<Message>('/messages', data).then((r) => r.data),
    approve: (id: string): Promise<Message> =>
      http.patch<Message>(`/messages/${id}/approve`).then((r) => r.data),
    reject: (id: string): Promise<Message> =>
      http.patch<Message>(`/messages/${id}/reject`).then((r) => r.data),
    getHouseStaffThreads: (): Promise<StaffThreadSummary[]> =>
      http.get<StaffThreadSummary[]>('/messages/house-staff-threads').then((r) => r.data),
    getDirectConversations: (): Promise<DirectConversation[]> =>
      http.get<DirectConversation[]>('/messages/direct-conversations').then((r) => r.data),
    getDirectThread: (staffId: string, relativeId: string): Promise<Message[]> =>
      http.get<Message[]>(`/messages/direct/${staffId}/${relativeId}`).then((r) => r.data),
    sendDirect: (data: SendDirectMessageInput): Promise<Message> =>
      http.post<Message>('/messages/direct', data).then((r) => r.data),
  };
}
