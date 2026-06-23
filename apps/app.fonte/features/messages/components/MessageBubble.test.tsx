import { render, screen, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { MessageStatus } from '@fonte/types';
import type { Message } from '@fonte/api-client';

jest.mock('@/lib/api', () => ({
  api: { photoUrl: jest.fn((u: string) => `https://cdn/${u}`) },
}));

// AudioPlayer puxa expo-av (módulo nativo) — substituído por marcador simples.
jest.mock('./AudioPlayer', () => ({
  AudioPlayer: ({ url }: { url: string }) => {
    const { Text } = require('react-native');
    return <Text>audio:{url}</Text>;
  },
}));

import { MessageBubble } from './MessageBubble';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    senderUserId: 'other-user',
    senderName: 'Coordenador',
    content: 'Olá família',
    status: MessageStatus.APPROVED,
    createdAt: '2026-06-23T13:05:00Z',
    ...overrides,
  } as Message;
}

describe('MessageBubble', () => {
  it('exibe o nome do remetente em mensagens recebidas', () => {
    render(<MessageBubble message={makeMessage()} myUserId="me" />);
    expect(screen.getByText('Coordenador')).toBeOnTheScreen();
    expect(screen.getByText('Olá família')).toBeOnTheScreen();
  });

  it('oculta o nome do remetente em mensagens próprias', () => {
    render(
      <MessageBubble
        message={makeMessage({ senderUserId: 'me' })}
        myUserId="me"
      />,
    );
    expect(screen.queryByText('Coordenador')).toBeNull();
  });

  it('mostra "aguardando aprovação" em mensagem própria pendente', () => {
    render(
      <MessageBubble
        message={makeMessage({ senderUserId: 'me', status: MessageStatus.PENDING_APPROVAL })}
        myUserId="me"
      />,
    );
    expect(screen.getByLabelText('status-aguardando')).toBeOnTheScreen();
  });

  it('não mostra "aguardando" quando recebida e pendente', () => {
    render(
      <MessageBubble
        message={makeMessage({ status: MessageStatus.PENDING_APPROVAL })}
        myUserId="me"
      />,
    );
    expect(screen.queryByLabelText('status-aguardando')).toBeNull();
  });

  it('renderiza o player de áudio para anexo de áudio resolvendo a url', () => {
    render(
      <MessageBubble
        message={makeMessage({
          content: '',
          attachmentType: 'audio',
          attachmentUrl: 'audios/x.m4a',
        })}
        myUserId="me"
      />,
    );
    expect(screen.getByText('audio:https://cdn/audios/x.m4a')).toBeOnTheScreen();
  });

  it('abre o documento ao tocar no anexo de documento', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    render(
      <MessageBubble
        message={makeMessage({
          content: '',
          attachmentType: 'document',
          attachmentUrl: 'docs/contrato.pdf',
        })}
        myUserId="me"
      />,
    );
    // nome derivado da url + extensão em maiúsculas
    expect(screen.getByText('contrato.pdf')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('contrato.pdf'));
    expect(openURL).toHaveBeenCalledWith('https://cdn/docs/contrato.pdf');
    openURL.mockRestore();
  });
});
