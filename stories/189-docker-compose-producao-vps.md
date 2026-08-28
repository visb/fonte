# Plan: Dockerfile multi-stage + compose de produção no VPS (nginx servindo `uploads/`)

## Context

A plataforma sai do Railway para um VPS único. Hoje **não existe nenhum artefato de deploy no
repositório** — o Railway monta a imagem por nixpacks a partir da configuração do painel, então
nada disso está versionado. Sem Dockerfile e sem compose, não há como subir a stack no VPS nem
reproduzir o ambiente.

**Decisões do usuário:**
- **Um VPS, tudo em Docker Compose:** api + postgres + redis + nginx.
- **Arquivos em disco, servidos por nginx.** O `uploads/` deixa de ser bucket S3 e vira volume;
  quem entrega os bytes é o nginx, não o Node.
- **nginx é a porta de entrada única:** termina TLS, roteia `/api/v1` para a API, `/uploads`
  para o volume e serve os estáticos dos **três** frontends web.
- **Três frontends, todos estáticos.** `adm.fonte` e `portal.fonte` saem do Vite;
  `ops.fonte` sai do `expo export --platform web` (`build:web`), que também produz um `dist/`
  estático — o `start:web` dele é literalmente `npx serve dist`. Nenhum dos três precisa de
  processo Node em runtime, então **nenhum vira serviço no compose**: são roots de `server`
  no nginx.
- **`app.fonte` fica de fora.** Não vai ser servido por URL no momento (decisão do usuário);
  familiares seguem pelo app instalado. O `build:web` dele existe, então incluir depois é
  um `COPY` e um `server` block.

Depende da story 188 (snapshot de migração) para popular o volume `uploads/` e o banco. Esta
story entrega o *ambiente*; a 188 entrega o *conteúdo*.

### Correções que entram junto (o deploy sai quebrado sem elas)

1. **`main.ts:34` testa a variável errada.** `if (!process.env.STORAGE_BUCKET_NAME)` — essa
   variável não existe em lugar nenhum; o resto do código lê `AWS_S3_BUCKET_NAME`
   (`storage.service.ts:42`). Resultado: o `useStaticAssets` **sempre** registra, inclusive em
   modo S3. Com nginx servindo `/uploads`, o Node não deve mais servir arquivo nenhum.
2. **CORS aberto.** `main.ts:22` chama `app.enableCors()` sem argumento — libera qualquer
   origem. `CORS_ORIGIN` está documentado no `.env.example:7` mas **nunca é lido** (nenhuma
   ocorrência no código). Atrás do Railway passava; num VPS público exposto, não.

---

## Premissas a confirmar antes de implementar

Não bloqueiam a escrita da story, mas mudam o `nginx.conf`:

- **Domínios: um `server_name` por app, em subdomínio** (confirmado pelo usuário), não os
  três sob paths do mesmo host. Path-based exigiria `base` no Vite (adm/portal) e
  `experiments.baseUrl` no Expo (ops), mais invasivo e fácil de quebrar no fallback de SPA.
  - `adm.fontedemisericordia.com.br` — confirmado.
  - `ops.fontedemisericordia.com.br` — confirmado, e **já em produção**: é o endereço que
    `docs/comunicacao/whatsapp-coordenadores-nova-plataforma.md:25` manda os coordenadores
    abrirem. O corte para o VPS tem de preservar esse host funcionando.
  - `portal.` — **ainda não definido**. É a superfície pública dos associados (projeto Sentry
    `fonte-associados`), então pode querer `associados.` em vez de `portal.`; o nome escolhido
    entra em `APP_ASSOCIADOS_URL`, que é o que vai nos links de cobrança do WhatsApp.
- **Domínio de e-mail diverge do domínio web.** `mail.service.ts:36` envia como
  `nao-responda@fontedemisericordia.org` (`.org`), enquanto os apps ficam em
  `.com.br`. Não bloqueia a migração — o envio não passa pelo VPS — mas conferir que o
  `.org` continua com SPF/DKIM válidos, já que os links dentro do e-mail passam a apontar
  para o `.com.br`.
- **TLS:** assumido `certbot` em container companion com renovação por cron e webroot
  compartilhado, em vez de Caddy (o usuário pediu nginx explicitamente).
- **URL da API é build-time nos três.** Vite embute `VITE_API_URL` e Expo embute
  `EXPO_PUBLIC_API_URL` no bundle. Trocar de domínio exige **rebuild da imagem**, não
  restart. Mesmo vale para `APP_ASSOCIADOS_URL` e `CORS_ORIGIN` no lado da API.

