import type { APIRequestContext } from '@playwright/test';
import { TEST_ADMIN } from './auth';

// Base da API de teste (não a URL do front, que é o `baseURL` do Playwright em
// 5174). Absoluta de propósito: com `baseURL` + path iniciado em '/', o
// Playwright resolveria contra a raiz do domínio e descartaria o prefixo
// `/api/v1` (→ 404). Constante única do repo de e2e — quem precisar falar com a
// API direto importa daqui.
export const API_URL = process.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Login direto na API (fora do navegador), devolvendo o `accessToken`.
 * Reusa as credenciais de `helpers/auth.ts` — a credencial de teste tem um dono
 * só.
 */
export async function loginApi(
  request: APIRequestContext,
  email = TEST_ADMIN.email,
  password = TEST_ADMIN.password,
): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { identifier: email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login da API falhou (${res.status()}): ${await res.text()}`);
  }
  const { accessToken } = await res.json();
  return accessToken as string;
}

export interface TemplateFixtureInput {
  /** `name` é `unique` na entity — sufixar com `Date.now()` para reexecução. */
  name: string;
  content: string;
  isRequired?: boolean;
  signAtAdmission?: boolean;
  /** `TemplateAvailability`: 'ALL' | 'ACTIVE_ONLY' | 'INACTIVE_ONLY'. */
  availableFor?: string;
}

export interface TemplateFixture {
  id: string;
  name: string;
}

/**
 * Cria um `document_template` via API — fixture de spec, não seed global: os
 * templates só existem enquanto o arquivo de spec roda, então nenhuma outra
 * suíte enxerga obrigatório pendente (o gate do acolhimento em `admissionGate`
 * trava o wizard enquanto houver um).
 */
export async function createTemplate(
  request: APIRequestContext,
  token: string,
  data: TemplateFixtureInput,
): Promise<TemplateFixture> {
  const res = await request.post(`${API_URL}/document-templates`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  if (!res.ok()) {
    throw new Error(`Falha ao criar template "${data.name}" (${res.status()}): ${await res.text()}`);
  }
  const template = await res.json();
  return { id: template.id as string, name: template.name as string };
}

/**
 * Remove um `document_template` via API. Tolerante a 404: o cleanup roda sobre
 * tudo que a fixture criou e um template já removido (por um teste ou por uma
 * execução anterior interrompida) não pode derrubar a suíte.
 */
export async function deleteTemplate(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  const res = await request.delete(`${API_URL}/document-templates/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok() || res.status() === 404) return;
  throw new Error(`Falha ao remover template ${id} (${res.status()}): ${await res.text()}`);
}
