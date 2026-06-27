import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { ActivityStatus } from '@fonte/types';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

// react-native-markdown-display: stub que só renderiza o texto e expõe onLinkPress.
let lastOnLinkPress: ((url: string) => boolean) | undefined;
jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, onLinkPress }: { children: string; onLinkPress: (u: string) => boolean }) => {
      lastOnLinkPress = onLinkPress;
      return <Text>{children}</Text>;
    },
  };
});

// expo pickers + áudio mockados.
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-av', () => ({
  Audio: {
    Sound: { createAsync: jest.fn() },
    Recording: { createAsync: jest.fn(), RecordingOptionsPresets: { HIGH_QUALITY: {} } },
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { StatusBadge } from './StatusBadge';
import { DescriptionMarkdown } from './DescriptionMarkdown';
import { CommentItem } from './CommentItem';
import { ActivityAttachments } from './ActivityAttachments';
import { AudioPlayer } from './AudioPlayer';
import { ActivityFormFields } from './ActivityFormFields';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
});

describe('StatusBadge', () => {
  it('renderiza o label de cada status conhecido', () => {
    render(<StatusBadge status={ActivityStatus.DONE} />);
    expect(screen.getByText('Concluída')).toBeTruthy();
  });

  it('status desconhecido cai no fallback (mostra o código)', () => {
    render(<StatusBadge status={'WEIRD' as ActivityStatus} />);
    expect(screen.getByText('WEIRD')).toBeTruthy();
  });
});

