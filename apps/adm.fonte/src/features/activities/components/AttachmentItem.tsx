import type { ActivityAttachment } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '../lib/attachments';

interface Props {
  attachment: ActivityAttachment;
  onDelete: (attachmentId: string) => void;
  deleting: boolean;
}

/**
 * Item de anexo: nome, tamanho, ícone por tipo e link de download (imagem
 * também abre como preview no navegador). Botão de excluir só quando o backend
 * marcou `canDelete` (autoridade no servidor; o front só espelha).
 */
export function AttachmentItem({ attachment, onDelete, deleting }: Props) {
  const isImage = attachment.fileType === 'image';
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
      <a
        href={attachment.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-2 text-sm hover:underline"
      >
        <span aria-hidden className="shrink-0">
          {isImage ? '🖼️' : '📄'}
        </span>
        <span className="truncate">{attachment.fileName}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatFileSize(attachment.sizeBytes)}
        </span>
      </a>
      {attachment.canDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => onDelete(attachment.id)}
          disabled={deleting}
          aria-label={`Excluir anexo ${attachment.fileName}`}
        >
          Excluir
        </Button>
      )}
    </div>
  );
}
