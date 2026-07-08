---
name: fonte-backup
description: Runbook de backup banco+bucket da API fonte — pg_dump/pg_restore v16 (pré-requisito bloqueante), agenda semanal sob advisory lock, retenção por contagem, restore a partir da nuvem, export/import local 3-2-1, endpoints ADMIN. Use ao mexer em backup, restore, pg_dump ou ao operar/configurar o backup.
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

`pg_dump`/`pg_restore` **v16** disponíveis onde a API roda (e na máquina local para export/import):

- Alpine: `apk add postgresql16-client`
- Debian/Ubuntu: `apt-get install postgresql-client-16`

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
