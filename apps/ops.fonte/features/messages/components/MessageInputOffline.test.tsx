/**
 * Mensagem é tempo real (socket.io) e fica **fora** da fila offline (decisão 1
 * do epic 167). Sem sinal a tela precisa dizer isso — story 171, decisão 4.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';

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

import { MessageInput } from './MessageInput';

afterEach(() => onlineManager.setOnline(true));

describe('MessageInput sem rede', () => {
  it('avisa o motivo e trava a composição', () => {
    onlineManager.setOnline(false);
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    // Campo bloqueado: nem chega a digitar, então não há o que enviar.
    fireEvent.changeText(screen.getByPlaceholderText('Escreva uma mensagem...'), 'oi');

    expect(screen.getByTestId('offline-notice')).toBeTruthy();
    expect(screen.getByText('Precisa de conexão para enviar mensagens.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Escreva uma mensagem...').props.editable).toBe(false);
    expect(screen.queryByText('icon:send')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('com rede envia normalmente e não mostra aviso', () => {
    onlineManager.setOnline(true);
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.changeText(screen.getByPlaceholderText('Escreva uma mensagem...'), 'oi');
    fireEvent.press(screen.getByText('icon:send'));

    expect(onSend).toHaveBeenCalledWith({ content: 'oi', attachments: undefined });
    expect(screen.queryByTestId('offline-notice')).toBeNull();
  });
});
