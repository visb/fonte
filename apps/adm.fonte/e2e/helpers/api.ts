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

/**
 * Casa do token logado. O staff do admin do seed não tem casa (`house_id` NULL),
 * então `GET /staff/me` só resolve para coordenador/servo — para o admin cai na
 * primeira casa cadastrada ("Casa Teste" no seed de teste). Story 182.
 */
export async function resolveHouseId(
  request: APIRequestContext,
  token: string,
): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };
  const me = await request.get(`${API_URL}/staff/me`, { headers });
  if (me.ok()) {
    const { houseId } = await me.json();
    if (houseId) return houseId as string;
  }
  const houses = await request.get(`${API_URL}/houses`, { headers });
  if (!houses.ok()) {
    throw new Error(`Falha ao listar casas (${houses.status()}): ${await houses.text()}`);
  }
  const list = (await houses.json()) as { id: string }[];
  if (!list.length) throw new Error('Nenhuma casa cadastrada — rode pnpm test:setup.');
  return list[0].id;
}

export interface ResidentFixtureInput {
  /** Sufixar com `Date.now()`: a fixture não pode colidir com buscas por nome. */
  name: string;
  /** Default: a casa resolvida por `resolveHouseId`. */
  houseId?: string;
  /** Default: hoje — é o que garante carnê com parcela pendente. */
  entryDate?: string;
  /** `FamilyInvestment`; default `PAYMENT_700` (plano pagante ⇒ gera parcelas). */
  familyInvestment?: string;
  contributionDueDay?: number;
}

export interface ResidentFixture {
  id: string;
  name: string;
  houseId: string;
}

/**
 * Cria um filho via API — fixture de spec, não seed global. Nasceu na story 182:
 * os testes de Contribuição mutavam o carnê do João Testador (recurso
 * compartilhado do seed) e num segundo run sem reseed as parcelas já estavam
 * pagas, sumindo com o botão "Registrar pagamento".
 *
 * `entryDate` de hoje + `familyInvestment` pagante fazem o backend gerar o carnê
 * já na criação (`ResidentService.create` → `generateSchedule`), sem passar pelo
 * wizard — que tem cobertura própria e custaria vários passos de UI.
 */
export async function createResident(
  request: APIRequestContext,
  token: string,
  data: ResidentFixtureInput,
): Promise<ResidentFixture> {
  const houseId = data.houseId ?? (await resolveHouseId(request, token));
  const res = await request.post(`${API_URL}/residents`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: data.name,
      houseId,
      entryDate: data.entryDate ?? new Date().toISOString().slice(0, 10),
      familyInvestment: data.familyInvestment ?? 'PAYMENT_700',
      ...(data.contributionDueDay ? { contributionDueDay: data.contributionDueDay } : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`Falha ao criar filho "${data.name}" (${res.status()}): ${await res.text()}`);
  }
  const resident = await res.json();
  return { id: resident.id as string, name: resident.name as string, houseId };
}

/**
 * Remove um filho via API (soft delete por `deleted_at`). Tolerante a 404, como
 * `deleteTemplate`: um run interrompido pode ter deixado a fixture pela metade e
 * cleanup não derruba suíte.
 */
export async function deleteResident(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  const res = await request.delete(`${API_URL}/residents/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok() || res.status() === 404) return;
  throw new Error(`Falha ao remover filho ${id} (${res.status()}): ${await res.text()}`);
}

export interface StoreroomItemFixture {
  id: string;
  name: string;
  unit: string;
  /** Rótulo exibido no seletor de catálogo: `nome (unidade)`. */
  label: string;
}

/**
 * Cria um item de almoxarifado via API. Story 182: o teste de contribuição em
 * produtos selecionava o "Arroz (kg)" do seed, que a suíte de storerooms apagava
 * — agora cada teste declara o SEU item, com nome único, e o seleciona pelo nome
 * que criou.
 */
export async function createStoreroomItem(
  request: APIRequestContext,
  token: string,
  data: { name: string; unit: string; houseId: string },
): Promise<StoreroomItemFixture> {
  const res = await request.post(`${API_URL}/storerooms/items`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  if (!res.ok()) {
    throw new Error(`Falha ao criar item "${data.name}" (${res.status()}): ${await res.text()}`);
  }
  const item = await res.json();
  return {
    id: item.id as string,
    name: item.name as string,
    unit: item.unit as string,
    label: `${item.name} (${item.unit})`,
  };
}

/**
 * Remove um item de almoxarifado via API. O `DELETE` da rota é SOFT (marca
 * `deleted_at`), então é seguro mesmo quando o teste declarou o item numa
 * contribuição: nada é apagado fisicamente, o `inventory_item_id` da
 * contribuição continua apontando para a linha e o
 * `CHK_rpc_item_xor_description` não tem como estourar. Tolerante a 404.
 */
export async function deleteStoreroomItem(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  const res = await request.delete(`${API_URL}/storerooms/items/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok() || res.status() === 404) return;
  throw new Error(`Falha ao remover item ${id} (${res.status()}): ${await res.text()}`);
}
