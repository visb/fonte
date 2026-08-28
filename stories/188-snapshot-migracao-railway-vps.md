# Plan: Snapshot de migração Railway → VPS (storage em disco)

## Context

A plataforma vai sair do Railway para um VPS único. No VPS os arquivos enviados (fotos,
documentos, anexos) passam a viver **no disco**, não num bucket S3 — decisão do usuário. Isso
exige capturar o estado atual de produção (banco + bucket Railway) e conseguir restaurá-lo
**manualmente** do outro lado, com o storage em modo local.

**Decisões do usuário:**
- **One-shot, manual.** Não é backup recorrente. O backup agendado da story 20 (scheduler
  semanal, segundo bucket, advisory lock) **fica fora** desta story e não é tocado.
- **Arquivos no disco do VPS.** Sem MinIO, sem bucket externo. `AWS_*` some da config de
  produção e o `StorageService` cai no ramo local (`uploads/<folder>/<filename>`).
- **Restaurar manualmente.** O operador roda comandos no VPS; não há automação de cutover.

> **Risco aceito e registrado:** com arquivos e banco no mesmo disco do VPS e sem destino
> offsite, perda do disco = perda total. Esta story entrega a *captura* e o *restore*, não
> proteção contínua. Um destino offsite recorrente continua sendo trabalho futuro (story 20).

### Por que existe trabalho novo aqui

A captura **já está pronta**: `pnpm --filter api backup:export` (`backup-export.ts` →
`BackupService.exportToZip()`) roda `pg_dump -Fc` e baixa todos os objetos do bucket num
`fonte-backup-YYYY-MM-DD.zip` (`dump.dump` na raiz + `files/<key>`). Não depende de
`BACKUP_S3_BUCKET_NAME`, só do bucket de origem — que o `.env` local já aponta para produção.
**Não reescrever isso.**

O que falta são os dois lados do restore em disco:

1. **Layout.** O zip traz `files/<folder>/<filename>`; o modo local lê de
   `uploads/<folder>/<filename>` (`storage.service.ts:104-108`). Ninguém desempacota nesse
   layout hoje. O `backup-import.ts` existente reenvia para um **bucket** (`putObjectTo`), que
   é justamente o que não vai existir no VPS.

2. **URLs no banco.** Em modo S3 o `upload()` grava a URL **absoluta**
   (`storage.service.ts:102` → `${endpoint}/${bucket}/<folder>/<file>`); em modo disco grava o
   caminho relativo `/uploads/<folder>/<file>` (linha 108). Restaurar o dump cru no VPS deixa
   **toda** referência de arquivo apontando para o bucket Railway desligado. São 23 colunas em
   15 tabelas, mais HTML com `<img src>` embutido.

---

## Pré-requisito (bloqueante)

`pg_dump`/`pg_restore` **v16** não estão instalados na máquina do operador (`pg_dump: command
not found`). Sem eles o `backup:export` falha na primeira etapa.

Resolver antes de rodar a captura (Windows, com `winget`/`choco`/Docker disponíveis):

```
winget install PostgreSQL.PostgreSQL.16
```

Depois apontar `PG_DUMP_PATH` / `PG_RESTORE_PATH` no `.env` se os binários não caírem no PATH
(`backup.service.ts:71-72` já lê as duas variáveis, default `pg_dump`/`pg_restore`).

No VPS, a imagem/host que roda o `pg_restore` precisa do `postgresql-client-16` — mesma
exigência já registrada na story 20.

---

## Desenho

### 1. Helper puro de reescrita de URL — `services/api/src/modules/storage/storage.util.ts`

O arquivo já existe; acrescentar a função pura (é onde o teste vai bater):

```ts
export function s3UrlToLocalPath(url: string | null, publicBaseUrl: string): string | null
```

- `null`/vazio → devolve como veio.
- URL sob `publicBaseUrl` → **canonicaliza primeiro** (tira a query de presign `?X-Amz-...`,
  igual a `canonicalizeS3Url`, `storage.service.ts:149-153`) e devolve `/uploads/<key>`.
