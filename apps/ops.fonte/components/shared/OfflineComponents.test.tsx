// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { render, screen } from '@testing-library/react-native';
import { PendingBadge } from './PendingBadge';
import { OfflineNotice } from './OfflineNotice';

describe('PendingBadge', () => {
  it('usa o mesmo termo da tela de pendências', () => {
    render(<PendingBadge />);

    expect(screen.getByTestId('pending-sync-badge')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
  });

  it('aceita rótulo próprio', () => {
    render(<PendingBadge label="Aguardando envio" />);

    expect(screen.getByText('Aguardando envio')).toBeTruthy();
  });
});

describe('OfflineNotice', () => {
  it('explica o motivo em vez de mostrar erro', () => {
    render(<OfflineNotice message="Precisa de conexão para enviar mensagens." />);

    expect(screen.getByTestId('offline-notice')).toBeTruthy();
    expect(screen.getByText('Precisa de conexão para enviar mensagens.')).toBeTruthy();
  });

  it('tem texto padrão quando a tela não especifica', () => {
    render(<OfflineNotice />);

    expect(screen.getByText(/Precisa de conexão/)).toBeTruthy();
  });
});
