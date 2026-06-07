import { Database } from 'lucide-react';
import type { BackupListItem } from '@fonte/api-client';
import { formatBytes, formatDateTime } from '../utils';

interface BackupRowProps {
  backup: BackupListItem;
}

export function BackupRow({ backup }: BackupRowProps) {
  // A chave é tipo "db/2026-06-07T04-00-00-000Z.dump"; mostra só o nome do arquivo.
  const fileName = backup.key.split('/').pop() ?? backup.key;

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <Database size={16} className="text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(backup.createdAt)} · {formatBytes(backup.size)}
        </p>
      </div>
    </div>
  );
}
