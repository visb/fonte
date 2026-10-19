import { screen } from '@testing-library/react';
import { renderRoute } from '@/test/renderRoute';

vi.mock('@/lib/content', () => ({
  releases: [
    {
      version: '1.1.0',
      date: '2026-10-20',
      summary: 'Resumo da 1.1.0',
      apk: false,
      breaking: false,
      body: '## Ops (celular)\n\n- Lançar **contribuição** pelo `menu`\n\n## Administração\n\nTexto livre.',
    },
  ],
}));

describe('ReleaseDetailPage', () => {
  it('renderiza cabeçalho e as seções por app', () => {
    renderRoute('/changelog/1.1.0');

    expect(screen.getByRole('heading', { level: 1, name: 'v1.1.0' })).toBeInTheDocument();
    expect(screen.getByText('20/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Resumo da 1.1.0')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Ops (celular)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Administração' })).toBeInTheDocument();
    expect(screen.getByText('contribuição').tagName).toBe('STRONG');
    expect(screen.getByText('menu').tagName).toBe('CODE');
    expect(screen.getByText('Texto livre.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para o changelog/ })).toHaveAttribute(
      'href',
      '/changelog',
    );
  });

  it('aceita a versão com prefixo v (nome da tag)', () => {
    renderRoute('/changelog/v1.1.0');
    expect(screen.getByRole('heading', { level: 1, name: 'v1.1.0' })).toBeInTheDocument();
  });

  it('versão inexistente mostra estado de não encontrado', () => {
    renderRoute('/changelog/9.9.9');
    expect(screen.getByText('Versão não encontrada')).toBeInTheDocument();
    expect(screen.getByText(/9\.9\.9/)).toBeInTheDocument();
  });
});
