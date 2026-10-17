import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/api', () => ({
  api: {
    audit: { list: vi.fn(), event: vi.fn(), byTarget: vi.fn() },
    houses: { list: vi.fn() },
    staff: { list: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { renderWithClient } from '@/test/utils';
import { AuditPage } from './AuditPage';

const summary = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1',
  createdAt: '2026-10-17T12:00:00.000Z',
  action: 'resident.update',
  outcome: 'SUCCESS',
  reason: null,
  userId: 'u1',
  userName: 'Admin Fonte',
  role: 'ADMIN',
  targetType: 'resident',
  targetId: 'r1',
  targetName: 'João',
  houseId: 'h2',
  houseName: 'Casa B',
  previousHouseId: 'h1',
  previousHouseName: 'Casa A',
  parentType: null,
  parentId: null,
  parentName: null,
  changedFields: ['houseId'],
  hasDetail: true,
  ...overrides,
});

const detail = (overrides: Record<string, unknown> = {}) => ({
  ...summary(),
  changes: [
    { field: 'houseId', before: 'h1', after: 'h2', redacted: false },
    { field: 'cpf', before: '***00', after: '***11', redacted: true },
    { field: 'healthIssues', before: null, after: null, redacted: true },
    { field: 'photoUrl', before: null, after: '[arquivo]', redacted: false },
  ],
  context: null,
  httpMethod: 'PATCH',
  path: '/api/v1/residents/r1',
  ipAddress: '10.0.0.1',
  correlationId: 'req',
  ...overrides,
});

function renderPage() {
  return renderWithClient(
    <MemoryRouter>
      <AuditPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(api.houses.list).mockResolvedValue([{ id: 'h1', name: 'Casa A' }] as never);
  vi.mocked(api.staff.list).mockResolvedValue([
    { id: 's1', name: 'Servo Um', userId: 'u9' },
    { id: 's2', name: 'Sem acesso' },
  ] as never);
});
afterEach(() => vi.clearAllMocks());

