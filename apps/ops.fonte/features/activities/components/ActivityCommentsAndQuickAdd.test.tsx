import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: { createAsync: jest.fn(), RecordingOptionsPresets: { HIGH_QUALITY: {} } },
    Sound: { createAsync: jest.fn() },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

jest.mock('@/lib/api', () => ({
  api: {
    activities: {
      create: jest.fn(),
      listComments: jest.fn(),
      addComment: jest.fn(),
      deleteComment: jest.fn(),
      uploadCommentAttachment: jest.fn(),
      deleteAttachment: jest.fn(),
    },
  },
  resolveAssetUrl: (u: string) => u,
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { userId: 'u1', user: { role: 'SERVANT' } } }),
}));

import { api } from '@/lib/api';
import { Audio } from 'expo-av';
import { QuickAddCard } from './QuickAddCard';
import { ActivityComments } from './ActivityComments';
import { AudioRecorder } from './AudioRecorder';
import { ActivityStatus } from '@fonte/types';

const m = api as unknown as { activities: Record<string, jest.Mock> };

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('QuickAddCard', () => {
  it('submit vazio mostra erro de validação e não cria', async () => {
    renderWithClient(<QuickAddCard status={ActivityStatus.DRAFT} houseId="h1" />);
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(screen.getByText('Informe o título')).toBeTruthy());
    expect(m.activities.create).not.toHaveBeenCalled();
  });

  it('submit válido cria com título, status e houseId; limpa o campo', async () => {
    m.activities.create.mockResolvedValue({ id: 'a1' });
    renderWithClient(<QuickAddCard status={ActivityStatus.DRAFT} houseId="h1" />);
    const input = screen.getByPlaceholderText('+ Nova atividade (título)');
    fireEvent.changeText(input, 'Trocar lâmpada');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(m.activities.create).toHaveBeenCalledWith({
        title: 'Trocar lâmpada',
        status: ActivityStatus.DRAFT,
        houseId: 'h1',
      }),
    );
    await waitFor(() => expect(input.props.value).toBe(''));
  });

  it('mostra erro de API quando a criação falha', async () => {
    m.activities.create.mockRejectedValue(new Error('boom'));
    renderWithClient(<QuickAddCard status={ActivityStatus.DRAFT} />);
    fireEvent.changeText(screen.getByPlaceholderText('+ Nova atividade (título)'), 'X');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(screen.getByText(/criar a atividade|boom/)).toBeTruthy());
  });
});

describe('ActivityComments', () => {
  it('loading mostra LoadingState; depois lista vazia', async () => {
    m.activities.listComments.mockResolvedValue([]);
    renderWithClient(<ActivityComments activityId="a1" />);
    await waitFor(() => expect(screen.getByText('Nenhum comentário ainda.')).toBeTruthy());
  });

  it('lista comentários com autor', async () => {
    m.activities.listComments.mockResolvedValue([
      { id: 'c1', body: 'Olá', author: { name: 'Servo Z' }, createdAt: '2026-01-01T00:00:00Z', attachments: [] },
    ]);
    renderWithClient(<ActivityComments activityId="a1" />);
    await waitFor(() => expect(screen.getByText('Olá')).toBeTruthy());
    expect(screen.getByText('Servo Z')).toBeTruthy();
  });

  it('erro mostra ErrorState', async () => {
    m.activities.listComments.mockRejectedValue(new Error('x'));
    renderWithClient(<ActivityComments activityId="a1" />);
    await waitFor(() => expect(screen.getByText('Erro ao carregar os comentários.')).toBeTruthy());
  });

  it('submit vazio bloqueia (validação zod) e não chama addComment', async () => {
    m.activities.listComments.mockResolvedValue([]);
    renderWithClient(<ActivityComments activityId="a1" />);
    await waitFor(() => expect(screen.getByText('Nenhum comentário ainda.')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Comentar'));
    await waitFor(() => expect(screen.getByText('Escreva um comentário.')).toBeTruthy());
    expect(m.activities.addComment).not.toHaveBeenCalled();
  });

  it('submit válido adiciona o comentário (trim)', async () => {
    m.activities.listComments.mockResolvedValue([]);
    m.activities.addComment.mockResolvedValue({ id: 'c1' });
    renderWithClient(<ActivityComments activityId="a1" />);
    await waitFor(() => expect(screen.getByText('Nenhum comentário ainda.')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Novo comentário'), '  meu comentário  ');
    fireEvent.press(screen.getByLabelText('Comentar'));
    await waitFor(() =>
      expect(m.activities.addComment).toHaveBeenCalledWith('a1', { body: 'meu comentário' }),
    );
  });
});

describe('AudioRecorder', () => {
  it('mostra o botão de gravar quando não está gravando', () => {
    render(<AudioRecorder onRecorded={jest.fn()} uploading={false} />);
    expect(screen.getByLabelText('Gravar áudio')).toBeTruthy();
  });

  it('sem permissão de microfone alerta e não inicia gravação', async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    render(<AudioRecorder onRecorded={jest.fn()} uploading={false} />);
    fireEvent.press(screen.getByLabelText('Gravar áudio'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Permissão necessária', expect.any(String)),
    );
    expect(Audio.Recording.createAsync).not.toHaveBeenCalled();
  });

  it('com permissão inicia gravação e mostra o botão Parar', async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({
      recording: {
        stopAndUnloadAsync: jest.fn().mockResolvedValue({ durationMillis: 1000 }),
        getURI: () => 'file://r.m4a',
      },
    });
    render(<AudioRecorder onRecorded={jest.fn()} uploading={false} />);
    fireEvent.press(screen.getByLabelText('Gravar áudio'));
    await waitFor(() => expect(screen.getByLabelText('Parar gravação')).toBeTruthy());
  });
});
