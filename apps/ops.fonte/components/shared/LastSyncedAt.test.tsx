// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { render, screen } from '@testing-library/react-native';
import { LastSyncedAt, formatSyncedAt } from './LastSyncedAt';

describe('formatSyncedAt', () => {
  it('formata data e hora do jeito que o operador lê', () => {
    const syncedAt = new Date(2026, 7, 14, 9, 41).toISOString();

    expect(formatSyncedAt(syncedAt)).toBe('14/08/2026 às 09:41');
  });

  it('data inválida devolve null (a tela não mostra "Invalid Date")', () => {
    expect(formatSyncedAt('não é data')).toBeNull();
  });
});

describe('LastSyncedAt', () => {
  it('mostra quando o dado foi sincronizado — o prazo de 24h virou informação', () => {
    render(<LastSyncedAt syncedAt={new Date(2026, 7, 14, 9, 41).toISOString()} />);

    expect(screen.getByTestId('last-synced-at')).toBeTruthy();
    expect(screen.getByText('Atualizado em 14/08/2026 às 09:41')).toBeTruthy();
  });

  it('sem sincronização não ocupa espaço na tela', () => {
    const { rerender } = render(<LastSyncedAt syncedAt={null} />);
    expect(screen.queryByTestId('last-synced-at')).toBeNull();

    rerender(<LastSyncedAt />);
    expect(screen.queryByTestId('last-synced-at')).toBeNull();

    rerender(<LastSyncedAt syncedAt="lixo" />);
    expect(screen.queryByTestId('last-synced-at')).toBeNull();
  });
});
