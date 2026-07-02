import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import type { StaffAttachment } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useStaffAttachments, useUploadStaffAttachment, useDeleteStaffAttachment,
} from '../hooks/useStaff';
import { StaffAttachmentRow } from './StaffAttachmentRow';

interface Props {
  staffId: string;
}

// Aba Anexos do servo (story 98): lista + upload + remoção com confirmação.
export function StaffAttachmentsTab({ staffId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffAttachment | null>(null);

  const { data: attachments = [], isLoading, isError } = useStaffAttachments(staffId);
  const uploadMutation = useUploadStaffAttachment(staffId);
  const deleteMutation = useDeleteStaffAttachment(staffId);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Erro ao carregar os anexos." />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Anexos
        </h3>
        <Button
          variant="outline"
          size="sm"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadMutation.isPending
            ? <Loader2 size={14} className="animate-spin mr-1.5" />
            : <Upload size={14} className="mr-1.5" />}
          Adicionar anexo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = '';
          }}
        />
      </div>

      {uploadMutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(uploadMutation.error, 'Erro ao enviar o anexo.')}
        </p>
      )}

      {attachments.length === 0 ? (
        <EmptyState title="Nenhum anexo adicionado." />
      ) : (
        attachments.map((a) => (
          <StaffAttachmentRow key={a.id} attachment={a} onDelete={setDeleteTarget} />
        ))
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover anexo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.fileName}</strong>? O arquivo
              será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
