import { View, Text, TouchableOpacity } from 'react-native';
import type { ActivityComment } from '@fonte/api-client';
import { ActivityAttachments } from './ActivityAttachments';
import type { PickedAttachment } from '@/features/activities/hooks/useActivities';

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}

interface Props {
  comment: ActivityComment;
  canDelete: boolean;
  onDelete: (commentId: string) => void;
  deleting: boolean;
  onUploadAttachment: (commentId: string, att: PickedAttachment) => void;
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
    <View className="bg-white rounded-xl px-4 py-3 mb-2 border border-gray-100">
      <View className="flex-row justify-between items-baseline mb-1">
        <Text className="text-sm font-semibold text-gray-800">
          {comment.author?.name ?? 'Desconhecido'}
        </Text>
        <Text className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</Text>
      </View>
      <Text className="text-sm text-gray-600">{comment.body}</Text>

      {/* Anexos do comentário (story 73). */}
      <ActivityAttachments
        attachments={comment.attachments ?? []}
        onUpload={(att) => onUploadAttachment(comment.id, att)}
        onDelete={onDeleteAttachment}
        uploading={uploadingAttachment}
        deleting={deletingAttachment}
        uploadError={uploadAttachmentError}
        uploadLabel="Anexar"
      />

      {canDelete && (
        <TouchableOpacity
          className="self-end mt-1"
          onPress={() => onDelete(comment.id)}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Excluir comentário"
        >
          <Text className="text-xs font-medium text-red-600">Excluir</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
