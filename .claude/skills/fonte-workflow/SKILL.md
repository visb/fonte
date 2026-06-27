---
name: fonte-workflow
description: Comandos e validação por tipo de mudança no monorepo fonte — build/test/docker, qual validação mínima rodar antes de commit, convenção de commit e cuidados (docker:reset, contratos compartilhados, auth). Use ao construir, testar, validar ou commitar mudanças.
---

# Workflow para IA

## Antes de alterar

1. Identifique a área pela skill `fonte-project-map`.
2. Leia os arquivos reais que serão alterados.
3. Consulte `BUSINESS_RULES.md` para mudanças de regra de negócio/permissão.
4. Consulte `CONTRIBUTING.md` apenas quando for criar commit.

## Comandos principais

Na raiz do monorepo:

```bash
pnpm install
pnpm docker:up
pnpm dev:api
pnpm dev:adm
pnpm dev:ops
pnpm build:types
pnpm build:api-client
pnpm build:api
pnpm test:api
pnpm test:all
```

Scripts úteis do root `package.json`:

- `pnpm docker:up` — sobe infraestrutura local.
- `pnpm docker:down` — derruba infraestrutura local.
- `pnpm docker:reset` — recria volumes; confirme antes porque apaga dados locais.
- `pnpm seed:api` — popula dados iniciais da API.

## Escolha de validação por tipo de mudança

| Mudança | Validação mínima sugerida |
| --- | --- |
| Apenas docs | revisar diff |
| `packages/types` | `pnpm build:types` |
| `packages/api-client` | `pnpm build:types` + `pnpm build:api-client` + `pnpm test:api-client` |
| Backend API | `pnpm build:api` + `pnpm test:api` (+ `pnpm test:api:e2e` se houver e2e) |
| Admin web | `pnpm build:types` + `pnpm build:api-client` + `pnpm test:adm:unit` + `pnpm --filter adm.fonte build` (+ `pnpm test:adm` do spec) |
| App associados | `pnpm build:associados` + `pnpm test:associados` (+ `pnpm test:associados:e2e` do fluxo) |
| Ops app | `pnpm build:types` + `pnpm build:api-client` + `pnpm test:ops:unit` (+ `pnpm test:ops:e2e` do fluxo) |
| App familiares | `pnpm build:types` + `pnpm build:api-client` + `pnpm test:app:unit` (+ `pnpm test:app:e2e` do fluxo) |
| Migration | rodar migration em banco local/teste |

## Padrão de testes (epic 49)

Cada workspace tem um runner por tipo e os arquivos de teste ficam num lugar fixo. **Regra
permanente: toda mudança atualiza os testes** — unit sempre, e2e quando a mudança envolve um
fluxo de usuário. Não se mergeia na main com a suíte tocada vermelha.

### Runner e localização por workspace

| Workspace | Tipo | Runner | Onde ficam os arquivos |
| --- | --- | --- | --- |
| `services/api` | unit | Jest | `*.spec.ts` ao lado do código (`src/<modulo>/`) |
| `services/api` | e2e | Jest + supertest | `test/*.e2e-spec.ts` |
| `adm.fonte` | unit | Vitest + `@testing-library/react` + jsdom | `*.test.ts(x)` ao lado do código |
| `adm.fonte` | e2e | Playwright | `e2e/*.spec.ts` (build web servido) |
| `associados` | unit | Vitest + RTL + jsdom | `*.test.ts(x)` ao lado do código |
| `associados` | e2e | Playwright | `e2e/*.spec.ts` |
| `ops.fonte` | unit | jest-expo + `@testing-library/react-native` (jsdom) | `*.test.ts(x)` ao lado do código |
| `ops.fonte` | e2e | Playwright contra `expo export --platform web` | `e2e/*.spec.ts` (Maestro nativo = opcional, não é gate) |
| `app.fonte` | unit | jest-expo + RTL native (jsdom) | `*.test.ts(x)` ao lado do código |
| `app.fonte` | e2e | Playwright contra export web | `e2e/*.spec.ts` (Maestro nativo = opcional, não é gate) |
| `packages/api-client` | unit | Vitest (transporte HTTP mockado) | `*.test.ts` ao lado do código |
| `packages/types` / `doc-styles` | — | sem unit relevante (só tipos/CSS) | — |

Resumo dos runners: **Vitest** para web (`adm.fonte`, `associados`) e packages
(`@fonte/api-client`); **jest-expo** para os apps Expo (`ops.fonte`, `app.fonte`); **Jest +
supertest** para o backend (`services/api`).

