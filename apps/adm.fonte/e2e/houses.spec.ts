import { test, expect, type APIRequestContext } from '@playwright/test';
import { login } from './helpers/auth';
import { API_URL, loginApi } from './helpers/api';

const HOUSE_NAME = `Casa E2E ${Date.now()}`;

/**
 * Cria um filho ACTIVE na Casa Teste, com ou sem foto (story 181).
 *
 * Fixture por teste em vez de depender do seed: o seed não sobe foto de ninguém
 * (a linha da aba Filhos mostraria só o fallback) e o filho semeado pode ganhar
 * foto por outra suíte que rode antes.
 */
async function createResident(
  request: APIRequestContext,
  name: string,
  options: { withPhoto: boolean },
): Promise<void> {
  const headers = { Authorization: `Bearer ${await loginApi(request)}` };

  const housesRes = await request.get(`${API_URL}/houses`, { headers });
  const houses = (await housesRes.json()) as Array<{ id: string; name: string }>;
  const house = houses.find((h) => h.name === 'Casa Teste') ?? houses[0];

  const created = await request.post(`${API_URL}/residents`, {
    headers,
    data: { name, houseId: house.id, status: 'ACTIVE', entryDate: '2024-01-01' },
  });
  expect(created.status()).toBe(201);
  const residentId = (await created.json()).id as string;
  if (!options.withPhoto) return;

  // 1x1 PNG transparente — o upload passa pelo sharp e gera a thumb.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  const photo = await request.post(`${API_URL}/residents/${residentId}/photo`, {
    headers,
    multipart: { file: { name: 'foto.png', mimeType: 'image/png', buffer: png } },
  });
  expect(photo.status()).toBe(201);
}