---

## Desenho

### 1. `Dockerfile` (raiz do monorepo, multi-stage)

O build precisa do workspace inteiro: a `api` depende de `@fonte/types` e `@fonte/doc-styles`;
os três frontends dependem de `@fonte/types` e `@fonte/api-client` (adm também de
`doc-styles`). Build de app isolado não funciona.

- **`base`** — `node:22-alpine`, `corepack enable` fixando `pnpm@11.3.0` (o
  `packageManager` do `package.json` raiz).
- **`deps`** — copia `pnpm-lock.yaml`, `pnpm-workspace.yaml` e todos os `package.json` do
  workspace; `pnpm install --frozen-lockfile`. Camada separada para o cache não invalidar a
  cada mudança de código.
- **`build`** — copia o código e roda, nesta ordem: `pnpm build:types`,
  `pnpm build:doc-styles`, `pnpm build:api-client`, `pnpm build:api`,
  `pnpm --filter adm.fonte build`, `pnpm --filter portal.fonte build`, `pnpm build:ops`.
  O último é o script de raiz que já existe e chama o `expo export --platform web`.
  **Não** buildar `app.fonte` — fora de escopo.
  Os três frontends recebem sua URL de API por env de build (`VITE_API_URL` /
  `EXPO_PUBLIC_API_URL`) — declarar como `ARG` no stage e passar no `build`.
- **`api`** (runtime final da API) — `node:22-alpine` +
  **`apk add postgresql16-client`** (pré-requisito bloqueante das stories 20 e 188: o
  `BackupService` faz `spawn` de `pg_dump`/`pg_restore` v16, `backup.service.ts:297,328`).
  Copia `services/api/dist`, os `dist` dos packages compartilhados e as deps de produção.
  `CMD` = `pnpm --filter api start` — que já roda
  `typeorm migration:run` antes do `node dist/main` (`services/api/package.json:12`).
  `WORKDIR` tem de ser `services/api`: o `StorageService` resolve `process.cwd()/uploads`
  (`storage.service.ts:104`).
- **`web`** (runtime do nginx) — `nginx:alpine` + `COPY --from=build` dos **três** `dist/`
  para `/srv/adm`, `/srv/portal` e `/srv/ops`, mais o `default.conf`.
  Origens: `apps/adm.fonte/dist`, `apps/portal.fonte/dist`, `apps/ops.fonte/dist`.

### 2. `docker-compose.prod.yml` (raiz)

Quatro serviços; só o nginx publica porta no host (80/443).

- **`postgres`** — `postgres:16-alpine`, volume nomeado `postgres_data`, `TZ/PGTZ=UTC`
  (espelha o `docker-compose.yml` de dev), healthcheck `pg_isready`. **Sem** `ports:` — só a
  rede interna. `POSTGRES_PASSWORD` vem do `.env` do host, nunca hardcoded.
- **`redis`** — `redis:7-alpine`, sem `ports:`. Cache não crítico (sem `REDIS_URL` a app
  recalcula, ver `.env.example:9-10`).
- **`api`** — imagem stage `api`, `env_file`, `depends_on` com `condition: service_healthy`,
  `restart: unless-stopped`. Monta o volume `uploads` em
  `/app/services/api/uploads` (**rw**).
- **`nginx`** — imagem stage `web`, publica 80/443, monta o **mesmo** volume `uploads` em
  `/srv/uploads` como **`:ro`** e os certificados.

Volumes nomeados: `postgres_data`, `uploads`, `certbot_conf`, `certbot_www`.

> O volume `uploads` compartilhado rw/ro é o ponto central: a API escreve
> (`storage.service.ts:104-108`), o nginx só lê.

### 3. `docker/nginx/default.conf`

Rotas, na ordem de precedência:

- `location /api/v1/ { proxy_pass http://api:3000; }` — casa com o
  `setGlobalPrefix("api/v1")` (`main.ts:25`). Repassa `Host`, `X-Real-IP`,
  `X-Forwarded-For`, `X-Forwarded-Proto`.
- `location /uploads/ { alias /srv/uploads/; }` — servido direto do disco, com
  `expires`/`Cache-Control` e **`autoindex off`** (listar diretório expõe o acervo inteiro).
