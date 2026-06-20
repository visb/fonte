import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { getErrorMessage } from '@/lib/errors';
import {
  useActivityComments,
  useAddComment,
  useDeleteAttachment,
  useDeleteComment,
  useUploadCommentAttachment,
} from '@/features/activities/hooks/useActivities';
import { canDeleteComment } from '@/features/activities/lib/permissions';
import { CommentItem } from './CommentItem';

const schema = z.object({ body: z.string().trim().min(1, 'Escreva um comentário.') });
type FormData = z.infer<typeof schema>;

export function ActivityComments({ activityId }: { activityId: string }) {
  const { staff } = useAuth();
  const user = {
    role: staff?.user?.role ?? null,
    userId: staff?.userId ?? null,
  };

  const { data: comments, isLoading, error, refetch } = useActivityComments(activityId);
  const addMutation = useAddComment(activityId);
  const deleteMutation = useDeleteComment(activityId);
  const uploadAttachment = useUploadCommentAttachment(activityId);
  const deleteAttachment = useDeleteAttachment(activityId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { body: '' },
  });

  const onSubmit = (data: FormData) => {
    addMutation.mutate(
      { body: data.body.trim() },
      { onSuccess: () => reset({ body: '' }) },
    );
  };

  return (
    <View>
      <Text className="text-sm font-semibold text-gray-700 mb-2">Comentários</Text>

      {isLoading && <LoadingState />}
      {error && (
        <ErrorState message="Erro ao carregar os comentários." onRetry={refetch} />
      )}

      {!isLoading && !error && comments && comments.length === 0 && (
        <EmptyState message="Nenhum comentário ainda." />
      )}

      {!isLoading &&
        !error &&
        comments &&
        comments.length > 0 &&
        comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            canDelete={canDeleteComment(comment, user)}
            onDelete={(id) => deleteMutation.mutate(id)}
            deleting={deleteMutation.isPending}
            onUploadAttachment={(commentId, att) =>
              uploadAttachment.mutate({ commentId, att })
            }
            onDeleteAttachment={(attachmentId) =>
              deleteAttachment.mutate(attachmentId)
            }
            uploadingAttachment={uploadAttachment.isPending}
            deletingAttachment={deleteAttachment.isPending}
            uploadAttachmentError={uploadAttachment.error}
          />
        ))}

      <Controller
        control={control}
        name="body"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white mt-2"
            placeholder="Escreva um comentário..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={value}
            onChangeText={onChange}
            accessibilityLabel="Novo comentário"
          />
        )}
      />
      {errors.body && (
        <Text className="text-xs text-red-600 mt-1">{errors.body.message}</Text>
      )}
      {addMutation.error != null && (
        <Text className="text-xs text-red-600 mt-1">
          {getErrorMessage(addMutation.error, 'Erro ao enviar o comentário.')}
        </Text>
      )}

      <TouchableOpacity
        className="bg-indigo-600 rounded-lg py-3 items-center mt-3"
        onPress={handleSubmit(onSubmit)}
        disabled={addMutation.isPending}
        style={{ opacity: addMutation.isPending ? 0.5 : 1 }}
        accessibilityRole="button"
        accessibilityLabel="Comentar"
      >
        {addMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Comentar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