- URL já local (`/uploads/...`) → devolve inalterada. **Idempotente**: rodar duas vezes não
  corrompe.
- URL externa (outro domínio, CDN, `data:`) → devolve inalterada.

Mais o par para HTML, espelhando `rewriteHtmlUrls` (`storage.service.ts:156-166`):

```ts
export function rewriteHtmlS3UrlsToLocal(html: string | null, publicBaseUrl: string): string | null
```

### 2. CLI de restore — `services/api/src/database/snapshot-restore.ts`

Comando único rodado **no VPS**, exposto como `pnpm --filter api snapshot:restore <zip>`.
Destrutivo → **exige `--yes`** (mesmo contrato do `backup-import.ts`).

Ordem das etapas:

1. Abre o zip (`jszip`, já é dependência).
2. `pg_restore --clean --if-exists -d "$DATABASE_URL"` a partir de `dump.dump`. Reusa
   `BackupService.restoreDatabase()` — não reimplementar o spawn.
3. Grava cada entrada `files/<key>` em `<cwd>/uploads/<key>`, criando os diretórios
   (`mkdir recursive`). Conta os arquivos escritos.
4. Roda a reescrita de URLs (item 3 abaixo).
5. Loga resumo: tabelas restauradas, arquivos gravados, linhas com URL reescrita por tabela.

O `publicBaseUrl` de origem (`https://<endpoint>/<bucket>` do Railway) vem de um argumento
`--from-base <url>` ou, na ausência, de `AWS_ENDPOINT_URL` + `AWS_S3_BUCKET_NAME` do `.env`.
Falha explícita se não der para determinar — reescrever com base errada é silenciosamente
destrutivo.

### 3. Reescrita das URLs — `services/api/src/database/rewrite-storage-urls.ts`

Módulo exportando `rewriteStorageUrls(dataSource, publicBaseUrl)`, chamado pelo
`snapshot-restore.ts` e também executável sozinho
(`pnpm --filter api snapshot:rewrite-urls`) — porque o operador pode precisar reaplicar sem
refazer o restore inteiro.

Tudo numa transação. Colunas cobertas (nomes confirmados nas entities):

| Tabela | Coluna(s) |
| --- | --- |
| `activity_attachments` | `file_url` |
| `bible_course_class_photos` | `file_url` |
| `house_photos` | `url` |
| `messages` | `attachment_url` |
| `payables` | `attachment_url`, `payment_receipt_url` |
| `relatives` | `photo_url` |
| `resident_attachments` | `file_url` |
| `resident_documents` | `signed_file_url` |
| `resident_follow_ups` | `attachment_url` |
| `resident_receivables` | `attachment_url` |
| `residents` | `photo_url`, `photo_thumb_url` |
| `staff` | `photo_url`, `signature_url` |
| `staff_attachments` | `file_url` |
| `document_templates` | `content` (HTML — usa `rewriteHtmlS3UrlsToLocal`) |

Implementação: uma lista declarativa `[{ table, columns, kind: 'url' | 'html' }]` percorrida em
loop, não 15 blocos copiados. Só atualiza linha cujo valor mudou (evita `UPDATE` inútil e deixa
a contagem do log honesta).

### 4. Runbook — skill `fonte-backup`

Acrescentar seção **"Migração Railway → VPS"** com o procedimento fim a fim:
captura na máquina do operador → cópia do zip para o VPS → `.env` do VPS **sem** as variáveis
`AWS_*` → `snapshot:restore` → conferência. Inclui o passo de conferir que o
`StorageService` subiu em modo local (`isS3Mode() === false`) antes de restaurar.

---

## Arquivos

**Criar:**
- `services/api/src/database/snapshot-restore.ts`
- `services/api/src/database/rewrite-storage-urls.ts`
- `services/api/src/database/rewrite-storage-urls.spec.ts`

