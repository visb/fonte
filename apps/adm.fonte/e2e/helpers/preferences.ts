import { request as playwrightRequest } from '@playwright/test';
import { TEST_ADMIN } from './auth';
// Base da API de teste (não a URL do front) — constante única em `helpers/api.ts`.
import { API_URL } from './api';

/** Chave da preferência dos filtros da lista de Filhos (story 130). */
export const RESIDENTS_FILTERS_KEY = 'residents.filters';

/** Chave da preferência dos filtros da lista de Servos (story 223). */
export const STAFF_FILTERS_KEY = 'staff.filters';

/**
 * Remove uma preferência de um usuário direto via API, fora do navegador — o
 * cleanup não depende do estado da página nem de quem está logado. A
 * preferência mora no DB de teste COMPARTILHADO; quem grava filtro precisa
 * limpar, senão a hidratação (story 130) reaplica o filtro em specs seguintes.
 * Idempotente: `DELETE` de chave ausente é 204.
 */
async function resetPreference(key: string, email: string, password: string) {
  const ctx = await playwrightRequest.newContext();
  try {
    const loginRes = await ctx.post(`${API_URL}/auth/login`, {
      data: { identifier: email, password },
    });
    if (!loginRes.ok()) return; // usuário/credencial indisponível: nada a limpar
    const { accessToken } = await loginRes.json();
    await ctx.delete(`${API_URL}/preferences/${key}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } finally {
    await ctx.dispose();
  }
}

/** Limpa `residents.filters` (senão a hidratação esconde o João Testador do seed). */
export async function resetResidentsFilters(
  email = TEST_ADMIN.email,
  password = TEST_ADMIN.password,
) {
  await resetPreference(RESIDENTS_FILTERS_KEY, email, password);
}

/** Limpa `staff.filters` (senão a hidratação reaplica casa/status em `/staff`). */
export async function resetStaffFilters(
  email = TEST_ADMIN.email,
  password = TEST_ADMIN.password,
) {
  await resetPreference(STAFF_FILTERS_KEY, email, password);
}
