import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import {
  useBibleCourseClassPhotos,
  useUploadBibleCourseClassPhoto,
  useDeleteBibleCourseClassPhoto,
} from '../hooks/useBibleCoursePhotos';
import { CLASS_PHOTO_ACCEPT, isAllowedClassPhoto } from '../lib/classPhotos';
import { ClassPhotoThumb } from './ClassPhotoThumb';

interface Props {
  classId: string;
}

/**
 * Galeria de fotos da turma (story 92): grid de miniaturas + botão de upload
 * (imagens) + exclusão individual com confirmação. Estados via componentes
 * compartilhados; erros via getErrorMessage.
 */
export function BibleCourseClassPhotoGallery({ classId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const { data: photos = [], isLoading, isError, refetch } =
    useBibleCourseClassPhotos(classId);
  const uploadMutation = useUploadBibleCourseClassPhoto(classId);
  const deleteMutation = useDeleteBibleCourseClassPhoto(classId);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isAllowedClassPhoto(file.type)) {
      setClientError('Tipo de arquivo não permitido. Use uma imagem (JPEG, PNG, WebP ou HEIC).');
      return;
    }
    setClientError(null);
    uploadMutation.mutate(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Fotos da turma</h2>
        <input
          ref={inputRef}
          type="file"
          accept={CLASS_PHOTO_ACCEPT}
          className="hidden"
          onChange={handleChange}
          aria-label="Adicionar foto"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <ImagePlus size={14} className="mr-1.5" />
          {uploadMutation.isPending ? 'Enviando...' : 'Adicionar foto'}
        </Button>
      </div>

      {clientError && <p className="text-xs text-destructive">{clientError}</p>}
      {uploadMutation.isError && (
        <p className="text-xs text-destructive">
          {getErrorMessage(uploadMutation.error, 'Erro ao enviar a foto.')}
        </p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : photos.length === 0 ? (
        <EmptyState title="Nenhuma foto nesta turma." />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <ClassPhotoThumb
              key={photo.id}
              photo={photo}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
