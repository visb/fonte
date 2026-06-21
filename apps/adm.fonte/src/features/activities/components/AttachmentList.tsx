import type { ActivityAttachment } from '@fonte/api-client';
import { AttachmentItem } from './AttachmentItem';
import { AttachmentUploader } from './AttachmentUploader';
import { AudioRecorder } from './AudioRecorder';

interface Props {
  attachments: ActivityAttachment[];
  onUpload: (file: File, durationSeconds?: number | null) => void;
  onDelete: (attachmentId: string) => void;
  uploading: boolean;
  deleting: boolean;
  uploadError?: unknown;
  uploadLabel?: string;
}

/**
 * Lista de anexos reutilizável (atividade ou comentário): itens com download/
 * preview/player + excluir condicional, e os controles de envio abaixo (upload de
 * arquivo + gravação de áudio, story 74). Estado vazio fica a cargo dos controles.
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
      <div className="flex flex-wrap items-start gap-2">
        <AttachmentUploader
          onUpload={onUpload}
          uploading={uploading}
          error={uploadError}
          label={uploadLabel}
        />
        <AudioRecorder
          onRecorded={(file, durationSeconds) => onUpload(file, durationSeconds)}
          uploading={uploading}
        />
      </div>
    </div>
  );
}