test.describe('Casas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Casas' }).click();
    await expect(page).toHaveURL('/houses');
  });

  test('lista casas existentes', async ({ page }) => {
    // "Casa Teste" criada pelo seed deve aparecer
    await expect(page.getByText('Casa Teste')).toBeVisible();
  });

  test('cria nova casa e aparece na lista', async ({ page }) => {
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(HOUSE_NAME);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(HOUSE_NAME)).toBeVisible();
  });

  test('edita casa existente', async ({ page }) => {
    const nameToEdit = `${HOUSE_NAME} Para Editar`;
    const updatedName = `${HOUSE_NAME} Editada`;
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(nameToEdit);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(nameToEdit)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: nameToEdit }).getByTitle('Editar').click();
    await page.getByLabel('Nome *').clear();
    await page.getByLabel('Nome *').fill(updatedName);
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  test('exclui casa e some da lista', async ({ page }) => {
    const tempName = `Casa Para Excluir ${Date.now()}`;
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(tempName);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(tempName)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: tempName }).getByTitle('Excluir').click();
    await page.getByRole('button', { name: 'Excluir' }).last().click();
    await expect(page.getByText(tempName)).not.toBeVisible();
  });

  test('modal de editar casa rola verticalmente em viewport baixa', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });

    const nameToEdit = `${HOUSE_NAME} Scroll ${Date.now()}`;
    await page.getByRole('button', { name: 'Nova Casa' }).click();
    await page.getByLabel('Nome *').fill(nameToEdit);
    await page.getByRole('button', { name: 'Criar' }).click();
    await expect(page.getByText(nameToEdit)).toBeVisible();

    await page.locator('.rounded-lg.border.bg-card').filter({ hasText: nameToEdit }).getByTitle('Editar').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // O container do dialog deve permitir scroll interno e estar de fato cortado pela viewport baixa.
    const overflowY = await dialog.evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');
    const isScrollable = await dialog.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);

    // O botão de salvar no rodapé fica acessível via scroll e é clicável.
    const saveButton = page.getByRole('button', { name: 'Salvar' });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    await expect(dialog).not.toBeVisible();
  });

  test('navega para detalhe da casa e exibe tabs', async ({ page }) => {
    await page.getByText('Casa Teste').click();
    await expect(page).toHaveURL(/\/houses\/.+/);
    await expect(page.getByRole('button', { name: 'Visão Geral' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filhos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Servos' })).toBeVisible();
  });

  test('navega entre tabs da casa', async ({ page }) => {
    await page.getByText('Casa Teste').click();
    await page.getByRole('button', { name: 'Servos' }).click();
    await expect(page).toHaveURL(/tab=staff/);
    await page.getByRole('button', { name: 'Filhos' }).click();
    await expect(page).toHaveURL(/tab=residents/);
  });

  // ─── Avatar nas abas do detalhe da casa (story 181) ───────────────────────

  test('aba Filhos mostra a foto do filho e a linha continua abrindo o dialog', async ({
    page,
    request,
  }) => {
    const name = `Filho Foto ${Date.now()}`;
    await createResident(request, name, { withPhoto: true });

    await page.getByText('Casa Teste').click();
    await page.getByRole('button', { name: 'Filhos' }).click();
    await page.getByPlaceholder('Buscar por nome...').fill(name);

    const avatar = page.getByAltText(name);
    await expect(avatar).toBeVisible();

    // Clicar no avatar não pode engolir o clique da linha.
    await avatar.click();
    await expect(page.getByRole('dialog').getByText('Detalhes do Filho')).toBeVisible();
  });

  test('aba Filhos cai no fallback para filho sem foto', async ({ page, request }) => {
    const name = `Filho Sem Foto ${Date.now()}`;
    await createResident(request, name, { withPhoto: false });

    await page.getByText('Casa Teste').click();
    await page.getByRole('button', { name: 'Filhos' }).click();
    await page.getByPlaceholder('Buscar por nome...').fill(name);

    const row = page.locator('button').filter({ hasText: name });
    await expect(row.locator('.w-9.h-9.rounded-full')).toBeVisible();
    await expect(row.locator('img')).toHaveCount(0);
  });

  // ─── Ministérios com filhos (story 205; inverte a 197) ───────────────────

  test('cria ministério e adiciona filho ativo; filho com alta não aparece na busca', async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const ministryName = `Ministério E2E ${stamp}`;
    const activeName = `Filho Ministério Ativo ${stamp}`;
    const dischargedName = `Filho Ministério Alta ${stamp}`;
    const headers = { Authorization: `Bearer ${await loginApi(request)}` };
    const housesRes = await request.get(`${API_URL}/houses`, { headers });
    const houses = (await housesRes.json()) as Array<{ id: string; name: string }>;
    const house = houses.find((h) => h.name === 'Casa Teste') ?? houses[0];
    const residentIds: string[] = [];

    // Fixtures próprias (story 182): um filho ativo e um que já saiu.
    for (const name of [activeName, dischargedName]) {
      const res = await request.post(`${API_URL}/residents`, {
        headers,
        data: { name, houseId: house.id, status: 'ACTIVE', entryDate: '2024-01-01' },
      });
      expect(res.status()).toBe(201);
      residentIds.push((await res.json()).id as string);
    }
    const discharge = await request.patch(`${API_URL}/residents/${residentIds[1]}`, {
      headers,
      data: { status: 'DISCHARGED' },
    });
    expect(discharge.status()).toBe(200);

    try {
      await page.getByText('Casa Teste').click();
      await page.getByRole('button', { name: 'Ministérios' }).click();

      await page.getByRole('button', { name: 'Novo ministério' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Nome *').fill(ministryName);

      // Líder: servos e filhos em acolhimento; quem já saiu não é opção.
      await dialog.getByText('Sem líder').click();
      await dialog.getByPlaceholder('Buscar...').fill('Filho Ministério');
      await expect(dialog.getByText(activeName)).toBeVisible();
      await expect(dialog.getByText(dischargedName)).toHaveCount(0);
      await dialog.getByPlaceholder('Buscar...').fill('Coordenador Teste');
      await dialog.getByText('Coordenador Teste').click({ position: { x: 5, y: 5 } });

      await dialog.getByRole('button', { name: 'Criar' }).click();

      const row = page.locator('.rounded-lg.border').filter({ hasText: ministryName });
      await expect(row).toBeVisible();
      await expect(row).toContainText('0 filhos');

      // Filhos do ministério: a busca só oferece filho em acolhimento.
      await row.getByTitle('Filhos do ministério').click();
      const residentsDialog = page.getByRole('dialog');
      await expect(residentsDialog.getByText(`Filhos — ${ministryName}`)).toBeVisible();
      await residentsDialog.getByPlaceholder('Buscar filho...').fill('Filho Ministério');
      await expect(residentsDialog.getByText(activeName)).toBeVisible();
      await expect(residentsDialog.getByText(dischargedName)).toHaveCount(0);

      await residentsDialog.getByRole('button', { name: `Adicionar ${activeName}` }).click();
      await expect(residentsDialog.getByText('Filhos (1)')).toBeVisible();
      await expect(residentsDialog.getByRole('button', { name: `Remover ${activeName}` })).toBeVisible();
      await residentsDialog.getByRole('button', { name: 'Fechar' }).first().click();

      await expect(row).toContainText('1 filho');
    } finally {
      // Limpeza por id acumulado (story 182). Delete tolera 404.
      const listRes = await request.get(`${API_URL}/houses/${house.id}/ministries`, { headers });
      const created = ((await listRes.json()) as Array<{ id: string; name: string }>).find(
        (m) => m.name === ministryName,
      );
      if (created) await request.delete(`${API_URL}/ministries/${created.id}`, { headers });
      for (const id of residentIds) await request.delete(`${API_URL}/residents/${id}`, { headers });
    }
  });

  // ─── Coordenadores da casa (story 194) ────────────────────────────────────

  test('casa com dois coordenadores: lista os dois e elege o titular pelo dialog', async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const headers = { Authorization: `Bearer ${await loginApi(request)}` };
    const created: string[] = [];

    const houseRes = await request.post(`${API_URL}/houses`, {
      headers,
      data: { name: `Casa 194 ${stamp}` },
    });
    expect(houseRes.status()).toBe(201);
    const houseId = (await houseRes.json()).id as string;

    async function createStaff(name: string, role: 'COORDINATOR' | 'SERVANT'): Promise<string> {
      const res = await request.post(`${API_URL}/staff`, {
        headers,
        data: {
          name,
          email: `${name.replace(/\s/g, '').toLowerCase()}.${stamp}@fonte.test`,
          password: 'secret123',
          role,
          houseId,
        },
      });
      expect(res.status()).toBe(201);
      const id = (await res.json()).id as string;
      created.push(id);
      return id;
    }

    const anaName = `Ana Coord ${stamp}`;
    const brunoName = `Bruno Coord ${stamp}`;
    const servoName = `Servo Comum ${stamp}`;
    await createStaff(anaName, 'COORDINATOR');
    await createStaff(brunoName, 'COORDINATOR');
    await createStaff(servoName, 'SERVANT');

    try {
      await page.goto(`/houses/${houseId}`);

      // Visão geral lista os dois coordenadores; ninguém é titular ainda.
      await expect(page.getByText(anaName)).toBeVisible();
      await expect(page.getByText(brunoName)).toBeVisible();
      // `exact` para não casar com o rótulo "Coordenador titular" do bloco de
      // informações — o badge é a palavra sozinha.
      await expect(page.getByText('Titular', { exact: true })).toHaveCount(0);

      await page.getByRole('button', { name: /Editar/ }).first().click();
      const dialog = page.getByRole('dialog');
      const select = dialog.getByLabel('Coordenador titular');

      // O servo não é oferecido — a UI não propõe o que o backend recusa (400).
      await expect(select.getByRole('option', { name: servoName })).toHaveCount(0);
      await expect(select.getByRole('option', { name: anaName })).toHaveCount(1);

      await select.selectOption({ label: anaName });
      await dialog.getByRole('button', { name: 'Salvar' }).click();
      await expect(dialog).not.toBeVisible();

      // O badge migra para o eleito, e só para ele.
      await expect(page.getByText('Titular', { exact: true })).toHaveCount(1);
      await expect(page.locator('div').filter({ hasText: anaName }).last()).toContainText('Titular');
    } finally {
      // Fixture própria, removida por id (story 182).
      for (const id of created) await request.delete(`${API_URL}/staff/${id}`, { headers });
      await request.delete(`${API_URL}/houses/${houseId}`, { headers });
    }
  });

  test('aba Servos mostra o avatar do servo', async ({ page }) => {
    await page.getByText('Casa Teste').click();
    await page.getByRole('button', { name: 'Servos' }).click();

    const row = page.locator('.rounded-lg.border').filter({ hasText: 'Coordenador Teste' });
    // Sem foto no seed: o avatar aparece no fallback, com a caixa do tamanho sm.
    await expect(row.locator('.w-9.h-9.rounded-full').first()).toBeVisible();
  });
});
