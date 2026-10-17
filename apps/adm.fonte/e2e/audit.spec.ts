import { test, expect, type APIRequestContext } from '@playwright/test';
import { login } from './helpers/auth';
import { API_URL, createResident, deleteResident, loginApi } from './helpers/api';

// ─────────────────────────────────────────────────────────────────────────────
// E2E da tela /auditoria (story 199).
//
// ISOLAMENTO (story 182): o filho é fixture própria (nome com Date.now(),
// removido no afterAll) e o seed é só leitura. Os eventos de auditoria gerados
// aqui NÃO são apagados: a trilha é append-only por desenho e não existe rota de
// exclusão (decisão da story). Eles não interferem em outras suítes — toda
// asserção daqui filtra pelo id da própria fixture.
// ─────────────────────────────────────────────────────────────────────────────

const EXTRA_UPDATES = 51; // > 50 (página padrão) para exercitar "Carregar mais"

async function patchResident(
  request: APIRequestContext,
  token: string,
  id: string,
  data: Record<string, unknown>,
) {
  const res = await request.patch(`${API_URL}/residents/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  if (!res.ok()) throw new Error(`PATCH falhou (${res.status()}): ${await res.text()}`);
}

test.describe('Auditoria', () => {
  let token: string;
  let residentId: string;
  const name = `Auditado ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    token = await loginApi(request);
    const resident = await createResident(request, token, { name });
    residentId = resident.id;
    await patchResident(request, token, residentId, { name: `${name} Editado` });
  });

  test.afterAll(async ({ request }) => {
    if (residentId) await deleteResident(request, token, residentId);
  });

  test('ADMIN entra pelo menu, filtra a ação recém-criada e vê antes/depois', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Auditoria' }).click();
    await expect(page).toHaveURL('/auditoria');
    await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();

    await page.getByLabel('Ação').selectOption('resident.update');
    await page.getByLabel('ID do recurso').fill(residentId);
    await page.getByRole('button', { name: 'Filtrar' }).click();

    const row = page.getByTestId('audit-row').first();
    await expect(row).toContainText('Ficha do filho editada');
    await expect(row).toContainText(`${name} Editado`);
    await expect(row).toContainText('Sucesso');

    await row.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('columnheader', { name: 'Antes' })).toBeVisible();
    const change = dialog.getByTestId('audit-change-name');
    await expect(change).toContainText('Nome');
    await expect(change).toContainText(name);
    await expect(change).toContainText(`${name} Editado`);
    await expect(dialog.getByRole('link', { name: new RegExp(`Filho · ${name}`) })).toBeVisible();
  });

  test('paginação: "Carregar mais" traz a próxima página do mesmo filtro', async ({ page, request }) => {
    for (let i = 0; i < EXTRA_UPDATES; i++) {
      await patchResident(request, token, residentId, { occupation: `Ofício ${i}` });
    }
    await login(page);
    await page.goto('/auditoria');
    await page.getByLabel('ID do recurso').fill(residentId);
    await page.getByRole('button', { name: 'Filtrar' }).click();

    await expect(page.getByTestId('audit-row')).toHaveCount(50);
    await page.getByRole('button', { name: 'Carregar mais' }).click();
    // criação + 1ª edição + 51 edições = 53 eventos do filho
    await expect(page.getByTestId('audit-row')).toHaveCount(53);
    await expect(page.getByRole('button', { name: 'Carregar mais' })).toHaveCount(0);

    // Limpar filtros volta à consulta padrão (últimos 30 dias) e reinicia a paginação.
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByLabel('ID do recurso')).toHaveValue('');
    await expect(page.getByTestId('audit-row')).toHaveCount(50);
  });

  test('COORDINATOR não vê o menu e é barrado na URL direta', async ({ page }) => {
    await login(page, 'coord@fonte.com', 'coord123');
    await expect(page.getByRole('link', { name: 'Auditoria' })).toHaveCount(0);
    await page.goto('/auditoria');
    await expect(page.getByRole('heading', { name: 'Auditoria' })).toHaveCount(0);
  });

  test('SERVANT não entra no adm e portanto não alcança a tela', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('WhatsApp ou e-mail').fill('operator@fonte.com');
    await page.getByLabel('Senha', { exact: true }).fill('operator123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Acesso não permitido para este perfil.')).toBeVisible();
    await page.goto('/auditoria');
    await expect(page).toHaveURL(/\/login/);
  });
});