describe('DescriptionMarkdown', () => {
  it('sem markdown mostra placeholder "Sem descrição."', () => {
    render(<DescriptionMarkdown markdown={null} />);
    expect(screen.getByText('Sem descrição.')).toBeTruthy();
  });

  it('renderiza o markdown e abre links http/mailto, bloqueia javascript:', () => {
    render(<DescriptionMarkdown markdown="**oi** [link](https://x.com)" />);
    expect(screen.getByText('**oi** [link](https://x.com)')).toBeTruthy();
    expect(lastOnLinkPress!('https://x.com')).toBe(false);
    expect(Linking.openURL).toHaveBeenCalledWith('https://x.com');
    (Linking.openURL as jest.Mock).mockClear();
    lastOnLinkPress!('javascript:alert(1)');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});

describe('CommentItem', () => {
  function makeComment(overrides = {}) {
    return {
      id: 'c1',
      body: 'Comentário de teste',
      author: { name: 'Servo Y' },
      createdAt: '2026-03-10T12:00:00.000Z',
      attachments: [],
      ...overrides,
    } as never;
  }
  const handlers = {
    onDelete: jest.fn(),
    onUploadAttachment: jest.fn(),
    onDeleteAttachment: jest.fn(),
  };

  it('mostra autor e corpo; sem permissão não mostra Excluir', () => {
    render(
      <CommentItem
        comment={makeComment()}
        canDelete={false}
        deleting={false}
        uploadingAttachment={false}
        deletingAttachment={false}
        {...handlers}
      />,
    );
    expect(screen.getByText('Servo Y')).toBeTruthy();
    expect(screen.getByText('Comentário de teste')).toBeTruthy();
    expect(screen.queryByText('Excluir')).toBeNull();
  });

  it('autor desconhecido quando author é nulo', () => {
    render(
      <CommentItem
        comment={makeComment({ author: null })}
        canDelete={false}
        deleting={false}
        uploadingAttachment={false}
        deletingAttachment={false}
        {...handlers}
      />,
    );
    expect(screen.getByText('Desconhecido')).toBeTruthy();
  });

  it('com permissão mostra Excluir e dispara onDelete', () => {
    const onDelete = jest.fn();
    render(
      <CommentItem
        comment={makeComment()}
        canDelete
        deleting={false}
        uploadingAttachment={false}
        deletingAttachment={false}
        {...handlers}
        onDelete={onDelete}
      />,
    );
    fireEvent.press(screen.getByText('Excluir'));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });
});

describe('ActivityAttachments', () => {
  const baseProps = {
    attachments: [],
    onUpload: jest.fn(),
    onDelete: jest.fn(),
    uploading: false,
    deleting: false,
  };

  it('renderiza anexo de documento com link de download', () => {
    const att = {
      id: 'a1',
      fileType: 'document',
      fileName: 'doc.pdf',
      fileUrl: 'https://x/doc.pdf',
      sizeBytes: 1024,
      canDelete: false,
    };
    render(<ActivityAttachments {...baseProps} attachments={[att as never]} />);
    fireEvent.press(screen.getByLabelText('Abrir anexo doc.pdf'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://x/doc.pdf');
  });

  it('anexo de áudio renderiza player; excluir dispara onDelete quando canDelete', () => {
    const onDelete = jest.fn();
    const att = {
      id: 'a2',
      fileType: 'audio',
      fileName: 'audio.m4a',
      fileUrl: 'https://x/a.m4a',
      durationSeconds: 30,
      canDelete: true,
    };
    render(<ActivityAttachments {...baseProps} attachments={[att as never]} onDelete={onDelete} />);
    fireEvent.press(screen.getByLabelText('Excluir anexo audio.m4a'));
    expect(onDelete).toHaveBeenCalledWith('a2');
  });

  it('pickImage válido chama onUpload', async () => {
    const onUpload = jest.fn();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://f.jpg', mimeType: 'image/jpeg', fileName: 'f.jpg', fileSize: 1000 }],
    });
    render(<ActivityAttachments {...baseProps} onUpload={onUpload} />);
    fireEvent.press(screen.getByLabelText('Anexar imagem'));
    await waitFor(() => expect(onUpload).toHaveBeenCalled());
    expect(onUpload.mock.calls[0][0]).toMatchObject({ mimeType: 'image/jpeg', name: 'f.jpg' });
  });

  it('pickImage cancelado não chama onUpload', async () => {
    const onUpload = jest.fn();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    render(<ActivityAttachments {...baseProps} onUpload={onUpload} />);
    fireEvent.press(screen.getByLabelText('Anexar imagem'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('pickDocument com tipo inválido mostra Alert e não envia', async () => {
    const onUpload = jest.fn();
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://x.exe', mimeType: 'application/x-msdownload', name: 'x.exe', size: 100 }],
    });
    render(<ActivityAttachments {...baseProps} onUpload={onUpload} />);
    fireEvent.press(screen.getByLabelText('Anexar documento'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Anexo inválido', expect.any(String)));
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('mostra mensagem de erro de upload', () => {
    render(
      <ActivityAttachments
        {...baseProps}
        uploadError={{ message: 'falhou' }}
      />,
    );
    expect(screen.getByText(/falhou|Erro ao enviar/)).toBeTruthy();
  });
});

describe('AudioPlayer', () => {
  it('toca o áudio (carrega o som e chama playAsync)', async () => {
    const sound = { playAsync: jest.fn(), pauseAsync: jest.fn(), setRateAsync: jest.fn(), unloadAsync: jest.fn() };
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound });
    render(<AudioPlayer uri="https://x/a.m4a" durationSeconds={65} />);
    // duração formatada 1:05
    expect(screen.getByText(/1:05/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Reproduzir áudio'));
    await waitFor(() => expect(sound.playAsync).toHaveBeenCalled());
  });

  it('cicla a velocidade 1x → 1.5x', async () => {
    const sound = { playAsync: jest.fn(), pauseAsync: jest.fn(), setRateAsync: jest.fn(), unloadAsync: jest.fn() };
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound });
    render(<AudioPlayer uri="https://x/a.m4a" durationSeconds={30} />);
    expect(screen.getByText('1x')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Velocidade 1x'));
    await waitFor(() => expect(screen.getByText('1.5x')).toBeTruthy());
  });

  it('status atualiza posição/duração; tocando permite pausar', async () => {
    let statusCb: (s: Record<string, unknown>) => void = () => {};
    const sound = { playAsync: jest.fn(), pauseAsync: jest.fn(), setRateAsync: jest.fn(), unloadAsync: jest.fn() };
    (Audio.Sound.createAsync as jest.Mock).mockImplementation((_u, _o, cb) => {
      statusCb = cb;
      return Promise.resolve({ sound });
    });
    render(<AudioPlayer uri="https://x/a.m4a" durationSeconds={null} />);
    fireEvent.press(screen.getByLabelText('Reproduzir áudio'));
    await waitFor(() => expect(sound.playAsync).toHaveBeenCalled());
    // status: tocando, posição 10s / duração 40s → botão vira "Pausar"
    statusCb({ isLoaded: true, isPlaying: true, positionMillis: 10000, durationMillis: 40000 });
    await waitFor(() => expect(screen.getByLabelText('Pausar áudio')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Pausar áudio'));
    await waitFor(() => expect(sound.pauseAsync).toHaveBeenCalled());
    // status não-carregado é ignorado; didJustFinish volta para play
    statusCb({ isLoaded: false });
    statusCb({ isLoaded: true, isPlaying: false, positionMillis: 0, durationMillis: 40000, didJustFinish: true });
    await waitFor(() => expect(screen.getByLabelText('Reproduzir áudio')).toBeTruthy());
  });

  it('cycleSpeed aplica setRateAsync no som carregado', async () => {
    const sound = { playAsync: jest.fn(), pauseAsync: jest.fn(), setRateAsync: jest.fn(), unloadAsync: jest.fn() };
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound });
    render(<AudioPlayer uri="https://x/a.m4a" durationSeconds={30} />);
    fireEvent.press(screen.getByLabelText('Reproduzir áudio'));
    await waitFor(() => expect(sound.playAsync).toHaveBeenCalled());
    fireEvent.press(screen.getByLabelText('Velocidade 1x'));
    await waitFor(() => expect(sound.setRateAsync).toHaveBeenCalledWith(1.5, true));
  });
});

describe('ActivityFormFields', () => {
  // harness com useForm real para exercitar os Controllers.
  function Harness({ houseName }: { houseName?: string }) {
    const { useForm } = require('react-hook-form');
    const { control, formState: { errors } } = useForm({ defaultValues: { title: '', description: '' } });
    return <ActivityFormFields control={control} errors={errors} houseName={houseName} />;
  }

  it('renderiza os campos título/descrição e a casa quando informada', () => {
    render(<Harness houseName="Casa Bethel" />);
    expect(screen.getByPlaceholderText('Ex: Consertar o portão')).toBeTruthy();
    expect(screen.getByPlaceholderText('Detalhe a atividade (opcional)...')).toBeTruthy();
    expect(screen.getByText('Casa Bethel')).toBeTruthy();
  });

  it('sem houseName não renderiza o bloco de casa', () => {
    render(<Harness />);
    expect(screen.queryByText('Casa')).toBeNull();
  });

  it('edita o campo de título via Controller', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Ex: Consertar o portão');
    fireEvent.changeText(input, 'Trocar lâmpada');
    expect(input.props.value).toBe('Trocar lâmpada');
  });
});
