import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Autenticação', () => {
  test('login válido redireciona para dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  // Story 97 — o servo entra com WhatsApp + senha (o whatsapp do coordenador
  // vem do seed de teste: 11977773000 / coord123).
  test('login por whatsapp + senha redireciona para dashboard', async ({ page }) => {
    await login(page, '11977773000', 'coord123');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('whatsapp desconhecido exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('WhatsApp ou e-mail').fill('11900000000');
    await page.getByLabel('Senha').fill('coord123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Credenciais inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('login inválido exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('WhatsApp ou e-mail').fill('admin@fonte.com');
    await page.getByLabel('Senha').fill('senha_errada');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Credenciais inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('identificador vazio exibe validação do formulário', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Senha').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Informe WhatsApp ou e-mail')).toBeVisible();
  });

  // Story 163 — ciclo completo do envio de imagem como assinatura, contra a API real.
  test('assinatura por envio de imagem no perfil', async ({ page }) => {
    await login(page);
    await page.goto('/profile');

    const removeSignature = async () => {
      await page.getByRole('button', { name: 'Redefinir' }).click();
      await page.getByRole('button', { name: 'Remover', exact: true }).click();
      await expect(page.getByText('Nenhuma assinatura configurada.')).toBeVisible();
    };

    // Estado inicial determinístico: limpa resíduo de execução anterior.
    await expect(
      page.getByRole('button', { name: /Configurar assinatura|Alterar assinatura/ }),
    ).toBeVisible();
    if (await page.getByRole('button', { name: 'Redefinir' }).isVisible()) {
      await removeSignature();
    }

    await page.getByRole('button', { name: 'Configurar assinatura' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('tab', { name: 'Desenhar' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await dialog.getByRole('tab', { name: 'Enviar imagem' }).click();
    await expect(dialog.getByRole('button', { name: 'Salvar' })).toBeDisabled();

    // PNG 120x60: fundo claro com um traço escuro no meio — a remoção de fundo do
    // cliente (story 163) precisa de pixels claros de verdade para ter o que apagar.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAHgAAAA8CAYAAACtrX6oAAAAqUlEQVR4nO3TsQkAMRADQRdx/Rd6ib+Mh/UEkwsWnd29dJ2/ByAwAiPwowSOEzhO4DiB4wSOEzhO4DiB4wSOEzhO4DiB4wSOEzhO4DiB4wSOEzhO4DiB4wSOEzhO4DiB4wSOOzNz6fLgOIHjBI4TOE7gOIHjBI4TOE7gOIHjBI4TOE7gOIHjBI4TOE7gOIHjBI4TOE7gOIHjBI4TOE7gOIHjBI4TOE7guA8BxiyUA9nXsQAAAABJRU5ErkJggg==',
      'base64',
    );
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'assinatura-e2e.png',
      mimeType: 'image/png',
      buffer: png,
    });

    await expect(dialog.getByLabel('Prévia da assinatura')).toBeVisible();
    await expect(dialog.getByText('assinatura-e2e.png')).toBeVisible();
    const save = dialog.getByRole('button', { name: 'Salvar' });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByAltText('Sua assinatura')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar assinatura' })).toBeVisible();

    // Devolve o perfil ao estado do seed.
    await removeSignature();
  });

  test('logout retorna para login', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL('/login');
  });
});
