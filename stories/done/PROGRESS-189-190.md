# PROGRESS — rodada autorun 189–190 (encerrada)

Rodada de autorun **189–190** — aberta e encerrada em 2026-08-29.

## Config da rodada

- **Tema:** infraestrutura de produção do VPS — remover a dependência de Redis e entregar o
  Dockerfile multi-stage + compose (api/postgres/minio/nginx/certbot) com MinIO auto-hospedado.
- **Ordem:** **190 → 189** (invertida em relação ao número, de propósito).
- **Branch base:** `main` em `ea2e6c7`, já com o merge da story 188.
- **Deps rígidas:** 190 antes de 189 (entregar o compose com o Redis ainda no código faria cada
  request de casa logar aviso de conexão). Ambas dependiam da 188, mergeada em `7c3eeb8`.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 190 — remover a dependência de Redis | [OK] | 132 suítes / 1655 unit + 582 e2e | `6caa0fb` | `fb60519` |
| 2 | 189 — Dockerfile multi-stage + compose no VPS (nginx + MinIO) | [OK] | 133 suítes / 1670 unit + 582 e2e | `ab7718a` | `8506a1f` |

## Log

```
[OK] 190 — testes: 132 suítes / 1655 unit (baseline 133/1650; -1 suíte = cache.service.spec
     apagada), 582 e2e, build limpo, cobertura global e por módulo subiu — commit: 6caa0fb —
     merge: fb60519 — 2026-08-29 — EventEmitterModule mantido (alimenta o NotificationGateway).

[OK] 189 — testes: 133 suítes / 1670 unit (+1 suíte cors-origin, +6 de uniqueFilename), 582
     e2e, build:api + adm build + build:ops verdes, compose de produção válido — commit:
     ab7718a — merge: 8506a1f — 2026-08-29 — verificação de VPS/DNS/TLS PENDENTE-MANUAL.
```

## Resumo final

**As duas stories fecharam [OK].** Nenhum bloqueio.

### Gates (reproduzir)

```
pnpm test:api                     # 133 suítes / 1670 testes
pnpm test:api:e2e                 # 36 suítes / 582 testes
pnpm build:api
pnpm --filter adm.fonte build
pnpm build:ops
pnpm test:api:cov                 # global 92.79 stmts / 80.11 br / 90.74 fn / 94.54 lines
docker compose -f docker-compose.prod.yml config
```

Cobertura não regrediu em nenhum módulo tocado. Na 190, `house.service.ts` foi de 87,03 para
95,00 e `staff.service.ts` de 89,05 para 96,89 — remover o cache tirou linhas cobertas do
numerador, e o agent compensou com testes das operações que estavam descobertas.

### Branches (preservadas, sem push)

- `feat/story-190-remover-redis`
- `feat/story-189-docker-compose-vps`

### O que a rodada descobriu e que não estava nos planos

Três armadilhas que só apareceram ao construir a imagem de verdade, todas corrigidas e
comentadas no código:

1. **`vips-dev` quebrava o build.** Com libvips no sistema, o install do `sharp` tenta compilar
   via node-gyp e falha. Removido, com `SHARP_IGNORE_GLOBAL_LIBVIPS=1` como trava.
2. **PGDATA mudou de lugar no Postgres 18** (`/var/lib/postgresql/18/docker`, com
   `VOLUME /var/lib/postgresql`). Montar em `/var/lib/postgresql/data` — como faz o compose de
   dev, que é 16 — deixaria os dados **fora** do volume: sumiriam no primeiro `down`.
3. **A home escapava do `no-store`.** Em `try_files`, `/` resolve por `$uri/index.html` dentro do
   próprio `location /`, então o bloco `~* \.html$` nunca rodava e a home voltava cacheável.

Também entraram, além do plano: chromium no stage `api` (o `document-template.service.ts` faz
`import('puppeteer')` para gerar PDF), `node_modules` com devDeps no runtime (o `start` roda
`typeorm-ts-node-commonjs`, que carrega `ts-node/register`), `location /socket.io/` (o
`NotificationGateway` faz handshake fora do prefixo `/api/v1`), `proxy_pass` por variável com
`resolver 127.0.0.11` (host literal impede o nginx de subir se o container `api` não existe, e
quebraria o reload da renovação), e `client_max_body_size 0` no host `static.` (10m ali
quebraria o upload do dump do backup).

### PENDENTE-MANUAL — exige VPS/DNS/TLS/MinIO real

Corresponde à seção "Verificação manual" da story 189. Nada disso é verificável sem o ambiente:

1. `up -d` com os cinco serviços, `postgres` e `minio` `healthy`, migrations no start da API, e
   **ausência** de log de conexão a Redis.
2. Os dois hosts (`adm.`, `ops.`) carregando e fazendo login pelo domínio real.
3. Upload de foto → objeto no bucket e URL devolvida **com `X-Amz-Signature`**.
4. **URL canônica (sem assinatura) → negada.** É o teste que prova o bucket privado; se servir o
   arquivo, o modelo de acesso inteiro caiu.
5. Assinatura expirada → negada.
6. `static.` sem listagem de buckets; console `:9001` inacessível de fora.
7. Preflight de origem não listada rejeitado, com as duas origens presentes em `CORS_ORIGIN`.
8. Emissão dos três certificados, `certbot renew --dry-run`, e validade em `openssl s_client`
   **após** renew + reload.
9. Criação do bucket no MinIO (`mc mb` + `mc anonymous set none`).
10. Upload acima de 10 MB pela UI: confirmar erro **tratado**, não o 413 cru.
11. `pg_dump`/`pg_restore` v18 na imagem construída **no VPS** — o `backup:import` da story 188
    depende disso.

### Divergências mantidas de propósito

- `docker-compose.yml` de **dev segue em Postgres 16**, produção vai em **18**. Alinhar mexeria
  nas suítes e2e de todos. Registrado no README §9.6, no `.env.example` e na story 189.
- `portal.fonte` e `app.fonte` **fora do corte**: sem build, sem server block, sem entrada em
  `CORS_ORIGIN`.
- **Risco de disco único em aberto:** MinIO no mesmo VPS do Postgres não é backup. Segue
  endereçado pela story 20.

### Próximo passo da migração

Com a 189 mergeada, o caminho está livre para provisionar o VPS e rodar a story 188 contra o
ambiente real: `backup:import` do zip capturado e depois `storage:rebase-urls --from <base-antiga>`.
