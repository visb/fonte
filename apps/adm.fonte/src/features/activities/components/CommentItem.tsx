import type { ActivityComment } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { AttachmentList } from './AttachmentList';

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}

interface Props {
  comment: ActivityComment;
  canDelete: boolean;
  onDelete: (commentId: string) => void;
  deleting: boolean;
  onUploadAttachment: (commentId: string, file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  uploadingAttachment: boolean;
  deletingAttachment: boolean;
  uploadAttachmentError?: unknown;
}

export function CommentItem({
  comment,
  canDelete,
  onDelete,
  deleting,
  onUploadAttachment,
  onDeleteAttachment,
  uploadingAttachment,
  deletingAttachment,
  uploadAttachmentError,
}: Props) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/20 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">
          {comment.author?.name ?? 'Desconhecido'}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDateTime(comment.createdAt)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{comment.body}</p>

      {/* Anexos do comentário (story 73): lista + uploader. */}
      <AttachmentList
        attachments={comment.attachments ?? []}
        onUpload={(file) => onUploadAttachment(comment.id, file)}
        onDelete={onDeleteAttachment}
        uploading={uploadingAttachment}
        deleting={deletingAttachment}
        uploadError={uploadAttachmentError}
        uploadLabel="Anexar ao comentário"
      />

      {canDelete && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => onDelete(comment.id)}
            disabled={deleting}
          >
            Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
