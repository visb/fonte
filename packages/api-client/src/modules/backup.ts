import type { AxiosInstance } from 'axios';
import type { BackupListItem, BackupSummary } from '../types.js';

export function createBackupModule(http: AxiosInstance) {
  return {
    list: () => http.get<BackupListItem[]>('/backup').then((r) => r.data),
    run: () => http.post<BackupSummary>('/backup/run').then((r) => r.data),
  };
}