**Editar:**
- `services/api/src/modules/storage/storage.util.ts` — `s3UrlToLocalPath` +
  `rewriteHtmlS3UrlsToLocal`.
- `services/api/src/modules/storage/storage.util.spec.ts` — casos das duas funções novas.
- `services/api/package.json` — scripts `snapshot:restore`, `snapshot:rewrite-urls`.
- `.claude/skills/fonte-backup/SKILL.md` — seção do runbook de migração.

**Reuso (não recriar):**
- Captura: `backup-export.ts` + `BackupService.exportToZip()` (`backup.service.ts:224-241`).
- `pg_restore`: `BackupService.restoreDatabase()`.
- Canonicalização de URL presign: `storage.service.ts:149-153`.

**Não tocar:** `backup.scheduler.ts`, `backup.controller.ts`, `syncFiles()`, `pruneOldDumps()` —
tudo isso é a story 20 e continua como está.

---

## Validação

**Testes obrigatórios:**

1. `pnpm test:api` — unit verdes, suíte existente sem regressão.
2. `pnpm build:api` — os scripts novos compilam.
3. Sem endpoint novo → **não** há mudança no Postman nem em `packages/types`/`api-client`.

**Casos a cobrir em `storage.util.spec.ts` (`s3UrlToLocalPath`):**
- URL S3 sob a base → `/uploads/<folder>/<file>`.
- URL S3 **com query de presign** (`?X-Amz-Signature=...`) → caminho limpo, sem query.
- URL já em `/uploads/...` → inalterada (**idempotência**: aplicar duas vezes dá o mesmo valor).
- URL de outro domínio → inalterada.
- `null` e string vazia → devolvidos como vieram, sem lançar.

**Casos a cobrir em `storage.util.spec.ts` (`rewriteHtmlS3UrlsToLocal`):**
- HTML com múltiplos `<img src>` S3 → todos reescritos.
- HTML com `<img>` S3 e `<img>` externo misturados → só o S3 muda.
- HTML sem imagem e `null` → devolvidos inalterados.
- Aspas simples e duplas no atributo `src`.

**Casos a cobrir em `rewrite-storage-urls.spec.ts` (DataSource mockado):**
- Percorre as 15 tabelas da lista declarativa (assertar a lista completa, não uma amostra —
  é o teste que pega tabela esquecida).
- Linha cujo valor não muda **não** gera `UPDATE`.
- Coluna `null` não quebra o loop.
- `document_templates` usa o caminho HTML, não o de URL simples.
- Falha sem `publicBaseUrl` determinável → lança, não reescreve nada.

**Verificação manual (o teste que importa de verdade):**
1. Rodar `backup:export` contra produção; conferir que o zip tem `dump.dump` + `files/`
   com a contagem de objetos esperada.
2. Num Postgres 16 limpo e `uploads/` vazio, `snapshot:restore <zip> --yes`.
3. Subir a API **sem** as variáveis `AWS_*`; abrir uma ficha de residente com foto, um anexo e
   um template de documento com imagem — tudo tem de renderizar servido do disco.
4. Rodar `snapshot:rewrite-urls` uma segunda vez e confirmar **zero** linhas alteradas
   (idempotência no banco real).

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
> nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` e **não reduzir** a cobertura dos
> módulos afetados (`storage`, `database`). Sem `skip`/`only`/`xfail` sem justificativa no código
> (CLAUDE.md).

---

## Fora de escopo

- **Backup recorrente/agendado** — é a story 20, intocada aqui.
- **Destino offsite** (R2/B2/rsync) — o risco de disco único está registrado no Context e segue
  em aberto.
- `Dockerfile` / `docker-compose.prod.yml` / Caddy / TLS para o VPS.
- Migração de DNS e reconfiguração dos webhooks Pagar.me e Meta WhatsApp.
- Escolha de provider e provisionamento do VPS.
- Caminho de volta (VPS → S3): a reescrita é one-way, de bucket para disco.
