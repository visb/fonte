import type { AxiosInstance } from 'axios';
import type {
  ConsentRecord,
  ConsentStatus,
  ConsentPurpose,
  ConsentSubjectType,
  RegisterConsentInput,
} from '../types.js';

export function createConsentsModule(http: AxiosInstance) {
  return {
    grant: (data: RegisterConsentInput): Promise<ConsentRecord> =>
      http.post<ConsentRecord>('/consents', data).then((r) => r.data),
    revoke: (data: RegisterConsentInput): Promise<ConsentRecord> =>
      http.post<ConsentRecord>('/consents/revoke', data).then((r) => r.data),
    status: (subjectType: ConsentSubjectType, subjectId: string): Promise<ConsentStatus[]> =>
      http.get<ConsentStatus[]>(`/consents/${subjectType}/${subjectId}`).then((r) => r.data),
    history: (subjectType: ConsentSubjectType, subjectId: string): Promise<ConsentRecord[]> =>
      http.get<ConsentRecord[]>(`/consents/${subjectType}/${subjectId}/history`).then((r) => r.data),
    checkActive: (
      subjectType: ConsentSubjectType,
      subjectId: string,
      purpose: ConsentPurpose,
    ): Promise<{ active: boolean }> =>
      http
        .get<{ active: boolean }>('/consents/check/active', {
          params: { subjectType, subjectId, purpose },
        })
        .then((r) => r.data),

    // Autoatendimento do titular (familiar/interno) — titular vem do JWT.
    myStatus: (): Promise<ConsentStatus[]> =>
      http.get<ConsentStatus[]>('/consents/me').then((r) => r.data),
    myGrant: (purpose: ConsentPurpose, termVersion = '1.0'): Promise<ConsentRecord> =>
      http.post<ConsentRecord>('/consents/me/grant', { purpose, termVersion }).then((r) => r.data),
    myRevoke: (purpose: ConsentPurpose): Promise<ConsentRecord> =>
      http.post<ConsentRecord>('/consents/me/revoke', { purpose }).then((r) => r.data),
  };
}
