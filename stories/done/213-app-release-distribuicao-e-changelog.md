# Plan: App `release.fonte` — distribuição do APK do ops e changelog, com skill de release

## Context

Hoje não existe um lugar oficial para baixar o APK do `ops.fonte` nem para saber o que mudou entre
versões. O APK é compilado à mão na máquina do operador (receita em memória de projeto), sai
**debug-signed** — chave diferente por máquina — e é repassado por fora. A versão do app está
cravada em `1.0.0` (`apps/ops.fonte/app.config.js` e `package.json`), não há `versionCode`
explícito e o repositório não tem nenhuma tag git.

O usuário quer um novo app, **`release.fonte`**, que centraliza **distribuição** e
**documentação** de releases:

- link de download do APK do `ops.fonte`;
- área **"Changelog"** com as mudanças entre releases;
- uma **skill** que gera a release de forma organizada (changelog + APK) para que o usuário só
  faça o `push` e a publicação aconteça automaticamente.

### Decisões travadas pelo usuário

1. **O APK publicado é compilado no CI, não na máquina.** A skill compila o APK localmente só
   como *smoke test* (garantir que o build passa antes de taguear). A publicação é do GitHub
   Actions (runner Linux — que também evita o problema de MAX_PATH/ninja do Windows). Motivo:
   APK de ~70 MB não cabe bem no git (sem LFS) e o repositório é privado, então GitHub Releases
   exigiria login para baixar. Push = publicação, sem upload manual.
2. **Keystore de release fixa.** Sem assinatura estável, atualizar o app exige desinstalar — e
   desinstalar apaga o SQLite local e a **fila offline** do `ops.fonte` (invariante
   offline-first, CLAUDE.md). A keystore fica **fora do git**: secret no GitHub Actions + backup
   guardado pelo usuário. Trade-off aceito: quem tem hoje o APK debug-signed precisa desinstalar
   **uma vez** para instalar a primeira versão assinada (avisar no changelog dessa release e
   sincronizar a fila antes).
3. **Site público, sem login, em pt-BR de usuário.** `release.fontedemisericordia.com.br`
   aberto. O changelog é escrito para quem **usa** a plataforma (coordenador, servo, adm) — o
   que mudou na prática —, agrupado por app. Commits puramente técnicos (refactor, test, chore,
   ci, docs de stories) ficam de fora. Nada de dado pessoal, nome de filho ou detalhe de
   infraestrutura no texto (é público).
4. **Release = versão da plataforma inteira.** Uma tag git `vX.Y.Z` cobre `adm`, `ops` (web +
   APK), `api` e `portal`. O changelog tem seções por app; o APK é um dos artefatos da release.
   A versão do `ops.fonte` (`version` no `app.config.js`) **é** a versão da plataforma.

## Desenho

### 1. Novo app `apps/release.fonte`

React + Vite estático, mesmos padrões de `adm.fonte`/`portal.fonte` (features/, componentes
pequenos, Tailwind/shadcn como o portal). **Sem backend e sem `@fonte/api-client`** — todo o
conteúdo vem do repositório em build-time.

- **Conteúdo:** `apps/release.fonte/content/releases/vX.Y.Z.md`, um arquivo por release, com
  frontmatter:
  ```yaml
  ---
  version: 1.1.0
  date: 2026-10-20
  summary: Uma linha com o destaque da versão.
  apk: true          # esta release publica APK novo do ops
  breaking: false    # ex.: primeira versão assinada exige desinstalar
  ---
  ## Ops (celular)
  - ...
  ## Administração
  - ...
  ## Portal
  - ...
  ```
  Carregado com `import.meta.glob('../content/releases/*.md', { query: '?raw', eager: true })`,
  parse de frontmatter + markdown em módulo puro e testável (`lib/releases.ts`), ordenado por
  semver decrescente. Frontmatter inválido **quebra o build** (não some em silêncio).
- **Rotas:**
  - `/` — versão atual, data, resumo, **botão "Baixar APK do Ops"** (`/downloads/ops.apk` +
    link versionado `/downloads/ops-<versão>.apk`), tamanho, passo a passo de instalação
    (permitir fontes desconhecidas, aviso de desinstalar quando `breaking: true`) e link para o
    changelog.
  - `/changelog` — lista de releases (versão, data, resumo).
  - `/changelog/:version` — detalhe renderizado. Versão inexistente → `EmptyState`/404 amigável.
- A versão do APK exibida vem de `/downloads/latest.json` (gerado junto com o APK no CI:
  `{ version, versionCode, sizeBytes, sha256, builtAt }`), **não** do markdown — assim a página
  nunca anuncia um APK que ainda não foi publicado. SHA-256 exibido para conferência.
