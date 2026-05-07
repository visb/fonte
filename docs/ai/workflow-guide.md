# Workflow para IA

## Antes de alterar

1. Identifique a área pelo [`project-map.md`](project-map.md).
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
| `packages/api-client` | `pnpm build:types` + `pnpm build:api-client` |
| Backend API | `pnpm build:api` + teste relevante ou `pnpm test:api` |
| Admin web | `pnpm build:types` + `pnpm build:api-client` + `pnpm --filter adm.fonte build` |
| Ops app | `pnpm build:types` + `pnpm build:api-client` + validação manual/dev quando aplicável |
| Migration | rodar migration em banco local/teste |

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

Para mudanças nestes guias, use escopo adequado de documentação quando aceito pelo repositório, por exemplo `docs` ou o módulo afetado.
