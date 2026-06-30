import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { BibleCourseClassPhoto } from '@fonte/api-client';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const mockListResult = {
  data: [] as BibleCourseClassPhoto[],
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};
const mockUploadMutate = jest.fn();
const mockUploadState = { mutate: mockUploadMutate, isPending: false, isError: false, error: null };
const mockDeleteMutate = jest.fn();

jest.mock('../hooks/useBibleCoursePhotos', () => ({
  useBibleCourseClassPhotos: () => mockListResult,
  useUploadBibleCourseClassPhoto: () => mockUploadState,
  useDeleteBibleCourseClassPhoto: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

import * as ImagePicker from 'expo-image-picker';
import { BibleCourseClassPhotoGallery } from './BibleCourseClassPhotoGallery';
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

beforeEach(() => {
  jest.clearAllMocks();
  mockListResult.data = [];
  mockListResult.isLoading = false;
  mockListResult.isError = false;
  mockUploadState.isPending = false;
  mockUploadState.isError = false;
  mockUploadState.error = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('BibleCourseClassPhotoGallery', () => {
  it('mostra empty state quando não há fotos', () => {
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.getByText('Nenhuma foto nesta turma.')).toBeTruthy();
  });

  it('renderiza o grid de miniaturas', () => {
    mockListResult.data = [photo({ id: 'p1' }), photo({ id: 'p2', fileName: 'b.jpg' })];
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.getByLabelText('turma.jpg')).toBeTruthy();
    expect(screen.getByLabelText('b.jpg')).toBeTruthy();
  });

  it('mostra erro com retry e refetch ao tocar', () => {
    mockListResult.isError = true;
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(mockListResult.refetch).toHaveBeenCalled();
  });

  it('exclui uma foto a partir do grid', () => {
    mockListResult.data = [photo({ id: 'p1' })];
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) =>
        buttons?.find((b) => b.text === 'Remover')?.onPress?.(),
      );
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    fireEvent.press(screen.getByLabelText('Remover foto turma.jpg'));
    expect(mockDeleteMutate).toHaveBeenCalledWith('p1');
  });

  it('mostra loading enquanto carrega', () => {
    mockListResult.isLoading = true;
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.queryByText('Nenhuma foto nesta turma.')).toBeNull();
  });

  it('upload: escolhe imagem e dispara a mutation', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://foto.jpg', mimeType: 'image/jpeg', fileName: 'foto.jpg' }],
    });
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    fireEvent.press(screen.getByLabelText('Adicionar foto'));
    await waitFor(() =>
      expect(mockUploadMutate).toHaveBeenCalledWith({
        uri: 'file://foto.jpg',
        mimeType: 'image/jpeg',
        name: 'foto.jpg',
      }),
    );
  });

  it('upload cancelado não dispara a mutation', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    fireEvent.press(screen.getByLabelText('Adicionar foto'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it('mostra mensagem de erro de upload', () => {
    mockUploadState.isError = true;
    mockUploadState.error = { message: 'boom' } as never;
    render(<BibleCourseClassPhotoGallery classId="c1" />);
    expect(screen.getByText('Erro ao enviar a foto.')).toBeTruthy();
  });
});

describe('ClassPhotoThumb', () => {
  it('confirma e exclui pelo Alert', () => {
    const onDelete = jest.fn();
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) => {
        const remove = buttons?.find((b) => b.text === 'Remover');
        remove?.onPress?.();
      });
    render(<ClassPhotoThumb photo={photo()} onDelete={onDelete} deleting={false} />);
    fireEvent.press(screen.getByLabelText('Remover foto turma.jpg'));
    expect(onDelete).toHaveBeenCalledWith('p1');
    alertSpy.mockRestore();
  });

  it('em deleting desabilita o botão (opacity 0.5)', () => {
    render(<ClassPhotoThumb photo={photo()} onDelete={jest.fn()} deleting />);
    const btn = screen.getByLabelText('Remover foto turma.jpg');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });
});