- `location / { try_files $uri $uri/ /index.html; }` — SPA fallback. Um `server` por app,
  cada um com seu `root`: `/srv/adm`, `/srv/portal`, `/srv/ops`. O bloco de rota é idêntico
  nos três; fatorar num `include` parcial em vez de repetir.
- **`index.html` sem cache** (`Cache-Control: no-store`) nos três, com hash-cache longo só
  nos assets. Sem isso, deploy novo continua servindo bundle velho — e no `ops.fonte`, que é
  offline-first e guarda fila de mutations, bundle velho com backend novo é o cenário ruim.
- `client_max_body_size 10m` — casar com o limite de body da API (`main.ts:20-21`); menor que
  isso derruba upload com `413` antes de chegar no Node.
- `gzip` nos assets de texto; `server_tokens off`.

### 4. Ajustes em `services/api/src/main.ts`

- Trocar `!process.env.STORAGE_BUCKET_NAME` por uma flag explícita
  **`SERVE_STATIC_UPLOADS`** (default: ligado fora de produção). No compose de produção fica
  `false` — nginx serve. Mantém o dev local funcionando sem nginx.
- Ler `CORS_ORIGIN` (lista separada por vírgula) e passar para `enableCors({ origin })`.
  Sem a variável, comportamento atual (aberto) — para não quebrar dev nem os e2e.

### 5. `.env.example` e documentação

- Novas: `SERVE_STATIC_UPLOADS`, `POSTGRES_PASSWORD`.
- Anotar que `CORS_ORIGIN` **agora é lido** (hoje é decorativo).
- `README.md`: seção de deploy no VPS — build da imagem, `docker compose -f
  docker-compose.prod.yml up -d`, emissão do certificado, e o ponteiro para a story 188 para
  popular banco e `uploads/`.

---

## Segurança — decisão a registrar

Com o nginx servindo `/uploads` como estático puro, **qualquer pessoa com a URL baixa o
arquivo** — sem sessão, sem role, sem expiração. O acervo inclui fotos de residentes e
documentos assinados, que são dado pessoal sensível de saúde sob a LGPD.

A única barreira é o nome do arquivo, gerado por
`uniqueFilename()` (`storage.service.ts:81-84`) como
`${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`. `Math.random()` não é
criptográfico e o timestamp é adivinhável, então o espaço real de busca é bem menor do que
parece.

Isso **não é regressão** — hoje o `useStaticAssets` já expõe `/uploads` sem autenticação da
mesma forma, e no Railway as URLs do bucket também eram públicas. Mas a migração é o momento
de decidir conscientemente. Opções, em ordem de esforço:

1. **Manter estático** (escopo desta story) e trocar `uniqueFilename` por
   `randomUUID()`/`randomBytes` — ganho grande, custo quase zero, não muda nada de
   arquitetura.
2. `auth_request` do nginx contra um endpoint da API — protege de verdade, custa uma
   requisição por arquivo e um endpoint novo.
3. `X-Accel-Redirect`: a API autoriza e delega a entrega ao nginx — melhor dos dois, mas
   exige mexer em todo caminho que hoje devolve URL direta.

**Assumido para esta story: opção 1.** As opções 2 e 3 ficam fora de escopo e merecem story
própria; registrar no `docs/lgpd/ROADMAP_LGPD.md` como gap conhecido.

---

## Arquivos

**Criar:**
- `Dockerfile` (raiz, multi-stage)
- `.dockerignore` (raiz — `node_modules`, `dist`, `coverage`, `.env*`, `uploads`,
  `playwright-report`, `test-results`)
- `docker-compose.prod.yml`
- `docker/nginx/default.conf`
- `services/api/src/main.spec.ts` — cobre o parsing de `CORS_ORIGIN` e o gate de
  `SERVE_STATIC_UPLOADS` (extrair as duas decisões para funções puras testáveis em
  `src/common/`, já que `bootstrap()` não é testável direto).

**Editar:**
- `services/api/src/main.ts` — flag do estático + `CORS_ORIGIN`.
- `services/api/.env.example` — `SERVE_STATIC_UPLOADS`, `POSTGRES_PASSWORD`, nota do
  `CORS_ORIGIN`.
- `services/api/src/modules/storage/storage.service.ts` — `uniqueFilename` com
  `randomUUID()`.
- `services/api/src/modules/storage/storage.service.spec.ts` — ajustar o teste de
  `uniqueFilename`.
- `README.md` — seção de deploy no VPS.
- `docs/lgpd/ROADMAP_LGPD.md` — registrar o gap de `/uploads` sem autenticação.

