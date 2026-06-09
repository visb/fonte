import type { AxiosInstance } from 'axios';
import type { AuditLog } from '../types.js';

export function createAuditModule(http: AxiosInstance) {
  return {
    byTarget: (targetType: string, targetId: string): Promise<AuditLog[]> =>
      http.get<AuditLog[]>(`/audit/${targetType}/${targetId}`).then((r) => r.data),
  };
}
