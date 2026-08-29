# Imagem única, multi-stage, para o deploy no VPS (story 189).
#
#   base  → node + pnpm
#   deps  → install do workspace inteiro (camada cacheável)
#   build → dist da API, dos packages compartilhados e dos dois frontends web
#   api   → runtime da API (alvo do serviço `api` do docker-compose.prod.yml)
#   web   → nginx servindo adm + ops e fazendo proxy da API e do MinIO
#
# Build:
#   docker build --target api -t fonte-api .
#   docker build --target web -t fonte-web \
#     --build-arg VITE_API_URL=https://adm.fontedemisericordia.com.br/api/v1 \
#     --build-arg EXPO_PUBLIC_API_URL=https://ops.fontedemisericordia.com.br/api/v1 .
#
# O build precisa do workspace INTEIRO: a api depende de @fonte/types e
# @fonte/doc-styles; os frontends dependem de @fonte/types e @fonte/api-client.
# Build de app isolado não funciona.

# Alpine 3.23 não é capricho: é a primeira release com `postgresql18-client` no
# repositório, e o dump de produção é do Postgres 18 (archive custom-format novo
# não é lido por pg_restore mais antigo). Trocar a base por uma Alpine <3.23
# quebra `backup:import`/`backup:restore` (stories 20 e 188).
ARG NODE_IMAGE=node:22-alpine3.23

# ── base ──────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    # O Chromium do puppeteer é o do Alpine (o binário baixado pelo postinstall
    # é glibc e não roda em musl). Vale para o install e para o runtime.
    PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────────────
# Camada separada só com os manifestos: mudança de código não invalida o install.
FROM base AS deps
# bcrypt e sharp são nativos: resolvidos aqui dentro, contra o musl do
# container. Nunca reaproveitar node_modules do host (ver .dockerignore).
# Os dois têm binário pré-compilado para linuxmusl-x64 no lockfile; o toolchain
# abaixo é só rede de segurança para quem não tiver.
#
# NÃO instalar `vips-dev` aqui: com libvips no sistema o install do sharp entra
# no caminho "build from source via node-gyp", ignora o binário pré-compilado e
# falha com "Please add node-gyp to your dependencies". A env abaixo trava esse
# caminho mesmo que algum pacote traga libvips junto.
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
RUN apk add --no-cache python3 make g++ libc6-compat
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY services/api/package.json services/api/
COPY packages/types/package.json packages/types/
COPY packages/doc-styles/package.json packages/doc-styles/
COPY packages/api-client/package.json packages/api-client/
COPY apps/adm.fonte/package.json apps/adm.fonte/
COPY apps/ops.fonte/package.json apps/ops.fonte/
COPY apps/app.fonte/package.json apps/app.fonte/
COPY apps/portal.fonte/package.json apps/portal.fonte/
# `--frozen-lockfile` exige o manifesto de TODOS os workspaces do
# pnpm-workspace.yaml, inclusive app.fonte/portal.fonte — que não são buildados
# neste corte, mas sem eles o install falha.
RUN pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
# URL da API é BUILD-TIME nos dois frontends (Vite e Expo embutem no bundle).
# Trocar de domínio exige rebuild da imagem, não restart.
ARG VITE_API_URL
ARG EXPO_PUBLIC_API_URL
ENV VITE_API_URL=${VITE_API_URL} \
    EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL} \
    NODE_ENV=production
COPY . .
RUN pnpm build:types
RUN pnpm build:doc-styles
RUN pnpm build:api-client
RUN pnpm build:api
RUN pnpm --filter adm.fonte build
# `build:ops` = expo export --platform web (output: 'static').
RUN pnpm build:ops
# portal.fonte e app.fonte ficam FORA deste corte (decisão da story 189).

# ── api ───────────────────────────────────────────────────────────────────────
FROM base AS api
# Liga o pacote no GHCR a este repositório: com o label, um push novo faz o
# GitHub vincular os dois sozinho, e o GITHUB_TOKEN do Actions passa a ter
# permissão sem concessão manual em Package settings. Também faz a página do
# pacote apontar de volta para o código.
LABEL org.opencontainers.image.source=https://github.com/visb/fonte
# postgresql18-client: o BackupService faz spawn de pg_dump/pg_restore.
# chromium + fontes: geração de PDF via puppeteer (document-template).
# tini: PID 1 decente, para o container morrer limpo.
RUN apk add --no-cache \
      postgresql18-client \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ttf-freefont \
      tini
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# O install deste repo é HOISTED (`nodeLinker: hoisted`): as dependências vivem
# no node_modules da RAIZ, e services/api/node_modules guarda só o punhado de
# pacotes com conflito de versão + os symlinks de @fonte/*. Levar apenas o
# node_modules de services/api quebra a imagem em RUNTIME, não no build.
#
# Vai o node_modules completo (com devDependencies) de propósito: o script
# `start` roda `typeorm-ts-node-commonjs migration:run` antes do `node dist/main`
# e o bin do typeorm carrega `ts-node/register`, que é devDependency. Podar para
# produção derrubaria a migration no boot.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./

# pnpm 11 verifica as dependências antes de rodar um script e, se achar
# divergência, instala sozinho. Com NODE_ENV=production esse install PODA as
# devDependencies — exatamente o que o bloco acima faz questão de manter (o
# `start` precisa do ts-node do typeorm). Observado no primeiro deploy: o boot
# removeu 1265 pacotes e ainda exigiu rede para o registry npm só para subir.
# A imagem já traz o node_modules correto; não há o que verificar.
RUN printf 'verify-deps-before-run=false\n' > /app/.npmrc

COPY --from=build /app/packages/types/package.json ./packages/types/
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/doc-styles/package.json ./packages/doc-styles/
COPY --from=build /app/packages/doc-styles/dist ./packages/doc-styles/dist

COPY --from=build /app/services/api/package.json ./services/api/
COPY --from=build /app/services/api/node_modules ./services/api/node_modules
COPY --from=build /app/services/api/dist ./services/api/dist

# WORKDIR em services/api: é onde os scripts `pnpm --filter api ...` da story 188
# (backup:import, storage:rebase-urls) esperam rodar, e é a raiz do fallback
# local do StorageService (`process.cwd()/uploads`, inerte com MinIO).
WORKDIR /app/services/api
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
# `start` roda migration:run e só então sobe o node dist/main.
CMD ["pnpm", "--filter", "api", "start"]

# ── web ───────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS web
LABEL org.opencontainers.image.source=https://github.com/visb/fonte
# Os dois frontends são estáticos: nenhum precisa de processo Node em runtime,
# então nenhum vira serviço no compose — são roots de `server` no nginx.
COPY --from=build /app/apps/adm.fonte/dist /srv/adm
COPY --from=build /app/apps/ops.fonte/dist /srv/ops
COPY docker/nginx/snippets/ /etc/nginx/snippets/
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
