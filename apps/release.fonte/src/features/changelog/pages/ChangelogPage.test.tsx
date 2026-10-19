import { screen, within } from '@testing-library/react';
import { makeRelease, renderRoute } from '@/test/renderRoute';
import type { Release } from '@/lib/releases';

const mockReleases: { current: Release[] } = { current: [] };
vi.mock('@/lib/content', () => ({
  get releases() {
    return mockReleases.current;
  },
}));

describe('ChangelogPage', () => {
  it('lista as releases na ordem recebida (mais nova primeiro) com link para o detalhe', () => {
    mockReleases.current = [
      makeRelease({ version: '1.10.0', date: '2026-12-01', summary: 'Dez', apk: false }),
      makeRelease({ version: '1.9.0', summary: 'Nove', breaking: true }),
    ];
    renderRoute('/changelog');

    const items = screen.getAllByTestId('release-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('v1.10.0');
    expect(items[0]).toHaveTextContent('01/12/2026');
    expect(items[0]).toHaveAttribute('href', '/changelog/1.10.0');
    expect(within(items[0]).queryByText('APK novo')).not.toBeInTheDocument();
    expect(items[1]).toHaveTextContent('v1.9.0');
    expect(within(items[1]).getByText('APK novo')).toBeInTheDocument();
    expect(within(items[1]).getByText('Exige reinstalar')).toBeInTheDocument();
  });

  it('sem releases mostra EmptyState', () => {
    mockReleases.current = [];
    renderRoute('/changelog');
    expect(screen.getByText('Nenhuma versão publicada ainda')).toBeInTheDocument();
    expect(screen.queryByTestId('release-item')).not.toBeInTheDocument();
  });
});