describe('AuditPage', () => {
  it('loading → lista com usuário, ação, recurso, casa (transferência) e resultado', async () => {
    let resolve!: (v: unknown) => void;
    vi.mocked(api.audit.list).mockReturnValue(new Promise((r) => (resolve = r)) as never);
    renderPage();
    expect(screen.getByText('Carregando...')).toBeInTheDocument();

    resolve({
      items: [
        summary(),
        summary({
          id: 'e2',
          action: 'auth.login',
          outcome: 'FAILURE',
          reason: 'INVALID_CREDENTIALS',
          userId: null,
          userName: null,
          role: null,
          targetType: null,
          targetId: null,
          targetName: null,
          houseId: null,
          houseName: null,
          previousHouseId: null,
        }),
        summary({ id: 'e3', outcome: null, userName: null, userId: 'abcdef0123456', houseName: null, houseId: 'hhhhhhhhhhhh', previousHouseId: null, targetName: null, action: 'x.legacy' }),
      ],
      nextCursor: null,
    });
    const rows = await screen.findAllByTestId('audit-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Admin Fonte')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Administrador')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Ficha do filho editada')).toBeInTheDocument();
    expect(within(rows[0]).getByText('João')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Casa A → Casa B')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Sucesso')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Tentativa não autenticada')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Senha incorreta')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Falha')).toBeInTheDocument();
    expect(within(rows[2]).getByText('abcdef01…')).toBeInTheDocument();
    expect(within(rows[2]).getByText('x.legacy')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('vazio mostra EmptyState', async () => {
    vi.mocked(api.audit.list).mockResolvedValue({ items: [], nextCursor: null } as never);
    renderPage();
    expect(await screen.findByText('Nenhum evento encontrado.')).toBeInTheDocument();
  });

  it('erro mostra ErrorState com retry', async () => {
    vi.mocked(api.audit.list).mockRejectedValue({ response: { data: { message: 'Sem permissão' } } });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Sem permissão')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(api.audit.list).toHaveBeenCalledTimes(2));
  });

  it('carregar mais usa o cursor; atualizar refaz a consulta', async () => {
    vi.mocked(api.audit.list)
      .mockResolvedValueOnce({ items: [summary()], nextCursor: 'c1' } as never)
      .mockResolvedValueOnce({ items: [summary({ id: 'e9' })], nextCursor: null } as never)
      .mockResolvedValue({ items: [summary()], nextCursor: null } as never);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(screen.getAllByTestId('audit-row')).toHaveLength(2));
    expect(api.audit.list).toHaveBeenLastCalledWith({ cursor: 'c1' });

    await user.click(screen.getByRole('button', { name: /Atualizar/ }));
    await waitFor(() => expect(vi.mocked(api.audit.list).mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it('filtrar reinicia a paginação com os filtros; limpar volta ao padrão', async () => {
    vi.mocked(api.audit.list).mockResolvedValue({ items: [summary()], nextCursor: null } as never);
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByTestId('audit-row');
    await screen.findByRole('option', { name: 'Casa A' });
    await screen.findByRole('option', { name: 'Servo Um' });
    expect(screen.queryByRole('option', { name: 'Sem acesso' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Ação'), 'auth.login');
    await user.selectOptions(screen.getByLabelText('Resultado'), 'FAILURE');
    await user.selectOptions(screen.getByLabelText('Casa'), 'h1');
    await user.selectOptions(screen.getByLabelText('Usuário'), 'u9');
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() =>
      expect(api.audit.list).toHaveBeenLastCalledWith({
        action: 'auth.login',
        outcome: 'FAILURE',
        houseId: 'h1',
        userId: 'u9',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(api.audit.list).toHaveBeenLastCalledWith({}));
    expect(screen.getByLabelText('Ação')).toHaveValue('');
  });

  it('id de recurso inválido mostra erro e não consulta', async () => {
    vi.mocked(api.audit.list).mockResolvedValue({ items: [summary()], nextCursor: null } as never);
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByTestId('audit-row');
    await user.type(screen.getByLabelText('ID do recurso'), 'nao-e-id');
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));
    expect(await screen.findByText('Informe um ID válido')).toBeInTheDocument();
    expect(api.audit.list).toHaveBeenCalledTimes(1);
  });

  it('detalhe: Antes/Depois com rótulos, máscara, dado protegido, arquivo e link do recurso', async () => {
    vi.mocked(api.audit.list).mockResolvedValue({ items: [summary()], nextCursor: null } as never);
    vi.mocked(api.audit.event).mockResolvedValue(detail() as never);
    const user = userEvent.setup();
    renderPage();
    await user.click((await screen.findAllByTestId('audit-row'))[0]);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Campo')).toBeInTheDocument();
    const house = within(dialog).getByTestId('audit-change-houseId');
    expect(house).toHaveTextContent('Casa');
    expect(house).toHaveTextContent('h1');
    expect(within(dialog).getByTestId('audit-change-cpf')).toHaveTextContent('***00');
    expect(within(dialog).getByTestId('audit-change-healthIssues')).toHaveTextContent('Dado protegido');
    expect(within(dialog).getByTestId('audit-change-photoUrl')).toHaveTextContent('Arquivo');
    expect(within(dialog).getByTestId('audit-change-photoUrl')).toHaveTextContent('(vazio)');
    expect(within(dialog).getByRole('link', { name: 'Filho · João' })).toHaveAttribute('href', '/residents/r1');
    expect(within(dialog).getByText(/PATCH \/api\/v1\/residents\/r1/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/"field"/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('link', { name: 'Filho · João' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('detalhe de login (sem diff) mostra contexto; legado mostra detalhe indisponível', async () => {
    vi.mocked(api.audit.list).mockResolvedValue({
      items: [summary({ id: 'login' }), summary({ id: 'old' })],
      nextCursor: null,
    } as never);
    vi.mocked(api.audit.event).mockImplementation(async (id: string) =>
      (id === 'login'
        ? detail({
            id: 'login',
            action: 'auth.login',
            outcome: 'FAILURE',
            reason: 'INACTIVE_USER',
            userId: null,
            userName: null,
            role: null,
            targetType: null,
            targetId: null,
            targetName: null,
            houseId: null,
            houseName: null,
            previousHouseId: null,
            changes: null,
            context: { identifier: 'a***@fonte.com', status: 401 },
            path: null,
          })
        : detail({
            id: 'old',
            hasDetail: false,
            changes: null,
            context: null,
            outcome: null,
            targetName: null,
            parentType: 'resident',
            parentId: 'p1',
            parentName: null,
          })) as never,
    );
    const user = userEvent.setup();
    renderPage();
    const rows = await screen.findAllByTestId('audit-row');

    await user.click(rows[0]);
    let dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Esta ação não altera campos — veja o contexto abaixo.')).toBeInTheDocument();
    expect(within(dialog).getByTestId('audit-context-identifier')).toHaveTextContent('a***@fonte.com');
    expect(within(dialog).getByText(/Tentativa não autenticada/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Usuário inativo/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(rows[1]);
    dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/Detalhe indisponível/)).toBeInTheDocument();
    // Recurso sem nome (removido): exibido por id, sem link.
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Filho · p1')).toBeInTheDocument();
  });

  it('erro ao carregar o detalhe tem retry', async () => {
    vi.mocked(api.audit.list).mockResolvedValue({ items: [summary()], nextCursor: null } as never);
    vi.mocked(api.audit.event).mockRejectedValueOnce(new Error('x')).mockResolvedValue(detail() as never);
    const user = userEvent.setup();
    renderPage();
    await user.click((await screen.findAllByTestId('audit-row'))[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Tentar novamente' }));
    expect(await within(dialog).findByText('Campo')).toBeInTheDocument();
  });
});
