# PROGRESS — ledger ativo

Rodada de autorun **189–190** — aberta em 2026-08-29.

## Config da rodada

- **Tema:** infraestrutura de produção do VPS — remover a dependência de Redis e entregar o
  Dockerfile multi-stage + compose (api/postgres/minio/nginx/certbot) com MinIO auto-hospedado.
- **Ordem:** **190 → 189** (invertida em relação ao número, de propósito — ver deps).
- **Branch base:** `main` (em `7c3eeb8`, já com o merge da story 188).
- **Deps rígidas:**
  - **190 antes de 189.** A 189 declara o compose de produção; se o Redis ainda existir no
    código, o compose sobe sem o serviço e cada request de casa loga aviso de conexão. Não é
    bloqueio duro (o `CacheService` degrada sozinho), mas a ordem evita entregar 189 com ruído.
  - Ambas dependem da **188**, já mergeada (`7c3eeb8`).
- **Escopo técnico por story:**
  - **190** — apaga `modules/cache/` e os 2 eventos que só existiam para invalidar o cache;
    tira `EventEmitter2` de `ResidentService`/`StaffService`; remove `ioredis`, `REDIS_URL` e o
    serviço `redis` do `docker-compose.yml` de dev. **Mantém** `EventEmitterModule` (o
    `NOTIFICATION_CREATED_EVENT` alimenta o gateway de websocket). Sem migration, sem contrato,
    sem Postman.
  - **189** — `Dockerfile` multi-stage, `.dockerignore`, `docker-compose.prod.yml`,
    `docker/nginx/default.conf`; em código: corrige o gate estático do `main.ts`
    (`STORAGE_BUCKET_NAME` → `AWS_S3_BUCKET_NAME`), passa a ler `CORS_ORIGIN`, e troca
    `uniqueFilename` para `randomUUID()`. Sem migration, sem contrato, sem Postman.
- **Cuidados da rodada:**
  - **A 189 é majoritariamente não verificável pela suíte.** Dockerfile, compose e nginx não são
    exercitados por `pnpm test:api`. O gate cobre só a parte de código; a verificação de
    infraestrutura da story exige VPS, DNS e TLS reais e fica **PENDENTE-MANUAL**. O que dá para
    validar localmente é o **build** (`pnpm build:api`, `pnpm --filter adm.fonte build`,
    `pnpm build:ops`), que é exatamente o que o stage `build` roda — e o `expo export` do ops é
    o passo mais frágil da cadeia.
  - **190 mexe no denominador de cobertura:** apagar `cache.service.spec.ts` muda o total.
    Conferir cobertura **por módulo** (`house`, `resident`, `staff`), não só o global.
  - **190 toca `docker-compose.yml` de dev.** Depois do merge, `pnpm docker:up` não sobe mais
    Redis — esperado.
  - Postgres: produção roda **18**; o compose da 189 usa `postgres:18-alpine`. O dev segue em 16
    e **não** é alinhado nesta rodada (divergência registrada na 189).
  - `pnpm install` após a 190 (remoção do `ioredis` altera o lockfile).
  - Gate de cobertura ≥ 90 no pacote tocado, como sempre.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 190 — remover a dependência de Redis | [ ] | | | |
| 2 | 189 — Dockerfile multi-stage + compose no VPS (nginx + MinIO) | [ ] | | | |

## Log

```
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data>
     <bloqueio/PENDENTE-MANUAL e no máx. 1 nota crítica — máx. ~3 linhas por entrada>
```

## Resumo final

<vazio até o fim da rodada>