- `vercel.json`/SPA fallback não se aplica: servido pelo nginx com o snippet
  `static-app.conf` existente.
- Scripts na raiz: `dev:release`, `build:release`, `test:release`, `test:release:e2e`, e entrada
  no `test:cov:all`.

### 2. Versionamento do `ops.fonte`

- `app.config.js` passa a ler a versão de **uma única fonte** (o `version` do
  `apps/ops.fonte/package.json`) e define `android.versionCode` derivado:
  `major * 10000 + minor * 100 + patch` (monotônico; minor/patch < 100). Função pura em módulo
  próprio, testada.
- Assinatura: `app.config.js`/config plugin aplica `signingConfigs.release` lendo
  `OPS_KEYSTORE_PATH`, `OPS_KEYSTORE_PASSWORD`, `OPS_KEY_ALIAS`, `OPS_KEY_PASSWORD` do ambiente.
  Sem essas variáveis, cai no debug-signing (build local de smoke continua funcionando).
  **Nunca editar `android/` à mão** — é CNG.
- Gerar a keystore (`keytool`), cadastrar como secrets base64 no GitHub, documentar no README o
  backup e o procedimento de rotação (perder a keystore = todo mundo reinstala).

### 3. Pipeline de publicação (CI)

O fluxo de `main` hoje: `coverage-gate` → `images` (`fonte-api`, `fonte-web`) → `deploy`. Entra:

- **Workflow `release.yml`, gatilho `push` de tag `v*`:**
  1. checa que a tag bate com `apps/ops.fonte/package.json` e que existe
     `content/releases/<tag>.md` — senão falha;
  2. builda o APK release assinado (Linux, `arm64-v8a`, `EXPO_PUBLIC_API_URL` de produção,
     `SENTRY_DISABLE_AUTO_UPLOAD=true` até haver org/token);
  3. publica uma imagem imutável **`ghcr.io/visb/fonte-apk:<versão>`** (FROM scratch/busybox)
     contendo `ops-<versão>.apk` e `latest.json`, e move a tag `fonte-apk:latest`;
  4. reconstrói `fonte-web` e chama `deploy.yml` (reuso via `workflow_call`).
- **Dockerfile, stage `web`:** passa a copiar o `dist` do `release.fonte` para `/srv/release` e
  o APK de `ghcr.io/visb/fonte-apk:latest` para `/srv/release/downloads/` (`ops.apk` +
  versionado + `latest.json`). Assim todo push na `main` mantém o último APK publicado, e o push
  da tag troca o APK. Primeiro bootstrap (sem nenhuma `fonte-apk` ainda): build tolera ausência
  e a home mostra "APK ainda não publicado".
- Build do APK no CI **não** roda em todo push na `main` (custo/tempo) — só na tag.

### 4. nginx + DNS

- Novo `server` para `release.fontedemisericordia.com.br` em `docker/nginx/default.conf`
  (`root /srv/release`, `static-app.conf`, **sem** `api-proxy.conf`), e o host na
  `bootstrap.conf` e no bloco da porta 80.
- `location /downloads/` com `types { application/vnd.android.package-archive apk; }`,
  `Content-Disposition: attachment` e cache curto para `ops.apk`/`latest.json` (longo para o
  versionado).
- Passo manual (README §Deploy): registro DNS **cinza** no Cloudflare e emissão do certificado
  via certbot, como os outros hosts.

### 5. Skill `fonte-release` (`/release`)

Skill em `.claude/skills/fonte-release/`, invocável pelo usuário. Respeita a disciplina de shell
do CLAUDE.md (arquivos via `Write`/`Edit`, commit via `git commit -F`).

Fluxo:
1. **Pré-checagem:** na `main`, árvore limpa, sincronizada com `origin/main`; `pnpm test:cov:all`
   verde (ou o usuário confirma pular, registrado).
2. **Coleta:** última tag `v*` (na primeira release, ponto de partida combinado com o usuário)
   → commits até `HEAD`. Classifica por `type(scope)` conforme `CONTRIBUTING.md` e mapeia scope
   → app. Usa as stories citadas (`story-NN`, `stories/done/NN-*.md`) para entender o *porquê* e
   escrever em linguagem de usuário.
3. **Versão sugerida:** `feat` → minor, só `fix` → patch, quebra (`!`/`BREAKING`) → major. Usuário
   confirma ou ajusta.
4. **Rascunho:** escreve `content/releases/vX.Y.Z.md` em pt-BR de usuário; mostra ao usuário e
   **itera até aprovação**. Itens técnicos ficam fora. Revisa ausência de dado pessoal.
