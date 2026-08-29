---
name: fonte-backup
description: Runbook de backup banco+bucket da API fonte — pg_dump/pg_restore casando a major do servidor (pré-requisito bloqueante; produção roda 18), agenda semanal sob advisory lock, retenção por contagem, restore a partir da nuvem, export/import local 3-2-1, migração Railway→VPS com rebase de URLs, endpoints ADMIN. Use ao mexer em backup, restore, pg_dump, migração de storage ou ao operar/configurar o backup.
---

# Backup — guia de operação

Backup do banco (Postgres) e do bucket de arquivos. Implementado na story 20
(`stories/20-backup-banco-e-bucket.md`).

## Visão geral

- **Banco:** `pg_dump` em formato custom (`-Fc`) → bucket de backup sob `db/<timestamp>.dump`.
- **Arquivos:** espelho incremental **copy-only** do bucket de produção → bucket de backup sob
  `files/`. Nunca deleta (proteção contra exclusão acidental em produção).
- **Destino:** segundo bucket no mesmo provider (Railway Object Storage), reusando
  endpoint/region/credenciais do storage principal.
- **Agenda:** domingos 04:00 (America/Sao_Paulo), sob advisory lock (`weekly-backup`).
- **Retenção:** mantém os `BACKUP_RETENTION_COUNT` (default 4) dumps mais recentes.
- **Fonte de verdade do histórico:** o próprio bucket de backup (sem tabela no Postgres).

## Pré-requisito (bloqueante)

`pg_dump`/`pg_restore` disponíveis onde a API roda (e na máquina local para export/import), numa
major **>= a do servidor**. **Produção roda Postgres 18** (medido: `18.6`), então o cliente é 18:

- Alpine: `apk add postgresql18-client`
- Debian/Ubuntu: `apt-get install postgresql-client-18`

Duas regras que decorrem disso, e que quebram de formas diferentes:

- `pg_dump` **mais antigo que o servidor** aborta com `server version mismatch`.
- Archive custom-format gerado por uma major **nova** não é lido por `pg_restore` mais antigo
  (`unsupported version in file header`) — então o destino precisa ser >= a origem.

> O `docker-compose.yml` de dev usa `postgres:16-alpine`: dev e produção estão em majors
> diferentes. Para qualquer operação contra produção, use cliente 18.

Sem o binário, o backup falha de forma visível (log de erro), não silenciosa. O caminho pode ser
sobrescrito por `PG_DUMP_PATH` / `PG_RESTORE_PATH`.

## Configuração

```
BACKUP_ENABLED=true              # liga o agendamento semanal (deixe false em dev)
BACKUP_S3_BUCKET_NAME=<bucket>   # criar no provider antes de ativar
BACKUP_RETENTION_COUNT=4
# endpoint/region/credenciais reusam AWS_ENDPOINT_URL / AWS_DEFAULT_REGION /
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
```

## Endpoints (ADMIN)

- `GET /api/v1/backup` — lista os dumps disponíveis (chave, tamanho, data).
- `POST /api/v1/backup/run` — dispara um backup manual (roda mesmo com `BACKUP_ENABLED=false`,
  desde que o bucket esteja configurado).

Visíveis também no adm.fonte em **Backup** (menu lateral, só ADMIN).

## Restore a partir da nuvem

Rode de `services/api`, com `.env` apontando para o destino:

```
pnpm backup:restore                  # lista os dumps no bucket
pnpm backup:restore --db db/<arquivo>.dump   # restaura o banco (DESTRUTIVO: pg_restore --clean)
pnpm backup:restore --files          # re-copia os arquivos do backup p/ o bucket de produção
```

## Export / import local (offsite 3-2-1)

Snapshot completo num `.zip` na máquina do operador, e o caminho inverso:

```
pnpm backup:export [dir]             # gera fonte-backup-YYYY-MM-DD.zip (dump.dump + files/)
pnpm backup:import <arquivo.zip> --yes   # DESTRUTIVO: pg_restore + reenvia arquivos
```

O `.env` local deve apontar `DATABASE_URL` + credenciais do bucket para o ambiente desejado
(produção, para tirar a cópia). Requer `pg_dump`/`pg_restore` v16 locais.

## Migração Railway → VPS (story 188)

Mover banco + arquivos para o MinIO auto-hospedado. **One-shot e manual** — não confundir com
o backup agendado acima.

> **Versão do Postgres: produção roda 18.** `pg_dump` tem de ser **>= a versão do servidor**, e
> archive custom-format de versão nova **não é lido por `pg_restore` mais antigo**. Logo: 18 na
> captura e 18 no destino. O `docker-compose.yml` de dev usa 16 — não serve para esta operação.

