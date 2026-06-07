# Plan: Backup do banco de dados e do bucket de arquivos

## Context

A plataforma roda em **uma única instância (VPS)** com 1 container NestJS + 1 Postgres 16 em
Docker (volume `postgres_data`). Arquivos enviados (fotos de residentes, documentos, anexos)
ficam num bucket S3-compatible externo (Railway Object Storage, endpoint `*.storageapi.dev`),
acessado via `StorageService`. **Hoje não existe nenhum backup** — perda do volume Postgres ou
exclusão acidental de objetos no bucket = perda definitiva de dados.

Objetivo: backup automático diário do banco e do bucket, com restauração documentada e testável.

**Decisões do usuário:**
- Destino: **segundo bucket no mesmo provider** (Railway Object Storage) — reusa credenciais/SDK.
- Mecanismo: **scheduler in-app NestJS** (segue o padrão `@Cron` + advisory lock já existente).
- Escopo: **banco (pg_dump) + bucket de arquivos + scripts de restauração**.
- Frequência/retenção: **semanal — domingos às 04:00 (America/Sao_Paulo) — manter os 4 últimos backups**.
- **Export/import local adicional:** comando CLI que baixa um snapshot completo (dump + todos
  os arquivos) num `.zip` para a máquina do usuário, mais o comando inverso de import. Cobertura
  3-2-1: cópia offsite num provider diferente (a máquina local), fora do blast radius do Railway.
  Complementa o scheduler automático, não substitui.

> Limitação aceita: segundo bucket no mesmo provider compartilha blast radius da conta. Mitiga
> exclusão acidental e corrupção de volume, **não** perda total da conta. Mantém porta aberta
> para um destino offsite no futuro (basta novas credenciais).

---

## Pré-requisito de infraestrutura (bloqueante)

O dump usa o binário `pg_dump` **versão 16** (precisa casar com o Postgres 16 do servidor).
Não há `Dockerfile` no repositório — a imagem de deploy é construída externamente.

**Ação obrigatória no deploy:** a imagem/host que roda a API deve incluir
`postgresql-client` v16 (ex.: no Alpine `apk add postgresql16-client`; no Debian
`postgresql-client-16`). O `BackupService` detecta a ausência do binário no startup e loga
aviso; o backup falha de forma visível (não silenciosa) se faltar.

O segundo bucket precisa ser criado no painel do provider antes de ativar (`BACKUP_S3_BUCKET_NAME`).

---

## Desenho

Novo módulo `services/api/src/modules/backup/`, espelhando o padrão de
`storeroom-usage.scheduler.ts` (advisory lock via `pg_try_advisory_lock`) e a construção de
`S3Client` de `storage.service.ts`.

**Fonte de verdade = o bucket de backup, não o banco.** Não criamos tabela de metadados no
Postgres (seria circular guardar o histórico de backup dentro da coisa que está sendo
backupeada). O que existe é listado direto do bucket via `ListObjectsV2`.

### 1. `backup.service.ts`
- `dumpDatabase()`: roda `pg_dump -Fc "$DATABASE_URL"` via `child_process.spawn`, streama o
  output e faz `PutObject` no bucket de backup com chave `db/YYYY-MM-DDTHH-mm-ss.dump`
  (formato custom → restaurável com `pg_restore`). Falha se exit code != 0.
- `syncFiles()`: **espelho incremental copy-only** do bucket de produção para o de backup,
  prefixo `files/`.
  - `ListObjectsV2` (paginado) no bucket de origem e no destino.
  - Para cada chave ausente no destino: `CopyObjectCommand` server-side
    (`CopySource: origem/key` → `Bucket: backup, Key: files/<key>`), sem baixar pelo app.
    Fallback para `StorageService.download()` + `PutObject` se o provider não suportar copy
    cross-bucket.
  - **Nunca deleta** do backup quando some da origem — é justamente a proteção contra exclusão
    acidental em produção.
- `pruneOldDumps()`: lista `db/`, ordena por data desc e apaga tudo além dos
  `BACKUP_RETENTION_COUNT` (4) mais recentes. Arquivos (`files/`) **não** entram na retenção —
  são espelho vivo, não snapshot datado.
- `runBackup()`: orquestra dump → sync → prune; loga resumo (tamanho do dump, nº de arquivos
  copiados, dumps removidos). Lança erro em qualquer etapa falha.
- `listBackups()`: `ListObjectsV2` do prefixo `db/` para a UI/CLI.
- S3 próprio configurado a partir de `AWS_ENDPOINT_URL` / region / credenciais (reuso) +
  `BACKUP_S3_BUCKET_NAME`. Origem dos arquivos = bucket atual (`AWS_S3_BUCKET_NAME`).

### 2. `backup.scheduler.ts`
- `@Cron('0 0 4 * * 0', { name: 'weekly-backup', timeZone: 'America/Sao_Paulo' })` — domingos
  04:00, fora dos horários dos jobs existentes (08:00 notificações, sáb 02:00 storeroom).
- Envolve `runBackup()` em `pg_try_advisory_lock(hashtext('weekly-backup'))`; se outra instância
  segura o lock, faz skip e loga (mesmo padrão do storeroom).
- Respeita `BACKUP_ENABLED` (default `false` em dev/local; `true` em produção).

### 3. `backup.controller.ts` (ADMIN-only)
Segue `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)` (padrão de
`bible-course.controller.ts`).
- `POST /backup/run` — dispara backup manual sob demanda.
- `GET /backup` — lista dumps disponíveis (chave, data, tamanho) para visibilidade no ADM.

