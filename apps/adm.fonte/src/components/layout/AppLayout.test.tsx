import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Story 158 — a sidebar do adm.fonte precisa rolar por dentro: header (título +
// tema) e rodapé (Meu Perfil / Sair) ficam fixos e só a lista de links (<nav>)
// ganha barra de rolagem própria. Sem `min-h-0` a <nav> não encolhe abaixo do
// conteúdo (padrão `min-height: auto` do flex item) e empurra o rodapé para
// fora da viewport.
//
// Os testes abaixo travam as classes utilitárias que sustentam esse layout —
// jsdom não faz layout de verdade, então a prova visual (scroll real, rodapé
// visível em 1280x600) vive no E2E `e2e/layout.spec.ts`.
// ─────────────────────────────────────────────────────────────────────────────

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const logout = vi.fn();
const useAuthMock = vi.fn(() => ({ role: 'ADMIN', logout }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

// O sino de notificações abre socket + queries próprias; irrelevante para o
// layout da sidebar e já coberto pelos testes da própria feature.
vi.mock('@/features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

import { AppLayout } from './AppLayout';

function renderLayout(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<div>conteúdo</div>} />
          <Route path="*" element={<div>conteúdo</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** O bloco de rodapé da sidebar é o container direto do botão "Sair". */
function footerBlock() {
  return screen.getByRole('button', { name: 'Sair' }).parentElement as HTMLElement;
}

/** O bloco de topo da sidebar é o container direto do título "adm.fonte". */
function headerBlock() {
  return screen.getByRole('heading', { name: 'adm.fonte' }).parentElement as HTMLElement;
}

describe('AppLayout — sidebar com scroll próprio (story 158)', () => {
  beforeEach(() => {
    navigate.mockClear();
    logout.mockClear();
    useAuthMock.mockReturnValue({ role: 'ADMIN', logout });
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('dá à lista de links (<nav>) scroll próprio (min-h-0 + overflow-y-auto)', () => {
    const { container } = renderLayout();

    const nav = container.querySelector('nav') as HTMLElement;
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('flex-1');
    expect(nav).toHaveClass('min-h-0');
    expect(nav).toHaveClass('overflow-y-auto');
  });

  it('mantém header e rodapé da sidebar sem encolher (shrink-0)', () => {
    renderLayout();

    expect(headerBlock()).toHaveClass('shrink-0');
    expect(footerBlock()).toHaveClass('shrink-0');
  });

  it('mantém Meu Perfil e Sair fora da área rolável, no rodapé fixo', () => {
    const { container } = renderLayout();

    const nav = container.querySelector('nav') as HTMLElement;
    const profile = screen.getByRole('link', { name: 'Meu Perfil' });
    const exit = screen.getByRole('button', { name: 'Sair' });

    expect(profile).toBeInTheDocument();
    expect(exit).toBeInTheDocument();
    // Não podem ter sido movidos para dentro da <nav> que rola.
    expect(nav.contains(profile)).toBe(false);
    expect(nav.contains(exit)).toBe(false);
    expect(footerBlock()).toContainElement(profile);
    expect(footerBlock()).toContainElement(exit);
  });

  it('não coloca overflow no <main> nem o transforma em área da sidebar', () => {
    const { container } = renderLayout();

    // Regressão: o <main> continua com o próprio scroll, intocado pela story.
    const main = container.querySelector('main') as HTMLElement;
    expect(main).toHaveClass('flex-1');
    expect(main).toHaveClass('overflow-auto');
  });

  it('regressão: "Sair" continua deslogando e navegando para /login', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('regressão: submenu Faturamento abre e fecha', async () => {
    const user = userEvent.setup();
    renderLayout();

    expect(screen.queryByRole('link', { name: 'Pizza' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Faturamento/ }));
    expect(screen.getByRole('link', { name: 'Pizza' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pão' })).toBeInTheDocument();
    // ADMIN também enxerga Associados.
    expect(screen.getByRole('link', { name: 'Associados' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Faturamento/ }));
    expect(screen.queryByRole('link', { name: 'Pizza' })).not.toBeInTheDocument();
  });

  it('regressão: submenu Configurações abre e fecha', async () => {
    const user = userEvent.setup();
    renderLayout();

    expect(
      screen.queryByRole('link', { name: 'Templates de documentos' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Configurações/ }));
    expect(screen.getByRole('link', { name: 'Templates de documentos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Permissões' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'App para filhos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Configurações/ }));
    expect(
      screen.queryByRole('link', { name: 'Templates de documentos' }),
    ).not.toBeInTheDocument();
  });

  it('com os dois submenus abertos, o rodapé segue fora da <nav>', async () => {
    const user = userEvent.setup();
    const { container } = renderLayout();

    await user.click(screen.getByRole('button', { name: /Faturamento/ }));
    await user.click(screen.getByRole('button', { name: /Configurações/ }));

    const nav = container.querySelector('nav') as HTMLElement;
    expect(nav.contains(screen.getByRole('button', { name: 'Sair' }))).toBe(false);
    expect(screen.getByRole('link', { name: 'Meu Perfil' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeVisible();
  });
});
