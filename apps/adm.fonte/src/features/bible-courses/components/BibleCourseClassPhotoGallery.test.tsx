import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { BibleCourseClassPhoto } from '@fonte/api-client';

const listResult = {
  data: [] as BibleCourseClassPhoto[],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};
const uploadMutate = vi.fn();
const uploadState = { mutate: uploadMutate, isPending: false, isError: false, error: null };
const deleteMutate = vi.fn();

vi.mock('../hooks/useBibleCoursePhotos', () => ({
  useBibleCourseClassPhotos: () => listResult,
  useUploadBibleCourseClassPhoto: () => uploadState,
  useDeleteBibleCourseClassPhoto: () => ({ mutate: deleteMutate, isPending: false }),
}));

import { BibleCourseClassPhotoGallery } from './BibleCourseClassPhotoGallery';

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

beforeEach(() => {
  vi.clearAllMocks();
  listResult.data = [];
  listResult.isLoading = false;
  listResult.isError = false;
  uploadState.isPending = false;
  uploadState.isError = false;
  uploadState.error = null;
});
afterEach(() => cleanup());

describe('BibleCourseClassPhotoGallery', () => {
  it('mostra empty state quando não há fotos', () => {
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.getByText('Nenhuma foto nesta turma.')).toBeInTheDocument();
  });

  it('renderiza o grid de miniaturas', () => {
    listResult.data = [photo({ id: 'p1' }), photo({ id: 'p2', fileName: 'b.jpg' })];
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.getByAltText('turma.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('b.jpg')).toBeInTheDocument();
  });

  it('mostra loading', () => {
    listResult.isLoading = true;
    const { container } = render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('mostra erro com retry', () => {
    listResult.isError = true;
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('upload de imagem válida dispara a mutation', () => {
    const { container } = render(<BibleCourseClassPhotoGallery classId="c1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadMutate).toHaveBeenCalledWith(file);
  });

  it('rejeita arquivo não-imagem sem chamar a mutation', () => {
    const { container } = render(<BibleCourseClassPhotoGallery classId="c1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(uploadMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Tipo de arquivo não permitido/)).toBeInTheDocument();
  });

  it('exclui uma foto pelo botão da miniatura (confirmado)', () => {
    listResult.data = [photo()];
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    fireEvent.click(screen.getByLabelText('Remover foto turma.jpg'));
    expect(deleteMutate).toHaveBeenCalledWith('p1');
    confirmSpy.mockRestore();
  });

  // Story 126: o erro do upload virou toast no hook (coberto em
  // useBibleCoursePhotos.test.tsx); a galeria não mostra mais o texto inline.
  it('não renderiza erro de mutation inline', () => {
    uploadState.isError = true;
    uploadState.error = { message: 'boom' } as never;
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.queryByText(/Erro ao enviar a foto\.|boom/)).not.toBeInTheDocument();
  });

  // Decisão 3: validação local do arquivo é erro de campo → segue inline,
  // inclusive quando a mutation também falhou.
  it('erro de validação do arquivo continua inline mesmo com erro de mutation', () => {
    uploadState.isError = true;
    uploadState.error = { message: 'boom' } as never;
    const { container } = render(<BibleCourseClassPhotoGallery classId="c1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByText(/Tipo de arquivo não permitido/)).toBeInTheDocument();
    expect(uploadMutate).not.toHaveBeenCalled();
  });
});
