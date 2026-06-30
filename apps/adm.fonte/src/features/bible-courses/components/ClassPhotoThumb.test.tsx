import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { BibleCourseClassPhoto } from '@fonte/api-client';
import { ClassPhotoThumb } from './ClassPhotoThumb';

function photo(overrides: Partial<BibleCourseClassPhoto> = {}): BibleCourseClassPhoto {
  return {
    id: 'p1',
    classId: 'c1',
    fileUrl: 'https://cdn/turma.jpg',
    fileName: 'turma.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1000,
    createdByUserId: 'u1',
    createdAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('ClassPhotoThumb', () => {
  it('renderiza a imagem e o link para abrir', () => {
    render(<ClassPhotoThumb photo={photo()} onDelete={vi.fn()} deleting={false} />);
    const img = screen.getByAltText('turma.jpg') as HTMLImageElement;
    expect(img.src).toContain('turma.jpg');
  });

  it('confirma antes de excluir', () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ClassPhotoThumb photo={photo()} onDelete={onDelete} deleting={false} />);
    fireEvent.click(screen.getByLabelText('Remover foto turma.jpg'));
    expect(onDelete).toHaveBeenCalledWith('p1');
    confirmSpy.mockRestore();
  });

  it('não exclui se o usuário cancela a confirmação', () => {
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ClassPhotoThumb photo={photo()} onDelete={onDelete} deleting={false} />);
    fireEvent.click(screen.getByLabelText('Remover foto turma.jpg'));
    expect(onDelete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