**1. Captura** (máquina do operador, `.env` apontando para a **origem**):

```
pnpm backup:export [dir]      # dump.dump + files/ num zip
```

Sem `pg_dump` 18 no host, rodar só o dump em container e montar o zip fora — foi o que a
migração usou (o install deste repo é hoisted e `bcrypt`/`sharp` são nativos, então montar o
repo num `node:alpine` não funciona).

**Anotar a base de origem** (`AWS_ENDPOINT_URL` + `/` + `AWS_S3_BUCKET_NAME`) antes de desligar
o provider antigo — é o `--from` do passo 3 e depois não dá mais para consultá-la.

**2. Restore** (no VPS, `.env` apontando para o **destino**, MinIO de pé e bucket criado).

> **Dentro da imagem, os scripts `pnpm` não funcionam.** Todos rodam via
> `npx ts-node src/database/*.ts` e a imagem só carrega o `dist/`. Use
> `node dist/database/<script>.js`. Os comandos `pnpm` valem em desenvolvimento.

> **O banco precisa estar VAZIO.** O dump traz schema + dados + a tabela `migrations`. Se as
> migrations já rodaram (o `CMD` da imagem roda `migration:run` a cada boot), o
> `pg_restore --clean` trava nas FKs cruzadas e deixa o banco meio-restaurado. Por isso o
> import roda em container **avulso** (`run`, não `exec`) — `run` não passa pelo `CMD`.

```
docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml exec -T postgres psql -U fonte -d postgres -c "DROP DATABASE IF EXISTS fonte;"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U fonte -d postgres -c "CREATE DATABASE fonte OWNER fonte;"
docker compose -f docker-compose.prod.yml run --rm \
  -v /opt/fonte/<arquivo>.zip:/tmp/backup.zip \
  --entrypoint node api dist/database/backup-import.js /tmp/backup.zip --yes
docker compose -f docker-compose.prod.yml up -d api
```

O banco precisa das extensões `unaccent` e `uuid-ossp` disponíveis, senão o `pg_restore` falha
nas primeiras entradas do TOC.

**3. Rebase das URLs** — o `upload()` grava URL absoluta, então o dump restaurado ainda aponta
para o endpoint antigo. Como o import reenvia com a mesma key, é troca de prefixo:

```
docker compose -f docker-compose.prod.yml exec -T api \
  node dist/database/rewrite-storage-urls.js --from <base-antiga> [--to <base-nova>]
```

Sem `--to`, usa `AWS_ENDPOINT_URL/AWS_S3_BUCKET_NAME` do `.env` corrente. Cobre 16 colunas de
URL em 13 tabelas mais o HTML de `document_templates.content`. **Idempotente**: rodar de novo
reescreve zero linhas — é assim que se confere que terminou.

**4. Conferência:** abrir ficha com foto, um anexo e um template com imagem. A URL entregue ao
cliente tem de vir **assinada** (`X-Amz-Signature`); a URL canônica, sem assinatura, tem de ser
**negada** — se servir o arquivo, o bucket está público e o controle de acesso caiu.

> O zip contém prontuário e documento assinado em claro. Tratar como dado sensível enquanto
> existir no disco do operador e apagar depois do corte.

## Esvaziar o bucket principal (wipe — story 123)

Operação **destrutiva** e separada de backup: esvazia o bucket **principal**
(`AWS_S3_BUCKET_NAME`) apontado pelo `.env` corrente — apaga todos os objetos,
preserva o bucket. Não consulta o banco (não é limpeza de órfãos da story 93): é
wipe total, incondicional. O alvo é sempre o bucket principal do ambiente
carregado; o script **não** recebe nome de bucket por argumento (evita apontar
para o alvo errado). Uso típico: reset de um ambiente antes de recarregar dados.

Rode de `services/api`, com o `.env` apontando para o ambiente desejado:

```
pnpm bucket:clear            # dry-run: lista contagem + amostra, NÃO apaga
pnpm bucket:clear --yes      # DESTRUTIVO: apaga todos os objetos do bucket principal
```

Sem `AWS_S3_BUCKET_NAME`/`AWS_ENDPOINT_URL` no `.env` o script sai com erro antes
de listar (não roda em modo local/uploads). A deleção é best-effort e em lotes de
até 1000 objetos.

## Notas de design

- Os dumps são datados e podados por contagem; os arquivos são espelho vivo (não datados, não
  podados).
- Advisory lock garante que duas instâncias não rodem o backup ao mesmo tempo.
- Reuso: padrão de lock de `storeroom.service.ts`; construção de `S3Client` de `storage.service.ts`.
