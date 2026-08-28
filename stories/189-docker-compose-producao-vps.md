# Plan: Dockerfile multi-stage + compose de produção no VPS (nginx + MinIO)

## Context

A plataforma sai do Railway para um VPS único. Hoje **não existe nenhum artefato de deploy no
repositório** — o Railway monta a imagem por nixpacks a partir da configuração do painel, então
nada disso está versionado. Sem Dockerfile e sem compose, não há como subir a stack no VPS nem
reproduzir o ambiente.

**Decisões do usuário:**
- **Um VPS, tudo em Docker Compose:** api + postgres + minio + nginx. **Sem Redis** — a
  dependência sai do código na story 190, e o compose de produção já nasce sem ela.
- **Storage é MinIO auto-hospedado**, não arquivos soltos em disco. Mantém o `StorageService`
  em modo S3 e, com ele, a camada de URL assinada que já existe: o `StorageUrlInterceptor`
  assina recursivamente toda URL de toda resposta (`storage-url.interceptor.ts:15-21`) e é
  **gated em `isS3Mode()`**. Servir os arquivos como estático desligaria esse interceptor e
  deixaria prontuário e documento assinado acessíveis sem autenticação e sem expiração.
- **nginx é a porta de entrada única:** termina TLS, roteia `/api/v1` para a API, faz proxy do
  host de storage para o MinIO e serve os estáticos dos **dois** frontends web do primeiro
  corte. Nenhum outro serviço publica porta.
- **Dois frontends, ambos estáticos.** `adm.fonte` sai do Vite; `ops.fonte` sai do
  `expo export --platform web` (`build:web`), que também produz um `dist/` estático — o
  `start:web` dele é literalmente `npx serve dist`. Nenhum dos dois precisa de processo Node
  em runtime, então **nenhum vira serviço no compose**: são roots de `server` no nginx.
- **`portal.fonte` e `app.fonte` ficam de fora** (decisão do usuário). O portal não tem
  domínio definido nem tráfego vivo: a cobrança de associados ainda não foi para produção —
  a story 42 rastreia a ativação (credenciais Pagar.me e template Meta, checklist todo em
  aberto). Familiares seguem pelo `app.fonte` instalado. Os dois têm build pronto, então
  entrar depois é um `COPY`, um `server` block e uma entrada em `CORS_ORIGIN`.

Depende da story 188 (snapshot de migração) para popular o bucket do MinIO e o banco. Esta
story entrega o *ambiente*; a 188 entrega o *conteúdo*. A 189 precisa entrar **antes** — o
`backup:import` da 188 exige o MinIO de pé e o bucket criado.

Depende também da story 190 (remoção do Redis). Se a 190 não tiver entrado, o compose sobe
mesmo assim — o `CacheService` já degrada sem `REDIS_URL` — mas cada request de casa loga
aviso de conexão. Ordem preferida: **190 antes da 189**.

### Correções que entram junto (o deploy sai quebrado sem elas)

1. **`main.ts:34` testa a variável errada.** `if (!process.env.STORAGE_BUCKET_NAME)` — essa
   variável não existe em lugar nenhum; o resto do código lê `AWS_S3_BUCKET_NAME`
   (`storage.service.ts:42`). Resultado: o `useStaticAssets` **sempre** registra, inclusive em
   modo S3 — hoje o Node expõe `/uploads` sem autenticação mesmo quando os arquivos estão no
   bucket. Corrigir para a variável certa: com MinIO em produção o ramo não registra, e o
   fallback local continua valendo em dev.
2. **CORS aberto.** `main.ts:22` chama `app.enableCors()` sem argumento — libera qualquer
   origem. `CORS_ORIGIN` está documentado no `.env.example:7` mas **nunca é lido** (nenhuma
   ocorrência no código). Atrás do Railway passava; num VPS público exposto, não.

---

## Premissas a confirmar antes de implementar

Não bloqueiam a escrita da story, mas mudam o `nginx.conf`:

- **Domínios: um `server_name` por app, em subdomínio** (confirmado pelo usuário), não os
  dois sob paths do mesmo host. Path-based exigiria `base` no Vite (adm) e
  `experiments.baseUrl` no Expo (ops), mais invasivo e fácil de quebrar no fallback de SPA.
  - `adm.fontedemisericordia.com.br` — confirmado.
  - **Um subdomínio a mais que os apps:** o storage precisa do próprio
    (ex.: `storage.fontedemisericordia.com.br`), porque a assinatura do presign cobre o host.
    Esse valor vira `AWS_ENDPOINT_URL` e fica **gravado nas URLs do banco** — trocá-lo depois
    exige rodar de novo o rebase da story 188. Escolher com cuidado antes do corte.
  - `ops.fontedemisericordia.com.br` — confirmado, e **já em produção**: é o endereço que
    `docs/comunicacao/whatsapp-coordenadores-nova-plataforma.md:25` manda os coordenadores
    abrirem. O corte para o VPS tem de preservar esse host funcionando.
  - Portal: **sem domínio por enquanto** — não precisa neste corte. Quando entrar, o nome
    escolhido (`portal.` ou `associados.`) vai em `APP_ASSOCIADOS_URL`, que é o que aparece
    nos links de cobrança do WhatsApp. Deixar o `server` block preparado mas não ativado.
- **Domínio de e-mail diverge do domínio web.** `mail.service.ts:36` envia como
  `nao-responda@fontedemisericordia.org` (`.org`), enquanto os apps ficam em
  `.com.br`. Não bloqueia a migração — o envio não passa pelo VPS — mas conferir que o
  `.org` continua com SPF/DKIM válidos, já que os links dentro do e-mail passam a apontar
  para o `.com.br`.
- **TLS:** assumido `certbot` em container companion com renovação por cron e webroot
  compartilhado, em vez de Caddy (o usuário pediu nginx explicitamente).
- **URL da API é build-time nos dois.** Vite embute `VITE_API_URL` e Expo embute
  `EXPO_PUBLIC_API_URL` no bundle. Trocar de domínio exige **rebuild da imagem**, não
  restart. Mesmo vale para `APP_ASSOCIADOS_URL` e `CORS_ORIGIN` no lado da API.

---

## Desenho

### 1. `Dockerfile` (raiz do monorepo, multi-stage)

O build precisa do workspace inteiro: a `api` depende de `@fonte/types` e `@fonte/doc-styles`;
os frontends dependem de `@fonte/types` e `@fonte/api-client` (adm também de
`doc-styles`). Build de app isolado não funciona.

- **`base`** — `node:22-alpine`, `corepack enable` fixando `pnpm@11.3.0` (o
  `packageManager` do `package.json` raiz).
- **`deps`** — copia `pnpm-lock.yaml`, `pnpm-workspace.yaml` e todos os `package.json` do
  workspace; `pnpm install --frozen-lockfile`. Camada separada para o cache não invalidar a
  cada mudança de código.
- **`build`** — copia o código e roda, nesta ordem: `pnpm build:types`,
  `pnpm build:doc-styles`, `pnpm build:api-client`, `pnpm build:api`,
  `pnpm --filter adm.fonte build`, `pnpm build:ops`. O último é o script de raiz que já
  existe e chama o `expo export --platform web`.
  **Não** buildar `portal.fonte` nem `app.fonte` — fora de escopo deste corte.
  Os dois frontends recebem sua URL de API por env de build (`VITE_API_URL` /
  `EXPO_PUBLIC_API_URL`) — declarar como `ARG` no stage e passar no `build`.
- **`api`** (runtime final da API) — `node:22-alpine` +
  **`apk add postgresql16-client`** (pré-requisito bloqueante das stories 20 e 188: o
  `BackupService` faz `spawn` de `pg_dump`/`pg_restore` v16, `backup.service.ts:297,328`).
  Copia `services/api/dist`, os `dist` dos packages compartilhados e as deps de produção.
  `CMD` = `pnpm --filter api start` — que já roda
  `typeorm migration:run` antes do `node dist/main` (`services/api/package.json:12`).
  `WORKDIR` em `services/api` (o fallback local do `StorageService` resolve
  `process.cwd()/uploads`, `storage.service.ts:104` — inerte em produção com MinIO, mas o
  `WORKDIR` também é o que faz os scripts `pnpm --filter api ...` da 188 rodarem no lugar
  certo).
