import { Trash2 } from 'lucide-react';
import type { BibleCourseClassPhoto } from '@fonte/api-client';

interface Props {
  photo: BibleCourseClassPhoto;
  onDelete: (photoId: string) => void;
  deleting: boolean;
}

/**
 * Miniatura de uma foto da galeria da turma (story 92): abre a imagem em nova aba
 * e oferece excluir com confirmação. Item extraído do grid da galeria.
 */
export function ClassPhotoThumb({ photo, onDelete, deleting }: Props) {
  const handleDelete = () => {
    if (window.confirm('Remover esta foto da turma?')) onDelete(photo.id);
  };

  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
      <a href={photo.fileUrl} target="_blank" rel="noreferrer">
        <img
          src={photo.fileUrl}
          alt={photo.fileName}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </a>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`Remover foto ${photo.fileName}`}
        title="Remover foto"
        className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
