import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
} from '../hooks/useActivities';
import { canDeleteComment } from '../lib/permissions';
import { CommentItem } from './CommentItem';

const commentSchema = z.object({
  body: z.string().trim().min(1, 'Escreva um comentário.'),
});
type CommentForm = z.infer<typeof commentSchema>;

export function ActivityComments({ activityId }: { activityId: string }) {
  const { role, userId } = useAuth();
  const { data: comments, isLoading, error, refetch } = useActivityComments(activityId);
  const addMutation = useAddComment(activityId);
  const deleteMutation = useDeleteComment(activityId);
  const uploadAttachment = useUploadCommentAttachment(activityId);
  const deleteAttachment = useDeleteAttachment(activityId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: '' },
  });

  const onSubmit = (data: CommentForm) => {
    addMutation.mutate(
      { body: data.body.trim() },
      { onSuccess: () => reset({ body: '' }) },
    );
  };

  return (
    <div className="space-y-3">
      {isLoading && <LoadingState />}

      {error && (
        <ErrorState
          message={getErrorMessage(error, 'Erro ao carregar os comentários.')}
          onRetry={refetch}
        />
      )}

      {!isLoading && !error && comments && comments.length === 0 && (
        <EmptyState title="Nenhum comentário ainda." />
      )}

      {!isLoading && !error && comments && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canDelete={canDeleteComment(comment, { role, userId })}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deleteMutation.isPending}
              onUploadAttachment={(commentId, file) =>
                uploadAttachment.mutate({ commentId, file })
              }
              onDeleteAttachment={(attachmentId) =>
                deleteAttachment.mutate(attachmentId)
              }
              uploadingAttachment={uploadAttachment.isPending}
              deletingAttachment={deleteAttachment.isPending}
              uploadAttachmentError={uploadAttachment.error}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        <Textarea
          {...register('body')}
          placeholder="Escreva um comentário"
          rows={3}
          aria-label="Novo comentário"
        />
        {errors.body && (
          <p className="text-xs text-destructive">{errors.body.message}</p>
        )}
        {addMutation.error != null && (
          <p className="text-xs text-destructive">
            {getErrorMessage(addMutation.error, 'Erro ao enviar o comentário.')}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={addMutation.isPending}>
            {addMutation.isPending ? 'Enviando...' : 'Comentar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