- **`web`** (runtime do nginx) — `nginx:alpine` + `COPY --from=build` dos **dois** `dist/`
  para `/srv/adm` e `/srv/ops`, mais o `default.conf`.
  Origens: `apps/adm.fonte/dist`, `apps/ops.fonte/dist`.

### 2. `docker-compose.prod.yml` (raiz)

Quatro serviços; só o nginx publica porta no host (80/443).

- **`postgres`** — `postgres:16-alpine`, volume nomeado `postgres_data`, `TZ/PGTZ=UTC`
  (espelha o `docker-compose.yml` de dev), healthcheck `pg_isready`. **Sem** `ports:` — só a
  rede interna. `POSTGRES_PASSWORD` vem do `.env` do host, nunca hardcoded.
- **`minio`** — `minio/minio`, volume nomeado `minio_data`, healthcheck em `/minio/health/ready`.
  **Sem** `ports:`: nem a API (`:9000`) nem o console (`:9001`) são publicados direto — tudo
  passa pelo nginx, e o console **não** é exposto na internet. Credenciais
  (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`) vêm do `.env` do host.
- **`api`** — imagem stage `api`, `env_file`, `depends_on` com `condition: service_healthy`
  (postgres e minio), `restart: unless-stopped`. **Sem volume de arquivos** — o acervo vive no
  MinIO.
- **`nginx`** — imagem stage `web`, publica 80/443, monta os certificados.

Volumes nomeados: `postgres_data`, `minio_data`, `certbot_conf`, `certbot_www`.

> **O bucket do MinIO é privado.** Nada de policy anônima de leitura: o acesso é pelas URLs
> assinadas que o `StorageUrlInterceptor` já emite. Bucket público jogaria fora exatamente o
> controle que motivou escolher MinIO.

### 3. `docker/nginx/default.conf`

Rotas, na ordem de precedência:

- `location /api/v1/ { proxy_pass http://api:3000; }` — casa com o
  `setGlobalPrefix("api/v1")` (`main.ts:25`). Repassa `Host`, `X-Real-IP`,
  `X-Forwarded-For`, `X-Forwarded-Proto`.
- **`server` próprio para o storage** (ex.: `storage.fontedemisericordia.com.br`) fazendo
  `proxy_pass http://minio:9000`. Precisa ser host dedicado, não um path: a assinatura do
  presign **cobre o host**, então a URL que o cliente recebe tem de bater exatamente com o
  endpoint que assinou. Repassar `Host` e usar `proxy_request_buffering off` para upload
  grande.
  - `AWS_ENDPOINT_URL` da API = essa URL pública, **não** `http://minio:9000`. O tráfego
    interno de `PutObject` sai e volta pelo nginx no mesmo host — custo desprezível, e é o que
    mantém presign e upload consistentes com um único endpoint.
  - O console do MinIO (`:9001`) **não** ganha `server` block. Administração via `mc` no host.
- `location / { try_files $uri $uri/ /index.html; }` — SPA fallback. Um `server` por app,
  cada um com seu `root`: `/srv/adm`, `/srv/ops`. O bloco de rota é idêntico nos dois;
  fatorar num `include` parcial em vez de repetir — é o que faz o portal entrar depois sem
  reescrever nada.
- **`index.html` sem cache** (`Cache-Control: no-store`) nos dois, com hash-cache longo só
  nos assets. Sem isso, deploy novo continua servindo bundle velho — e no `ops.fonte`, que é
  offline-first e guarda fila de mutations, bundle velho com backend novo é o cenário ruim.
- `client_max_body_size 10m` — casar com o limite de body da API (`main.ts:20-21`); menor que
  isso derruba upload com `413` antes de chegar no Node.
- `gzip` nos assets de texto; `server_tokens off`.

### 4. Ajustes em `services/api/src/main.ts`

- Corrigir `!process.env.STORAGE_BUCKET_NAME` → `!process.env.AWS_S3_BUCKET_NAME`. Sem flag
  nova: com MinIO configurado o ramo não registra, e o dev local sem bucket continua servindo
  `/uploads` como hoje.
- Ler `CORS_ORIGIN` (lista separada por vírgula) e passar para `enableCors({ origin })`.
  Sem a variável, comportamento atual (aberto) — para não quebrar dev nem os e2e.

### 5. `.env.example` e documentação

- Novas: `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.
- Anotar que `CORS_ORIGIN` **agora é lido** (hoje é decorativo).
- Ajustar o comentário do bloco de storage: hoje diz "Railway Object Storage"
  (`.env.example:15`); passa a ser MinIO auto-hospedado, com `AWS_ENDPOINT_URL` = a URL
  **pública** do storage.
- `README.md`: seção de deploy no VPS — build da imagem, `docker compose -f
  docker-compose.prod.yml up -d`, emissão do certificado, criação do bucket no MinIO, e o
  ponteiro para a story 188 para popular banco e bucket.

---

## Segurança — o que sustenta o controle de acesso

O acervo é foto de residente e documento assinado: dado pessoal sensível de saúde sob a LGPD.
Manter o `StorageService` em modo S3 preserva o controle que já existe — o
`StorageUrlInterceptor` assina toda URL de toda resposta, com expiração
(`storage.service.ts:119-137`). Quem não passou pelo guard da rota não recebe URL válida.

Três coisas precisam estar certas para isso valer, e todas são config desta story:

1. **Bucket privado.** Sem policy anônima de leitura. Bucket público anula o presign inteiro:
   a URL canônica passa a servir o arquivo direto, sem assinatura.
2. **Endpoint público = endpoint que assina.** `AWS_ENDPOINT_URL` tem de ser a URL que o
   navegador acessa. Assinar com `http://minio:9000` e entregar outro host produz assinatura
   inválida — o sintoma é `SignatureDoesNotMatch` em toda imagem.
3. **Console do MinIO fora da internet.** Sem `server` block para `:9001`.

**Endurecimento pequeno que entra junto:** trocar `uniqueFilename()`
(`storage.service.ts:81-84`) de `${Date.now()}-${Math.round(Math.random() * 1e9)}` para
`randomUUID()`. `Math.random()` não é criptográfico e o timestamp é adivinhável. Com presign
o nome não é mais a barreira principal — isso é defesa em profundidade para o caso de o item 1
ser afrouxado algum dia. Custo: duas linhas e um teste.

> **Fica em aberto:** o `signUrl` usa `expiresIn` fixo e o `StorageUrlInterceptor` assina
> **tudo** que passa, sem olhar o papel de quem pediu. A autorização é a da rota que devolveu
> o payload, não do objeto. É o modelo atual, herdado do Railway, e esta story não o muda —
> registrar no `docs/lgpd/ROADMAP_LGPD.md` como gap conhecido.

---

## Arquivos

**Criar:**
- `Dockerfile` (raiz, multi-stage)
- `.dockerignore` (raiz — `node_modules`, `dist`, `coverage`, `.env*`, `uploads`,
  `playwright-report`, `test-results`)
- `docker-compose.prod.yml`
- `docker/nginx/default.conf`
- `services/api/src/common/cors-origin.ts` + spec — parsing de `CORS_ORIGIN` extraído como
  função pura (`bootstrap()` não é testável direto).

**Editar:**
- `services/api/src/main.ts` — corrigir a variável do gate estático + `CORS_ORIGIN`.
- `services/api/.env.example` — `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`,
  `MINIO_ROOT_PASSWORD`, nota do `CORS_ORIGIN`, comentário do storage (Railway → MinIO).
- `services/api/src/modules/storage/storage.service.ts` — `uniqueFilename` com
  `randomUUID()`.
- `services/api/src/modules/storage/storage.service.spec.ts` — ajustar o teste de
  `uniqueFilename`.
- `README.md` — seção de deploy no VPS.
- `docs/lgpd/ROADMAP_LGPD.md` — registrar o gap de granularidade do presign (o interceptor
  assina tudo que passa, sem olhar papel).

**Não tocar:** `docker-compose.yml` (dev) continua como está — o de produção é arquivo
separado.

---

## Validação

**Testes obrigatórios:**

1. `pnpm test:api` — unit verdes, sem regressão. `uniqueFilename` mudou de formato: conferir
   que nenhum teste dependia do padrão `timestamp-random`.
2. `pnpm test:api:e2e` — o upload continua funcionando com o nome novo ponta a ponta.
3. `pnpm build:api` + `pnpm --filter adm.fonte build` + `pnpm build:ops` — é exatamente o
   que o stage `build` roda; quebrar aqui quebra a imagem. O `expo export` do ops é o passo
   mais frágil da cadeia (é o que menos roda hoje): validar antes de escrever o Dockerfile.
4. Sem endpoint novo → **não** há mudança no Postman nem em `packages/types`/`api-client`.

**Casos a cobrir (unit):**
- `CORS_ORIGIN` com uma origem, com várias separadas por vírgula, com espaços em volta, e
  ausente (→ comportamento aberto atual, não pode quebrar dev/e2e).
- `uniqueFilename` preserva a extensão do original, gera valores distintos em chamadas
  consecutivas e respeita o `prefix` (usado em `resident.service.ts:769` para o thumbnail).

**Verificação manual (a que prova o deploy):**
1. `docker compose -f docker-compose.prod.yml build` conclui; `docker image ls` mostra a
   imagem da API com `pg_dump --version` reportando **16** de dentro do container.
2. `up -d` sobe os quatro serviços; `postgres` e `minio` ficam `healthy`; as migrations rodam
   no start da API (log do `migration:run`). Nenhum log de tentativa de conexão a Redis.
3. `GET /api/v1/...` responde através do nginx (não direto na 3000 — a API não publica porta).
   Os **dois** hosts carregam e fazem login contra a API pelo domínio real (pega
   `VITE_API_URL`/`EXPO_PUBLIC_API_URL` embutido errado, que é o modo de falha mais provável).
   Deep link direto (ex.: `/residents/<id>` no adm) resolve pelo fallback de SPA em vez de
   `404`.
4. Upload de foto de residente pelo adm → objeto aparece no bucket do MinIO, e a URL que a
   API devolve vem **assinada** (contém `X-Amz-Signature`). A imagem carrega no navegador.
5. Pegar a URL **canônica** (sem a query de assinatura) e acessá-la direto → **negado**. É o
   teste que prova que o bucket está privado; se servir o arquivo, a policy está errada e todo
   o modelo de acesso caiu.
6. Esperar a assinatura expirar e reabrir a URL → negado.
7. `curl https://<host-do-storage>/` não expõe listagem de buckets, e o console (`:9001`) não
   responde de fora.
8. Upload de arquivo acima de 10 MB falha com erro tratado, não com `413` cru do nginx.
9. Requisição de origem não listada em `CORS_ORIGIN` é rejeitada no preflight — e as
   **duas** origens (`adm.` e `ops.`) **estão** listadas (esquecer uma derruba o app inteiro
   em produção).

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente
> — nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` e **não reduzir** a cobertura
> dos módulos afetados (`storage`, `common`). Sem `skip`/`only`/`xfail` sem justificativa no
> código (CLAUDE.md).

---

## Fora de escopo

- **Provisionamento do VPS** (escolha de provider, SO, hardening de SSH, firewall).
- **Migração de DNS** e reconfiguração dos webhooks Pagar.me e Meta WhatsApp.
- **Popular banco e bucket** — é a story 188.
- **Backup recorrente / destino offsite** — story 20; segue em aberto. MinIO no mesmo VPS
  **não** é backup: os bytes ficam no mesmo disco do Postgres.
- **CI/CD** (build e push automático da imagem). Nesta story o build é manual no VPS ou local.
- **Granularidade do presign** — assinar por papel/objeto em vez de assinar tudo que passa
  pelo interceptor. Story própria; fica registrado no roadmap LGPD.
- **`portal.fonte` e `app.fonte`.** Não são servidos por URL neste corte (decisão do
  usuário) — nem build, nem `server` block, nem entrada em `CORS_ORIGIN`. O portal volta
  quando a cobrança de associados for ativada (story 42) e o subdomínio for escolhido;
  familiares seguem pelo `app.fonte` instalado.
- **Builds nativos** de `ops.fonte` (APK/EAS, lojas). Esta story serve só o build **web** do
  ops; a distribuição do APK continua como está hoje (`build:e2e:android`, EAS) e não passa
  pelo nginx.
- PWA / service worker para o `ops.fonte` web. O offline-first atual é a camada de
  persistência do react-query (`lib/offline/`), que funciona no browser sem service worker;
  cache de shell é assunto separado.
