import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, makeRelease, renderRoute } from '@/test/renderRoute';
import type { Release } from '@/lib/releases';

const mockReleases: { current: Release[] } = { current: [] };
vi.mock('@/lib/content', () => ({
  get releases() {
    return mockReleases.current;
  },
}));

const MANIFEST = {
  version: '1.1.0',
  versionCode: 10100,
  sizeBytes: 73_400_320,
  sha256: 'f'.repeat(64),
  builtAt: '2026-10-20T12:00:00Z',
};

function mockFetch(response: Response | Error) {
  const fn = vi.fn();
  if (response instanceof Error) fn.mockRejectedValue(response);
  else fn.mockResolvedValue(response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('HomePage', () => {
  beforeEach(() => {
    mockReleases.current = [
      makeRelease({ version: '1.1.0', summary: 'Destaque da 1.1.0' }),
      makeRelease({ version: '1.0.0', breaking: true }),
    ];
  });

  afterEach(() => vi.unstubAllGlobals());

  it('mostra versão, tamanho e sha256 do latest.json e o botão para /downloads/ops.apk', async () => {
    mockFetch(jsonResponse(MANIFEST));
    renderRoute('/');

    expect(await screen.findByTestId('apk-version')).toHaveTextContent('1.1.0');
    expect(screen.getByTestId('apk-size')).toHaveTextContent('70,0 MB');
    expect(screen.getByTestId('apk-sha256')).toHaveTextContent(MANIFEST.sha256);
    expect(screen.getByTestId('download-apk')).toHaveAttribute('href', '/downloads/ops.apk');
    expect(screen.getByTestId('download-apk-versioned')).toHaveAttribute(
      'href',
      '/downloads/ops-1.1.0.apk',
    );
    expect(screen.getByText('Destaque da 1.1.0')).toBeInTheDocument();
    expect(screen.queryByTestId('breaking-notice')).not.toBeInTheDocument();
  });

  it('latest.json ausente (404) mostra "APK ainda não publicado" sem botão', async () => {
    mockFetch(jsonResponse('', 404));
    renderRoute('/');

    expect(await screen.findByText('APK ainda não publicado')).toBeInTheDocument();
    expect(screen.queryByTestId('download-apk')).not.toBeInTheDocument();
    // Sem APK, a release exibida é a mais nova do changelog.
    expect(screen.getByRole('heading', { name: 'v1.1.0' })).toBeInTheDocument();
  });

  it('avisa para desinstalar quando a release do APK publicado é breaking', async () => {
    mockFetch(jsonResponse({ ...MANIFEST, version: '1.0.0' }));
    renderRoute('/');

    expect(await screen.findByTestId('breaking-notice')).toHaveTextContent(/desinstalar/);
    expect(screen.getByRole('heading', { name: 'v1.0.0' })).toBeInTheDocument();
  });

  it('erro ao consultar o APK mostra ErrorState com nova tentativa', async () => {
    const fetchMock = mockFetch(jsonResponse('', 500));
    renderRoute('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar o APK.');
    fetchMock.mockResolvedValue(jsonResponse(MANIFEST));
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByTestId('download-apk')).toBeInTheDocument();
  });

  it('mostra carregando enquanto consulta o APK', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderRoute('/');
    expect(screen.getByRole('status')).toHaveTextContent('Verificando o APK publicado...');
  });

  it('sem nenhuma release no changelog mostra estado vazio', async () => {
    mockReleases.current = [];
    mockFetch(jsonResponse('', 404));
    renderRoute('/');
    expect(screen.getByText('Nenhuma versão publicada ainda')).toBeInTheDocument();
    expect(await screen.findByText('APK ainda não publicado')).toBeInTheDocument();
  });

  it('rota desconhecida volta para a home', async () => {
    mockFetch(jsonResponse('', 404));
    renderRoute('/qualquer-coisa');
    expect(await screen.findByText('APK ainda não publicado')).toBeInTheDocument();
  });
});
