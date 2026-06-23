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
});

describe('AudioPlayer (messages)', () => {
  it('renderiza o botão play e o placeholder de duração', () => {
    render(<AudioPlayer url="https://x/a.m4a" isOwn={false} />);
    expect(screen.getByText('icon:play-circle')).toBeTruthy();
    expect(screen.getByText('–:––')).toBeTruthy();
  });
});
