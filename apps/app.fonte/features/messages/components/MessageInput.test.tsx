import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

// Pickers e áudio mockados — sem módulos nativos.
const mockCamera = jest.fn();
const mockGallery = jest.fn();
const mockReqCameraPerm = jest.fn();
const mockDoc = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: (...a: unknown[]) => mockReqCameraPerm(...a),
  launchCameraAsync: (...a: unknown[]) => mockCamera(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockGallery(...a),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...a: unknown[]) => mockDoc(...a),
}));

const mockRecording = {
  stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
  getURI: jest.fn(() => 'file://rec.m4a'),
};
const mockReqAudioPerm = jest.fn().mockResolvedValue({ granted: true });
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: (...a: unknown[]) => mockReqAudioPerm(...a),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: {
      createAsync: jest.fn().mockResolvedValue({ recording: mockRecording }),
    },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

import { MessageInput } from './MessageInput';

beforeEach(() => {
  jest.clearAllMocks();
  mockReqAudioPerm.mockResolvedValue({ granted: true });
});

describe('MessageInput', () => {
  it('envia texto digitado e limpa o campo', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.changeText(screen.getByPlaceholderText('Escreva uma mensagem...'), 'Olá');
    fireEvent.press(screen.getByLabelText('Enviar'));

    expect(onSend).toHaveBeenCalledWith({ content: 'Olá', attachments: undefined });
    expect(screen.getByPlaceholderText('Escreva uma mensagem...').props.value).toBe('');
  });

  it('não envia quando vazio (sem texto nem anexo)', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);
    // sem botão Enviar visível quando vazio; o botão mic ocupa o lugar.
    expect(screen.queryByLabelText('Enviar')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('adiciona imagens da galeria ao preview e as envia', async () => {
    mockGallery.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://g.jpg', mimeType: 'image/jpeg', fileName: 'g.jpg' }],
    });
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.press(screen.getByLabelText('Ionicons:add'));
    await act(async () => {
      fireEvent.press(screen.getByText('Galeria'));
    });

    // com anexo, o botão Enviar aparece
    const sendBtn = await screen.findByLabelText('Enviar');
    fireEvent.press(sendBtn);

    expect(onSend).toHaveBeenCalledWith({
      content: undefined,
      attachments: [
        { uri: 'file://g.jpg', mimeType: 'image/jpeg', name: 'g.jpg', type: 'image' },
      ],
    });
  });

  it('remove um anexo do preview', async () => {
    mockGallery.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://g.jpg', mimeType: 'image/jpeg', fileName: 'g.jpg' }],
    });
    render(<MessageInput onSend={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Ionicons:add'));
    await act(async () => {
      fireEvent.press(screen.getByText('Galeria'));
    });
    await screen.findByLabelText('Enviar');

    // o X de remover é um Ionicons:close
    fireEvent.press(screen.getByLabelText('Ionicons:close'));
    // sem anexo e sem texto, o botão Enviar some
    await waitFor(() => expect(screen.queryByLabelText('Enviar')).toBeNull());
  });

  it('adiciona documento via picker', async () => {
    mockDoc.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://d.pdf', mimeType: 'application/pdf', name: 'd.pdf' }],
    });
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.press(screen.getByLabelText('Ionicons:add'));
    await act(async () => {
      fireEvent.press(screen.getByText('Documento'));
    });

    const sendBtn = await screen.findByLabelText('Enviar');
    fireEvent.press(sendBtn);
    expect(onSend).toHaveBeenCalledWith({
      content: undefined,
      attachments: [
        { uri: 'file://d.pdf', mimeType: 'application/pdf', name: 'd.pdf', type: 'document' },
      ],
    });
  });

  it('captura foto pela câmera quando permissão concedida', async () => {
    mockReqCameraPerm.mockResolvedValue({ granted: true });
    mockCamera.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://c.jpg', mimeType: 'image/jpeg', fileName: 'c.jpg' }],
    });
    render(<MessageInput onSend={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Ionicons:add'));
    await act(async () => {
      fireEvent.press(screen.getByText('Câmera'));
    });
    expect(await screen.findByLabelText('Enviar')).toBeOnTheScreen();
  });

  it('não adiciona foto se a permissão de câmera for negada', async () => {
    mockReqCameraPerm.mockResolvedValue({ granted: false });
    render(<MessageInput onSend={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Ionicons:add'));
    await act(async () => {
      fireEvent.press(screen.getByText('Câmera'));
    });
    expect(mockCamera).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Enviar')).toBeNull();
  });

  // Nota: o envio de áudio depende do ciclo onPressIn/onPressOut do Pressable do
  // RN, que não é dirigível de forma estável no jsdom (o tracking interno de
  // press do Pressable quebra entre re-renders). startRecording é coberto por
  // "inicia a gravação"; stopRecording(cancel) por "cancela a gravação". O envio
  // de áudio fim-a-fim fica para o E2E Maestro.
  it('inicia a gravação ao pressionar o microfone', async () => {
    render(<MessageInput onSend={jest.fn()} />);
    await act(async () => {
      fireEvent(screen.getByLabelText('Ionicons:mic'), 'pressIn');
    });
    expect(await screen.findByText(/Gravando/)).toBeOnTheScreen();
  });

  it('cancela a gravação sem enviar', async () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    await act(async () => {
      fireEvent(screen.getByLabelText('Ionicons:mic'), 'pressIn');
    });
    const bar = await screen.findByText(/Gravando/);
    expect(bar).toBeOnTheScreen();

    // toca no lixo do RecordingBar para cancelar
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Ionicons:trash-outline'));
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('não grava quando a permissão de áudio é negada', async () => {
    mockReqAudioPerm.mockResolvedValue({ granted: false });
    render(<MessageInput onSend={jest.fn()} />);

    await act(async () => {
      fireEvent(screen.getByLabelText('Ionicons:mic'), 'pressIn');
    });
    expect(screen.queryByText(/Gravando/)).toBeNull();
  });

  it('botão de teste (__DEV__) preenche o campo de mensagem', () => {
    render(<MessageInput onSend={jest.fn()} />);
    // o atalho de teste só aparece quando não há texto nem gravação
    fireEvent.press(screen.getByLabelText('fill-test-message'));
    expect(screen.getByPlaceholderText('Escreva uma mensagem...').props.value).toBe(
      'Mensagem de teste',
    );
  });

  // stopRecording (linhas 72-89) e o ramo onPressOut (196-207) só são alcançáveis
  // pelo ciclo onPressIn/onPressOut do Pressable do RN. No jsdom esse ciclo é
  // instável: o tracking interno de press do Pressable quebra entre re-renders e o
  // recordingRef fica inacessível no momento do stop (mesmo via o lixo do
  // RecordingBar → stopRecording(true), o corpo da função não é exercido). startRecording
  // é coberto por "inicia a gravação"/"não grava quando a permissão é negada"; o
  // stop/envio de áudio fim-a-fim fica para o E2E Maestro (decisão herdada da story 84).
});