### 4. `backup.module.ts`
Importa `StorageModule` (já global), provê service + scheduler + controller. Registrado em
`app.module.ts` (`@nestjs/schedule` já está ativo lá).

### 5. Restauração — `services/api/src/database/restore-backup.ts` (ts-node)
Script CLI documentado:
- `--db <key>`: baixa o dump escolhido do bucket de backup e roda
  `pg_restore --clean --if-exists -d "$DATABASE_URL"`.
- `--files`: re-copia o prefixo `files/` do bucket de backup de volta ao bucket de produção
  (recuperação de exclusão acidental).
- Sem args: lista dumps disponíveis (chama `listBackups()`).
Exposto como `pnpm --filter api backup:restore`.

### 6. Export/import local — `services/api/src/database/backup-export.ts` e `backup-import.ts`
Comandos CLI rodados na **máquina local** (apontando `DATABASE_URL` + credenciais do bucket
para **produção** via `.env` local). Reusam a lógica de `BackupService`.

- `backup-export.ts` (`pnpm --filter api backup:export`):
  1. `pg_dump -Fc "$DATABASE_URL"` → buffer/arquivo temp `dump.dump`.
  2. `ListObjectsV2` no bucket de produção + `StorageService.download()` de cada objeto.
  3. Empacota tudo num `fonte-backup-YYYY-MM-DD.zip` (`jszip`, já é dependência) — `dump.dump`
     na raiz + objetos sob `files/<key>`. Caminho de saída configurável (default: cwd).
- `backup-import.ts` (`pnpm --filter api backup:import <zip>`):
  - Par simétrico/destrutivo. Extrai o zip, `pg_restore --clean --if-exists -d "$DATABASE_URL"`
    e reenvia `files/*` para o bucket configurado via `StorageService.upload()`.
  - **Exige confirmação explícita** (flag `--yes` ou prompt) — sobrescreve banco e bucket.
- Requer `pg_dump`/`pg_restore` v16 instalados na máquina local.

---

## Arquivos

**Criar:**
- `services/api/src/modules/backup/backup.service.ts`
- `services/api/src/modules/backup/backup.scheduler.ts`
- `services/api/src/modules/backup/backup.controller.ts`
- `services/api/src/modules/backup/backup.module.ts`
- `services/api/src/modules/backup/backup.service.spec.ts` — testa `pruneOldDumps` (corte por
  data) e a lógica incremental de `syncFiles` (S3 mockado), padrão de `storeroom.service.spec.ts`.
- `services/api/src/database/restore-backup.ts`
- `services/api/src/database/backup-export.ts` — export local em zip.
- `services/api/src/database/backup-import.ts` — import local a partir do zip (destrutivo).
- `docs/ai/backup-guide.md` — operação, restauração, export/import local, pré-requisito `pg_dump` v16.

**Editar:**
- `services/api/src/app.module.ts` — importar `BackupModule`.
- `services/api/.env.example` — `BACKUP_ENABLED`, `BACKUP_S3_BUCKET_NAME`,
  `BACKUP_RETENTION_COUNT=4` (creds/endpoint reusados).
- `services/api/package.json` — scripts `"backup:restore"`, `"backup:export"`, `"backup:import"`.
- `fonte-api.postman_collection.json` — endpoints `POST /backup/run` e `GET /backup`
  (regra do CLAUDE.md: coleção é documentação viva).
- `README.md` (seção de deploy) — nota do pré-requisito `postgresql-client` v16 na imagem.

**Reuso (não recriar):**
- Advisory lock: `storeroom.service.ts:96-114`.
- Construção de `S3Client` + `download()`: `storage.service.ts:42-55,160-176`.
- Guard/roles: `common/guards/roles.guard.ts` + `@Roles` (ex. `bible-course.controller.ts`).

---

## Variáveis de ambiente (novas)

```
BACKUP_ENABLED=false            # true em produção
BACKUP_S3_BUCKET_NAME=          # segundo bucket (criar no provider)
BACKUP_RETENTION_COUNT=4        # mantém os 4 dumps mais recentes
# endpoint/region/credenciais reusam AWS_ENDPOINT_URL / AWS_DEFAULT_REGION /
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
```

---

## Verificação (end-to-end)

1. **Unit:** `pnpm test:api` — novo `backup.service.spec.ts` (prune por data + sync incremental
   com S3 mockado) verde; suíte existente continua passando.
2. **Dump real (local):** subir Postgres (`pnpm docker:up`) com `pg_dump` 16 instalado, setar
   `BACKUP_ENABLED=true` + bucket de backup (ou MinIO local), `POST /backup/run` e confirmar
   `db/<timestamp>.dump` no bucket.
3. **Sync de arquivos:** subir um arquivo pelo app, rodar backup, confirmar objeto sob `files/`
   no bucket de backup; rodar de novo e confirmar que não recopia (incremental).
4. **Restore (o teste que importa):** banco limpo → `backup:restore --db <key>` → conferir
   tabelas/linhas restauradas; apagar um arquivo do bucket de produção →
   `backup:restore --files` → confirmar que voltou.
5. **Prune:** com mais de 4 dumps em `db/` (ou retenção curta de teste), rodar backup e
   confirmar que só os 4 mais recentes permanecem.
6. **Lock:** dois `POST /backup/run` concorrentes → um executa, outro faz skip logado.
7. **Export/import local:** `backup:export` gera `fonte-backup-<data>.zip` com `dump.dump` +
   `files/`; em banco/bucket limpos, `backup:import <zip> --yes` restaura banco e reenvia
   arquivos; conferir tabelas e objetos de volta.
