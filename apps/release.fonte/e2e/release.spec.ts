import { expect, test } from '@playwright/test';

// A home lê /downloads/latest.json servido pelo próprio Vite (fixture em
// e2e/public). O changelog vem do conteúdo real de content/releases.

test('home → changelog → detalhe → voltar', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('apk-version')).toHaveText('1.0.0');
  await expect(page.getByTestId('apk-size')).toHaveText('70,0 MB');
  // A v1.0.0 é a primeira assinada: a home avisa que exige desinstalar.
  await expect(page.getByTestId('breaking-notice')).toBeVisible();

  await page.getByRole('link', { name: 'Changelog' }).click();
  await expect(page).toHaveURL(/\/changelog$/);
  const firstItem = page.getByTestId('release-item').first();
  await expect(firstItem).toBeVisible();

  await page.getByTestId('release-item').filter({ hasText: 'v1.0.0' }).click();
  await expect(page).toHaveURL(/\/changelog\/1\.0\.0$/);
  await expect(page.getByRole('heading', { level: 1, name: 'v1.0.0' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Ops (celular)' })).toBeVisible();

  await page.getByRole('link', { name: /Voltar para o changelog/ }).click();
  await expect(page).toHaveURL(/\/changelog$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/changelog\/1\.0\.0$/);
});

test('botões de download apontam para o APK fixo e o versionado', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('download-apk')).toHaveAttribute('href', '/downloads/ops.apk');
  await expect(page.getByTestId('download-apk-versioned')).toHaveAttribute(
    'href',
    '/downloads/ops-1.0.0.apk',
  );
});

test('sem latest.json publicado a home mostra "APK ainda não publicado"', async ({ page }) => {
  await page.route('**/downloads/latest.json', (route) =>
    route.fulfill({ status: 404, body: 'not found' }),
  );
  await page.goto('/');

  await expect(page.getByText('APK ainda não publicado')).toBeVisible();
  await expect(page.getByTestId('download-apk')).toHaveCount(0);
});

test('versão inexistente no changelog mostra não encontrado', async ({ page }) => {
  await page.goto('/changelog/9.9.9');
  await expect(page.getByText('Versão não encontrada')).toBeVisible();
});
