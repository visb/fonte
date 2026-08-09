import { request as playwrightRequest } from '@playwright/test';
import { TEST_ADMIN } from './auth';
// Base da API de teste (não a URL do front) — constante única em `helpers/api.ts`.
import { API_URL } from './api';

/** Chave da preferência dos filtros da lista de Filhos (story 130). */
export const RESIDENTS_FILTERS_KEY = 'residents.filters';

/**
 * Remove a preferência `residents.filters` de um usuário direto via API, fora do
 * navegador — o cleanup não depende do estado da página nem de quem está logado.
 * A preferência mora no DB de teste COMPARTILHADO; quem grava filtro precisa
 * limpar, senão a hidratação (story 130) reaplica o filtro em specs seguintes e
 * esconde o João Testador do seed. Idempotente: `DELETE` de chave ausente é 204.
 */
export async function resetResidentsFilters(
  email = TEST_ADMIN.email,
  password = TEST_ADMIN.password,
) {
  const ctx = await playwrightRequest.newContext();
  try {
    const loginRes = await ctx.post(`${API_URL}/auth/login`, {
      data: { identifier: email, password },
    });
    if (!loginRes.ok()) return; // usuário/credencial indisponível: nada a limpar
    const { accessToken } = await loginRes.json();
    await ctx.delete(`${API_URL}/preferences/${RESIDENTS_FILTERS_KEY}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } finally {
    await ctx.dispose();
  }
}
