# Plan: E2E do módulo document-templates (CRUD + auth)

## Context

O módulo `document-template` (`services/api/src/modules/document-template/`) **não tem e2e** — é o
único entre os módulos com controller que não aparece em `services/api/test/*.e2e-spec.ts`. A story
76 (URL canônica + assinatura ao servir) ficou coberta só no nível unit porque, no ambiente de teste,
**não há S3** (`.env.test` sem `AWS_*`), então `signContentUrls`/`stripContentSignatures` viram
no-op e um e2e não exercita o caminho assinado. Mesmo assim falta a malha de e2e do HTTP do módulo:
CRUD, auth e validação não têm cobertura de integração.

Esta story cria o e2e do `document-template`, **começando pelo CRUD/auth** (o que dá pra provar sem
S3), e deixa o gancho pronto para, no futuro, cobrir o fluxo assinado quando o test env tiver storage
S3 (ou um stub de storage em modo S3).

### Decisões travadas

- **Escopo inicial: CRUD + auth + validação.** Provar o que o ambiente sem S3 permite. O fluxo de
  assinatura de imagem (story 76) **fica fora** deste e2e enquanto o test env não tiver S3 — já está
  coberto no unit (`storage.service.spec` + `document-template.service.spec`).
- **Reusar o harness existente** (`test/helpers/e2e-app.ts`: `bootstrapApp`, `login`,
  `loginCoordinator`, `BASE`) — mesmo padrão de `activities.e2e-spec.ts`.
- **Sem novo endpoint.** Só testa os já existentes (`GET /document-templates`, `GET /:id`,
  `POST`, `PUT /:id`, `DELETE /:id`, `POST /document-templates/images`).
- **Limpeza no `afterAll`** — remover templates criados pelo teste (e quaisquer
  `resident_documents` dependentes) para não vazar estado entre suites.

## Desenho

### `services/api/test/document-templates.e2e-spec.ts` (novo)

Estrutura espelhando `activities.e2e-spec.ts`:

- `beforeAll`: `bootstrapApp`, `adminToken` (admin@fonte.com), `coordToken` via `loginCoordinator`.
- `afterAll`: `DELETE FROM resident_documents` (se necessário) e `DELETE FROM document_templates`
  dos registros criados no teste; `app.close()`.

Casos:

- **Auth/authorization**
  - `GET /document-templates` → 401 sem token.
  - `GET /:id` → 403 para SERVANT (rota é `ADMIN`/`COORDINATOR`); `GET` lista é
    `ADMIN`/`COORDINATOR`/`SERVANT` — cobrir a diferença de roles entre lista e detalhe.
  - `POST`/`PUT`/`DELETE` → 403 para SERVANT (somente `ADMIN`/`COORDINATOR`).
- **Validação**
  - `GET /:id` com UUID inválido → 400 (`ParseUUIDPipe`).
  - `POST` com nome duplicado → 409 (`ConflictException`).
  - `PUT` renomeando para nome já existente → 409.
- **CRUD feliz**
  - `POST` cria template (`name`, `content`, `isRequired`, `signAtAdmission`) → 201, corpo com `id`.
  - `GET /:id` devolve o criado.
  - `GET` lista inclui o criado.
  - `PUT /:id` atualiza `name`/`content`/flags → reflete no `GET`.
  - `DELETE /:id` → 204; `GET /:id` subsequente → 404.
- **Normalização de content (sem S3 — prova o no-op seguro)**
  - `PUT` com `content` contendo `<img src="…?X-Amz-Signature=…">`: em modo não-S3 a URL passa
    intacta (documenta o comportamento atual; quando houver S3 no test env, este caso vira a prova da
    canonicalização). Marcar com comentário referenciando a story 76.
- **Upload de imagem**
  - `POST /document-templates/images` sem arquivo → 400.
  - com arquivo não-imagem (mimetype `text/plain`) → 400.
  - com imagem pequena válida → 200/201 e `{ url }` definido (em modo não-S3, caminho
    `/uploads/documents/...`).

### Fora de escopo

- Cobrir o fluxo de **URL assinada** da story 76 no e2e (depende de S3 no test env). Continua no unit.
- Geração de PDF (`generatePdf`/puppeteer) — não roda em e2e leve.
- Mudar `.env.test` para configurar S3/MinIO (poderia ser uma story futura para destravar o e2e
  assinado).
- Qualquer mudança no app/adm front.

## Validação

- **`pnpm test:api:e2e`** com o novo `document-templates.e2e-spec.ts` passando (requer
  `pnpm test:setup` + `pnpm dev:api:test`, conforme CLAUDE.md).
- Rodar a suíte e2e inteira para garantir que o novo spec não vaza estado nem conflita com seeds
  (nomes de template únicos, limpeza no `afterAll`).
- Sem alteração de contrato → sem `build:types`/`build:api-client`/Postman.

### Casos a cobrir (enumeração)

- 401 sem token; 403 por role (SERVANT em detalhe/escrita); 400 UUID inválido; 409 nome duplicado
  (create e rename); CRUD feliz completo (create→get→list→update→delete→404); upload sem arquivo
  (400), não-imagem (400), imagem válida (`{ url }`); content com `<img>` assinado passando em
  não-S3 (documenta story 76).

### Gate de cobertura (trava a story)

Todo caminho de e2e novo tem asserção correspondente — sem teste "fumaça" sem assert. Rodar
`pnpm test:api:cov` e **não reduzir** a cobertura do módulo `document-template`. Sem
`skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).
