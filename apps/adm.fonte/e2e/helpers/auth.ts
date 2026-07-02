import { Page } from '@playwright/test';

export const TEST_ADMIN = {
  email: 'admin@fonte.com',
  password: 'admin123',
};

// O identificador aceita WhatsApp (primário — story 97) ou e-mail.
export async function login(page: Page, identifier = TEST_ADMIN.email, password = TEST_ADMIN.password) {
  await page.goto('/login');
  await page.getByLabel('WhatsApp ou e-mail').fill(identifier);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('/');
}