Convenção de extensão: `*.test.ts(x)` nos fronts/packages (ao lado do código); `*.spec.ts` no
backend (já era convenção). Apps Expo são testados em **modo web** (jsdom + export web), sem
emulador — o e2e nativo Maestro permanece no repo como opcional e **não** bloqueia o DoD.

### Comandos `pnpm test:*` (raiz)

| Comando | Roda |
| --- | --- |
| `pnpm test:api` | unit backend (Jest) |
| `pnpm test:api:e2e` | e2e backend (supertest) |
| `pnpm test:api:cov` | unit backend com cobertura |
| `pnpm test:api-client` | unit `@fonte/api-client` (Vitest) |
| `pnpm test:adm:unit` | unit `adm.fonte` (Vitest) |
| `pnpm test:adm` | e2e `adm.fonte` (Playwright) |
| `pnpm test:associados` | unit `associados` (Vitest) |
| `pnpm test:associados:e2e` | e2e `associados` (Playwright) |
| `pnpm test:ops:unit` | unit `ops.fonte` (jest-expo) |
| `pnpm test:ops:e2e` | e2e web `ops.fonte` (Playwright) |
| `pnpm test:ops` | e2e nativo `ops.fonte` (Maestro, opcional) |
| `pnpm test:app:unit` | unit `app.fonte` (jest-expo) |
| `pnpm test:app:e2e` | e2e web `app.fonte` (Playwright) |
| `pnpm test:app` | e2e nativo `app.fonte` (Maestro, opcional) |
| `pnpm test:all` | agregador das suítes **unit** existentes (cresce conforme as filhas 50–55 entregam cada tooling) |

`test:all` agrega só o que já existe hoje (no mínimo `pnpm test:api`); cada filha do epic 49
(stories 50–55) liga o `test:<workspace>:unit` correspondente ao instalar o tooling do seu
workspace, e então o nome reservado vira executável. e2e fica sob demanda (exige serviços/builds
no ar), fora do `test:all`.

### Catraca de cobertura — gate 90% (epic 85 / stories 86–91)

Piso de **90% statements** por pacote, travado no config (jest `coverageThreshold.global` em
`services/api`/`ops.fonte`/`app.fonte`; vitest `coverage.thresholds` em
`adm.fonte`/`portal.fonte`/`@fonte/api-client`). `branches`/`functions`/`lines` travados no valor
já atingido. **Novo código vem com teste**; abaixo do piso o processo sai != 0 e quebra o build.
**Os 6 pacotes no piso 90**, inclusive `adm.fonte` (90.65% statements, story 87). O coverage do adm
"não medível" era um loop de render em `HouseDialog` (default `[]` instável na dep do `useEffect`)
que pendurava o worker do vitest no fim da suíte — corrigido; a cov roda em ~100s. Ver
`stories/PROGRESS.md`.

| Comando | Roda |
| --- | --- |
| `pnpm test:cov:all` | os 6 pacotes com `--coverage` em sequência (gate completo) |
| `pnpm test:api:cov` / `test:api-client:cov` | backend / api-client com cobertura |
| `pnpm test:adm:unit:cov` / `test:portal:cov` | web com cobertura |
| `pnpm test:ops:unit:cov` / `test:app:unit:cov` | apps Expo (web) com cobertura |

CI: `.github/workflows/ci.yml` roda `pnpm test:cov:all` em push/PR na `main` — threshold abaixo
do piso = build vermelho. E2E **não** entra no gate. **Subir o piso é PR próprio; nunca baixar**
sem justificativa registrada (a catraca só sobe). Excluir orquestração do denominador
(`pages/**`/`app/**`/`sentry.ts`) sobe o % **sem teste novo** — não conta como progresso.

## Cuidados

- Não rode `pnpm docker:reset` sem confirmação explícita.
- Não edite `dist/` ou artefatos gerados como fonte da verdade; altere `src/` e gere build.
- Não faça commit sem pedido explícito do usuário.
- Ao mudar contratos compartilhados, procure consumidores em backend, `adm.fonte`, `ops.fonte` e `api-client`.
- Ao mexer em auth, confira backend e os dois frontends, porque o fluxo cruza apps.

## Convenção de commit

Se o usuário pedir commit, siga `CONTRIBUTING.md`:

```text
type(scope): descrição curta em português no infinitivo
```

Scopes esperados incluem:

- `apps/adm`
- `apps/ops`
- `services/api`
- `packages/types`

Para mudanças de documentação use escopo adequado quando aceito pelo repositório, por exemplo `docs` ou o módulo afetado.
