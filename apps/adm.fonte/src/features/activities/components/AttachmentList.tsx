import type { ActivityAttachment } from '@fonte/api-client';
import { AttachmentItem } from './AttachmentItem';
import { AttachmentUploader } from './AttachmentUploader';

interface Props {
  attachments: ActivityAttachment[];
  onUpload: (file: File) => void;
  onDelete: (attachmentId: string) => void;
  uploading: boolean;
  deleting: boolean;
  uploadError?: unknown;
  uploadLabel?: string;
}

/**
 * Lista de anexos reutilizável (atividade ou comentário): itens com download/
 * preview + excluir condicional, e o uploader logo abaixo. Estado vazio fica a
 * cargo do uploader (sempre visível).
 */
export function AttachmentList({
  attachments,
  onUpload,
  onDelete,
  uploading,
  deleting,
  uploadError,
  uploadLabel,
}: Props) {
  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((a) => (
            <AttachmentItem
              key={a.id}
              attachment={a}
              onDelete={onDelete}
              deleting={deleting}
            />
          ))}
        </div>
      )}
      <AttachmentUploader
        onUpload={onUpload}
        uploading={uploading}
        error={uploadError}
        label={uploadLabel}
      />
    </div>
  );
}