**Não tocar:** `docker-compose.yml` (dev) continua como está — o de produção é arquivo
separado.

---

## Validação

**Testes obrigatórios:**

1. `pnpm test:api` — unit verdes, sem regressão. `uniqueFilename` mudou de formato: conferir
   que nenhum teste dependia do padrão `timestamp-random`.
2. `pnpm test:api:e2e` — o upload continua funcionando com o nome novo ponta a ponta.
3. `pnpm build:api` + `pnpm --filter adm.fonte build` + `pnpm --filter portal.fonte build` +
   `pnpm build:ops` — é exatamente o que o stage `build` roda; quebrar aqui quebra a imagem.
   O `expo export` do ops é o passo mais frágil da cadeia (é o que menos roda hoje):
   validar antes de escrever o Dockerfile.
4. Sem endpoint novo → **não** há mudança no Postman nem em `packages/types`/`api-client`.

**Casos a cobrir (unit):**
- `CORS_ORIGIN` com uma origem, com várias separadas por vírgula, com espaços em volta, e
  ausente (→ comportamento aberto atual, não pode quebrar dev/e2e).
- `SERVE_STATIC_UPLOADS` ausente em `NODE_ENV=production` → estático **desligado**;
  ausente em desenvolvimento → **ligado**; valor explícito vence o default nos dois sentidos.
- `uniqueFilename` preserva a extensão do original, gera valores distintos em chamadas
  consecutivas e respeita o `prefix` (usado em `resident.service.ts:769` para o thumbnail).

**Verificação manual (a que prova o deploy):**
1. `docker compose -f docker-compose.prod.yml build` conclui; `docker image ls` mostra a
   imagem da API com `pg_dump --version` reportando **16** de dentro do container.
2. `up -d` sobe os quatro serviços; `postgres` fica `healthy`; as migrations rodam no
   start da API (log do `migration:run`).
3. `GET /api/v1/...` responde através do nginx (não direto na 3000 — a API não publica porta).
   Os **três** hosts carregam e fazem login contra a API pelo domínio real (pega
   `VITE_API_URL`/`EXPO_PUBLIC_API_URL` embutido errado, que é o modo de falha mais provável).
   Deep link direto (ex.: `/residents/<id>` no adm, `/cancelar/<token>` no portal) resolve
   pelo fallback de SPA em vez de `404`.
4. Upload de foto de residente pelo adm → arquivo aparece no volume `uploads` e é servido
   por **nginx** em `/uploads/residents/<uuid>.jpg`. Conferir no header de resposta que quem
   serviu foi o nginx, não o Node.
5. `curl http://host/uploads/` retorna `403`/`404`, **não** listagem de diretório.
6. Upload de arquivo acima de 10 MB falha com erro tratado, não com `413` cru do nginx.
7. Requisição de origem não listada em `CORS_ORIGIN` é rejeitada no preflight — e as
   **três** origens dos frontends **estão** listadas (esquecer uma derruba o app inteiro
   em produção).

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente
> — nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` e **não reduzir** a cobertura
> dos módulos afetados (`storage`, `common`). Sem `skip`/`only`/`xfail` sem justificativa no
> código (CLAUDE.md).

---

## Fora de escopo

- **Provisionamento do VPS** (escolha de provider, SO, hardening de SSH, firewall).
- **Migração de DNS** e reconfiguração dos webhooks Pagar.me e Meta WhatsApp.
- **Popular banco e `uploads/`** — é a story 188.
- **Backup recorrente / destino offsite** — story 20; segue em aberto e o risco de disco único
  permanece registrado lá.
- **CI/CD** (build e push automático da imagem). Nesta story o build é manual no VPS ou local.
- Autenticação em `/uploads` pelas opções 2 e 3 (`auth_request`, `X-Accel-Redirect`) — story
  própria.
- **`app.fonte` inteiro.** Não é servido por URL no momento (decisão do usuário) — nem build
  web, nem `server` block, nem entrada em `CORS_ORIGIN`. Familiares seguem pelo app instalado.
- **Builds nativos** de `ops.fonte` (APK/EAS, lojas). Esta story serve só o build **web** do
  ops; a distribuição do APK continua como está hoje (`build:e2e:android`, EAS) e não passa
  pelo nginx.
- PWA / service worker para o `ops.fonte` web. O offline-first atual é a camada de
  persistência do react-query (`lib/offline/`), que funciona no browser sem service worker;
  cache de shell é assunto separado.
