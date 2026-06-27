import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { MessageStatus } from '@fonte/types';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: { createAsync: jest.fn(), RecordingOptionsPresets: { HIGH_QUALITY: {} } },
    Sound: { createAsync: jest.fn() },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));
jest.mock('@/lib/api', () => ({ resolveAssetUrl: (u: string | null) => u }));

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { MessageBubble } from './MessageBubble';
import { AttachmentPreviews } from './AttachmentPreviews';
import { AttachmentMenuSheet } from './AttachmentMenuSheet';
import { MessageInput } from './MessageInput';
import { AudioPlayer } from './AudioPlayer';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
});

describe('MessageBubble', () => {
  function makeMsg(overrides = {}) {
    return {
      id: 'm1',
      content: 'Olá',
      senderName: 'Mãe',
      status: MessageStatus.APPROVED,
      attachmentType: null,
      attachmentUrl: null,
      ...overrides,
    } as never;
  }

  it('mensagem recebida mostra nome do remetente e conteúdo', () => {
    render(<MessageBubble message={makeMsg()} isOwn={false} />);
    expect(screen.getByText('Mãe')).toBeTruthy();
    expect(screen.getByText('Olá')).toBeTruthy();
  });

  it('mensagem própria pendente mostra "Aguardando aprovação"', () => {
    render(<MessageBubble message={makeMsg({ status: MessageStatus.PENDING_APPROVAL })} isOwn />);
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy();
  });

  it('mensagem própria rejeitada mostra "Não aprovada"', () => {
    render(<MessageBubble message={makeMsg({ status: MessageStatus.REJECTED })} isOwn />);
    expect(screen.getByText('Não aprovada')).toBeTruthy();
  });

  it('anexo de documento abre a URL ao tocar', () => {
    render(
      <MessageBubble
        message={makeMsg({ content: null, attachmentType: 'document', attachmentUrl: 'https://x/file.pdf' })}
        isOwn={false}
      />,
    );
    expect(screen.getByText('file.pdf')).toBeTruthy();
    fireEvent.press(screen.getByText('file.pdf'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://x/file.pdf');
  });
});

describe('AttachmentPreviews', () => {
  it('vazio não renderiza nada', () => {
    const { toJSON } = render(<AttachmentPreviews attachments={[]} onRemove={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('renderiza previews e remove dispara onRemove com o índice', () => {
    const onRemove = jest.fn();
    render(
      <AttachmentPreviews
        attachments={[
          { uri: 'x', mimeType: 'image/png', name: 'a', type: 'image' },
          { uri: 'y', mimeType: 'audio/m4a', name: 'b', type: 'audio' },
        ] as never}
        onRemove={onRemove}
      />,
    );
    const closeButtons = screen.getAllByText('icon:close');
    fireEvent.press(closeButtons[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});

describe('AttachmentMenuSheet', () => {
  it('dispara câmera/galeria/documento', () => {
    const onCamera = jest.fn();
    const onGallery = jest.fn();
    const onDocument = jest.fn();
    render(<AttachmentMenuSheet visible onClose={jest.fn()} onCamera={onCamera} onGallery={onGallery} onDocument={onDocument} />);
    fireEvent.press(screen.getByText('Câmera'));
    expect(onCamera).toHaveBeenCalled();
    fireEvent.press(screen.getByText('Galeria'));
    expect(onGallery).toHaveBeenCalled();
    fireEvent.press(screen.getByText('Documento'));
    expect(onDocument).toHaveBeenCalled();
  });
});

describe('MessageInput', () => {
  it('envia texto digitado e limpa o campo', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);
    const input = screen.getByPlaceholderText('Escreva uma mensagem...');
    fireEvent.changeText(input, 'Olá família');
    fireEvent.press(screen.getByText('icon:send'));
    expect(onSend).toHaveBeenCalledWith({ content: 'Olá família', attachments: undefined });
  });

  it('texto vazio não envia', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);
    // sem texto, o botão de enviar nem aparece (mostra o mic)
    expect(screen.queryByText('icon:send')).toBeNull();
    expect(screen.getByText('icon:mic')).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('abre o menu de anexos ao tocar no +', () => {
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.press(screen.getByText('icon:add'));
    expect(screen.getByText('Enviar')).toBeTruthy();
  });

  it('galeria adiciona preview de anexo', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://f.jpg', mimeType: 'image/jpeg', fileName: 'f.jpg' }],
    });
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.press(screen.getByText('icon:add'));
    fireEvent.press(screen.getByText('Galeria'));
    await waitFor(() => expect(screen.getAllByText('icon:close').length).toBeGreaterThan(0));
  });

  it('documento cancelado não adiciona anexo', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.press(screen.getByText('icon:add'));
    fireEvent.press(screen.getByText('Documento'));
    await waitFor(() => expect(DocumentPicker.getDocumentAsync).toHaveBeenCalled());
  });

  it('gravar áudio (pressIn) sem permissão não inicia', async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent(screen.getByText('icon:mic').parent as never, 'pressIn');
    await waitFor(() => expect(Audio.requestPermissionsAsync).toHaveBeenCalled());
    expect(Audio.Recording.createAsync).not.toHaveBeenCalled();
  });

  it('gravar áudio com permissão inicia a gravação (mostra "Gravando...")', async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({
      recording: {
        stopAndUnloadAsync: jest.fn().mockResolvedValue({}),
        getURI: () => 'file://r.m4a',
      },
    });
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent(screen.getByText('icon:mic').parent as never, 'pressIn');
    await waitFor(() => expect(screen.getByText(/Gravando/)).toBeTruthy());
  });

  it('gravar e soltar (pressOut) envia o áudio gravado', async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    const stopAndUnloadAsync = jest.fn().mockResolvedValue({});
    (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({
      recording: { stopAndUnloadAsync, getURI: () => 'file://r.m4a' },
    });
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);
    const mic = screen.getByText('icon:mic').parent as never;
    fireEvent(mic, 'pressIn');
    await waitFor(() => expect(screen.getByText(/Gravando/)).toBeTruthy());
    fireEvent(mic, 'pressOut');
    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith({
        attachments: [{ uri: 'file://r.m4a', mimeType: 'audio/m4a', name: 'audio.m4a', type: 'audio' }],
      }),
    );
  });

  it('cancelar gravação (lixeira) não envia áudio', async () => {
    (Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
    (Audio.Recording.createAsync as jest.Mock).mockResolvedValue({
      recording: { stopAndUnloadAsync: jest.fn().mockResolvedValue({}), getURI: () => 'file://r.m4a' },
    });
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);
    fireEvent(screen.getByText('icon:mic').parent as never, 'pressIn');
    await waitFor(() => expect(screen.getByText(/Gravando/)).toBeTruthy());
    fireEvent.press(screen.getByText('icon:trash-outline'));
    await waitFor(() => expect(screen.queryByText(/Gravando/)).toBeNull());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('câmera com permissão adiciona preview e envia anexo', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://c.jpg', mimeType: 'image/jpeg', fileName: 'c.jpg' }],
    });
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);
    fireEvent.press(screen.getByText('icon:add'));
    fireEvent.press(screen.getByText('Câmera'));
    await waitFor(() => expect(screen.getAllByText('icon:close').length).toBeGreaterThan(0));
    // com anexo, o botão de enviar aparece e envia o anexo
    fireEvent.press(screen.getByText('icon:send'));
    expect(onSend).toHaveBeenCalledWith({
      content: undefined,
      attachments: [
        { uri: 'file://c.jpg', mimeType: 'image/jpeg', name: 'c.jpg', type: 'image' },
      ],
    });
  });

  it('câmera sem permissão não adiciona anexo', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.press(screen.getByText('icon:add'));
    fireEvent.press(screen.getByText('Câmera'));
    await waitFor(() => expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled());
    expect(screen.queryByText('icon:close')).toBeNull();
  });

  it('documento selecionado adiciona preview e remove pelo X', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://d.pdf', mimeType: 'application/pdf', name: 'd.pdf' }],
    });
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.press(screen.getByText('icon:add'));
    fireEvent.press(screen.getByText('Documento'));
    await waitFor(() => expect(screen.getAllByText('icon:close').length).toBeGreaterThan(0));
    fireEvent.press(screen.getAllByText('icon:close')[0]);
    await waitFor(() => expect(screen.queryByText('icon:close')).toBeNull());
  });
});

describe('AudioPlayer (messages)', () => {
  it('renderiza o botão play e o placeholder de duração', () => {
    render(<AudioPlayer url="https://x/a.m4a" isOwn={false} />);
    expect(screen.getByText('icon:play-circle')).toBeTruthy();
    expect(screen.getByText('–:––')).toBeTruthy();
  });
});
