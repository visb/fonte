import { Page } from '@playwright/test';

export const TEST_ADMIN = {
  email: 'admin@fonte.com',
  password: 'admin123',
};

export async function login(page: Page, email = TEST_ADMIN.email, password = TEST_ADMIN.password) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('/');
}