5. **Bump:** `apps/ops.fonte/package.json` → nova versão (versionCode deriva sozinho).
6. **Smoke do APK local:** `pnpm build:types` + `pnpm build:api-client` + prebuild +
   `assembleRelease` (receita conhecida, debug-signed se não houver keystore local). Falhou →
   para e reporta, não tagueia.
7. **Commit + tag:** `chore(release): vX.Y.Z` (só os arquivos da release) e tag anotada
   `vX.Y.Z` com o resumo.
8. **Para.** Informa o comando: `git push origin main --follow-tags`. **Não faz push.**

O cálculo de versão sugerida e o mapeamento commit → seção ficam num script Node testável
(`scripts/release/` na raiz), que a skill chama; a redação final é do modelo com aprovação do
usuário.

## Validação

**Testes exigidos, por camada:**

- **`release.fonte` unit (Vitest + RTL)** — `pnpm test:release`:
  - `lib/releases.ts`: parse de frontmatter válido; frontmatter faltando `version`/`date` lança
    erro; ordenação semver (`1.10.0` > `1.9.0`); `breaking`/`apk` default `false`.
  - Home: mostra versão/tamanho/sha256 de `latest.json`; botão aponta para `/downloads/ops.apk`;
    `latest.json` ausente/404 → estado "APK ainda não publicado" (sem botão quebrado); aviso de
    desinstalar quando a release atual é `breaking`.
  - Changelog: lista na ordem certa; vazio → `EmptyState`.
  - Detalhe: renderiza seções; versão inexistente → estado de não encontrado.
- **`release.fonte` e2e (Playwright)** — `pnpm test:release:e2e`: home → changelog → detalhe →
  voltar; download aponta para o href certo (fixture de `latest.json` servida pelo próprio Vite).
- **Script de release (`scripts/release/`)** — unit (Vitest ou `node:test`):
  - bump sugerido: só `fix` → patch; algum `feat` → minor; `!`/`BREAKING CHANGE` → major;
  - commits `test|chore|ci|refactor|docs(stories)` excluídos; scope → app correto; scope
    desconhecido vai para "Geral";
  - tag ausente (primeira release) tratada.
- **`ops.fonte` unit (Jest)** — `pnpm test:ops:unit`: `versionCode(1.2.3) === 10203`; minor/patch
  ≥ 100 lança; config sem env de keystore não aplica assinatura release; com env, aplica.
- **Build/CI:**
  - `docker build --target web` local com e sem imagem `fonte-apk` disponível (bootstrap) — ambos
    passam; `/srv/release/index.html` presente.
  - `release.yml` exercitado com uma tag de teste (`v0.0.0-rc.1` num fork/branch, ou
    `workflow_dispatch` de ensaio) até gerar a imagem `fonte-apk`; `apksigner verify --print-certs`
    no APK gerado mostra o certificado da keystore de release (não o debug).
  - Tag que não bate com `package.json` → workflow falha no passo 1.
- **Manual (instrução no PR/story ao concluir):** instalar o APK baixado de
  `release.fontedemisericordia.com.br` num aparelho físico; instalar a release seguinte **por
  cima** e confirmar que login, dados locais e fila offline sobrevivem.
- **Skill:** ensaio completo em seco até o passo 7 numa branch descartável, confirmando que não
  há push, que o commit só contém os arquivos da release e que a tag é anotada.
- Nenhum endpoint de API muda → Postman intocado; `packages/types`/`api-client` intocados.

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
> nenhum código novo entra sem teste. `release.fonte` entra no `test:cov:all` com threshold de
> 90% (mesmo piso dos demais apps, catraca do CI); o script de release e o módulo de versão do
> `ops.fonte` cobertos; **não reduzir** a cobertura do `ops.fonte`. Sem `skip`/`only`/`xfail` sem
> justificativa no código (CLAUDE.md).

## Fora de escopo

- Aviso de atualização **dentro** do `ops.fonte` (checar `latest.json` e sugerir baixar) — story
  futura; este corte só publica.
- Publicação na Play Store / EAS Update / OTA.
- APK do `app.fonte` (familiares) — o desenho comporta outra imagem `fonte-*-apk` depois.
- Changelog dentro do `adm.fonte`.
- Sentry no `release.fonte` e upload de source maps do APK (segue `SENTRY_DISABLE_AUTO_UPLOAD`).
- Retenção/histórico de APKs antigos para download (só o último fica servido; as imagens
  `fonte-apk:<versão>` no GHCR servem de histórico).
- Gerar a release automaticamente sem o usuário (CI não escreve changelog).
