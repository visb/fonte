# Plan: Snapshot de migração Railway → VPS (MinIO auto-hospedado)

## Context

A plataforma sai do Railway para um VPS único. O storage de arquivos deixa de ser o Railway
Object Storage e passa a ser um **MinIO rodando no próprio VPS** (story 189). Esta story cobre
mover o conteúdo — banco e arquivos — de um lado para o outro.

**Decisões do usuário:**
- **One-shot, manual.** Não é backup recorrente. O backup agendado da story 20 (scheduler
  semanal, segundo bucket, advisory lock) **fica fora** desta story e não é tocado.
- **MinIO no VPS**, não arquivos soltos em disco. Mantém o `StorageService` em modo S3, e com
  ele toda a camada de URL assinada que já existe.
- **Captura agora, restore depois.** O bucket de destino ainda não existe; o snapshot é gravado
  no disco do operador e fica lá até o MinIO subir.

> **Por que MinIO e não disco cru:** o `StorageUrlInterceptor` assina recursivamente toda URL
> de toda resposta (`storage-url.interceptor.ts:15-21`), com cache LRU e sweeper agendado — e é
> **gated em `isS3Mode()`**. Em modo disco esse interceptor vira no-op e os arquivos passam a
> ser servidos sem autenticação e sem expiração. Como o acervo é foto de residente e documento
> assinado — dado de saúde sob LGPD —, abrir mão do presign seria downgrade de segurança. MinIO
> preserva o controle de acesso **e** exige menos código novo.
>
> **O que MinIO não resolve:** durabilidade. Os bytes ficam no mesmo disco do Postgres. O risco
> de disco único permanece e segue endereçado (em aberto) pela story 20.

### Quase tudo já existe

- **Captura:** `pnpm --filter api backup:export [dir]` (`backup-export.ts` →
  `BackupService.exportToZip()`) roda `pg_dump -Fc` e baixa todos os objetos do bucket de
  origem num `fonte-backup-YYYY-MM-DD.zip` (`dump.dump` na raiz + `files/<key>`).
  Usa **só** `AWS_S3_BUCKET_NAME`; **não** chama `isConfigured()` nem precisa de bucket de
  destino (`backup.service.ts:224-241`). Funciona hoje, com o Railway ainda no ar.
- **Restore:** `pnpm --filter api backup:import <zip> --yes` (`backup-import.ts` →
  `importFromZip()`) roda `pg_restore --clean --if-exists` e reenvia cada `files/<key>` para o
  bucket apontado no `.env` (`backup.service.ts:244-266`). Apontando o `.env` para o MinIO, ele
  popula o bucket novo.

**Não reescrever nenhum dos dois.**

### O que falta

As URLs no banco são **absolutas** e embutem o endpoint:
`publicBaseUrl = ${AWS_ENDPOINT_URL}/${AWS_S3_BUCKET_NAME}` (`storage.service.ts:46`), e o
`upload()` grava `${publicBaseUrl}/${key}` (`:102`). Restaurar o dump cru deixa **toda**
referência apontando para `https://t3.storageapi.dev/<bucket-antigo>/...`, que vai estar
desligado.

Como a *chave* do objeto não muda (o `importFromZip` reenvia com a mesma key), a correção é
**troca de prefixo**: `<base-antiga>/<key>` → `<base-nova>/<key>`. São 23 colunas em 15
tabelas, mais HTML com `<img src>` embutido.

---

## Pré-requisito (bloqueante)

`pg_dump`/`pg_restore` **v16** não estão na máquina do operador (`pg_dump: command not found`).
O winget não instala a 16: o pacote existe mas o download do EnterpriseDB responde `403`, e o
catálogo só lista 17 e 18.

Versão importa nos dois sentidos: `pg_dump` mais novo dumpa servidor mais velho sem problema,
mas **archive custom-format gerado por versão nova não é lido por `pg_restore` mais antigo**
(`unsupported version in file header`). Como o VPS roda Postgres 16, o dump precisa sair de uma
v16.

**Caminho adotado — rodar o export dentro de container**, que dá a v16 exata sem instalar nada:

```
docker run --rm -v C:/code/fonte:/repo -w /repo node:22-alpine sh -c \
  "apk add --no-cache postgresql16-client && corepack enable && pnpm --filter api backup:export /repo"
```

Bônus: essa imagem é exatamente o stage `api` da story 189 — valida cedo o `apk add
postgresql16-client`, que é o passo mais arriscado daquele Dockerfile.

No VPS, o container que roda o `backup:import` precisa do `postgresql16-client` pelo mesmo
motivo — já é exigência registrada na story 189.

---

## Desenho

### 1. Helper puro de rebase — `services/api/src/modules/storage/storage.util.ts`

O arquivo já existe; acrescentar a função pura (é onde o teste bate):

```ts
export function rebaseStorageUrl(
  url: string | null,
  fromBase: string,
  toBase: string,
): string | null
```

- `null`/vazio → devolve como veio.
- URL sob `fromBase` → **canonicaliza primeiro** (tira a query de presign `?X-Amz-...`, mesma
  lógica de `canonicalizeS3Url`, `storage.service.ts:149-153`) e troca o prefixo por `toBase`.
- URL já sob `toBase` → inalterada. **Idempotente**: rodar duas vezes dá o mesmo valor.
- URL externa (outro domínio, CDN, `data:`) → inalterada.

Mais o par para HTML, espelhando o laço de `rewriteHtmlUrls` (`storage.service.ts:156-166`) —
reescreve **só** o atributo `src` de cada `<img>`, não faz replace global no blob:

```ts
export function rebaseHtmlStorageUrls(
  html: string | null,
  fromBase: string,
  toBase: string,
): string | null
```

### 2. CLI de rebase — `services/api/src/database/rewrite-storage-urls.ts`

Exposto como `pnpm --filter api storage:rebase-urls --from <base> --to <base>`.
Roda **depois** do `backup:import`, contra o banco já restaurado. Tudo numa transação.

- `--to` default: `${AWS_ENDPOINT_URL}/${AWS_S3_BUCKET_NAME}` do `.env` corrente (o destino).
- `--from` é **obrigatório** e sem default. Adivinhar a base de origem e errar reescreve o
  acervo inteiro para um endereço inválido, em silêncio.
- Falha explícita se `--from` e `--to` forem iguais, ou se qualquer um for vazio.
- Loga, por tabela, quantas linhas mudaram. Só faz `UPDATE` de linha cujo valor mudou.

Colunas cobertas (nomes conferidos nas entities):

| Tabela | Coluna(s) | Tipo |
| --- | --- | --- |
| `activity_attachments` | `file_url` | url |
| `bible_course_class_photos` | `file_url` | url |
| `house_photos` | `url` | url |
| `messages` | `attachment_url` | url |
| `payables` | `attachment_url`, `payment_receipt_url` | url |
| `relatives` | `photo_url` | url |
| `resident_attachments` | `file_url` | url |
| `resident_documents` | `signed_file_url` | url |
| `resident_follow_ups` | `attachment_url` | url |
| `resident_receivables` | `attachment_url` | url |
| `residents` | `photo_url`, `photo_thumb_url` | url |
| `staff` | `photo_url`, `signature_url` | url |
| `staff_attachments` | `file_url` | url |
| `document_templates` | `content` | **html** |

Implementação: lista declarativa `[{ table, columns, kind: 'url' | 'html' }]` percorrida em
loop, não 15 blocos copiados.

### 3. Runbook — skill `fonte-backup`

Seção **"Migração Railway → VPS"** com o procedimento fim a fim:

1. **Captura** (máquina do operador, `.env` apontando para produção Railway):
   `backup:export` via o container acima → `fonte-backup-<data>.zip`.
   Anotar a base de origem (`AWS_ENDPOINT_URL` + `AWS_S3_BUCKET_NAME`) — é o `--from` do
   passo 4, e depois do corte não dá mais para consultá-la.
2. Subir o VPS com MinIO (story 189) e **criar o bucket** de destino.
3. **Restore**: copiar o zip para o VPS, `.env` apontando para o MinIO,
   `backup:import <zip> --yes`.
4. **Rebase das URLs**: `storage:rebase-urls --from <base-antiga>`.
5. Conferência: abrir ficha com foto, anexo e template com imagem.

Incluir o aviso de que o zip contém prontuário e documento assinado em claro — tratar como
dado sensível enquanto estiver no disco do operador, e apagar depois do corte.

---

## Arquivos

**Criar:**
- `services/api/src/database/rewrite-storage-urls.ts`
- `services/api/src/database/rewrite-storage-urls.spec.ts`

**Editar:**
- `services/api/src/modules/storage/storage.util.ts` — `rebaseStorageUrl` +
  `rebaseHtmlStorageUrls`.
- `services/api/src/modules/storage/storage.util.spec.ts` — casos das duas funções novas.
- `services/api/package.json` — script `storage:rebase-urls`.
- `.claude/skills/fonte-backup/SKILL.md` — runbook de migração.

**Reuso (não recriar):**
- Captura: `backup-export.ts` + `exportToZip()` (`backup.service.ts:224-241`).
- Restore de banco + arquivos: `backup-import.ts` + `importFromZip()` (`:244-266`).
- Canonicalização de presign: `storage.service.ts:149-153`.

**Não tocar:** `backup.scheduler.ts`, `backup.controller.ts`, `syncFiles()`, `pruneOldDumps()`
— é a story 20 e continua como está.

---

## Validação

**Testes obrigatórios:**

1. `pnpm test:api` — unit verdes, suíte existente sem regressão.
2. `pnpm build:api` — o script novo compila.
3. Sem endpoint novo → **não** há mudança no Postman nem em `packages/types`/`api-client`.

**Casos a cobrir em `storage.util.spec.ts` (`rebaseStorageUrl`):**
- URL sob `fromBase` → mesma key sob `toBase`.
- URL **com query de presign** (`?X-Amz-Signature=...`) → rebaseada e **sem** a query.
- URL já sob `toBase` → inalterada (**idempotência**: aplicar duas vezes dá o mesmo valor).
- URL de outro domínio → inalterada.
- Key com subpasta e com caractere codificado (`%20`) → preservada exatamente.
- `null` e string vazia → devolvidos como vieram, sem lançar.

**Casos a cobrir em `storage.util.spec.ts` (`rebaseHtmlStorageUrls`):**
- HTML com múltiplos `<img src>` sob `fromBase` → todos rebaseados.
- `<img>` de `fromBase` e `<img>` externo misturados → só o primeiro muda.
- Texto do corpo que contém a base antiga **fora** de um `src` → **não** é tocado (a razão de
  não usar replace global).
- Aspas simples e duplas no atributo; HTML sem imagem; `null`.

**Casos a cobrir em `rewrite-storage-urls.spec.ts` (DataSource mockado):**
- Percorre as 15 tabelas da lista declarativa — assertar a lista **completa**, não uma
  amostra; é o teste que pega tabela esquecida.
- Linha cujo valor não muda **não** gera `UPDATE`.
- Coluna `null` não quebra o loop.
- `document_templates` usa o caminho HTML, não o de URL simples.
- `--from` ausente, vazio, ou igual a `--to` → lança **antes** de qualquer escrita.

**Verificação manual (a que prova a migração):**
1. `backup:export` (via container) contra produção; conferir que o zip tem `dump.dump` e
   `files/` com a contagem de objetos esperada.
2. Com MinIO de pé e bucket criado, `backup:import <zip> --yes`; conferir os objetos no bucket.
3. `storage:rebase-urls --from <base-antiga>`; conferir o total de linhas alteradas por tabela.
4. Subir a API apontando para o MinIO: ficha de residente com foto, um anexo e um template com
   imagem renderizam — e a URL entregue ao cliente é **assinada** (tem `X-Amz-Signature`),
   provando que o presign voltou a funcionar ponta a ponta.
5. Rodar `storage:rebase-urls` uma segunda vez: **zero** linhas alteradas (idempotência no
   banco real).
6. Pegar uma URL assinada, esperar expirar e reabrir → acesso negado. É o controle que a
   estratégia de disco teria perdido; confirmar que existe.

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente
> — nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` e **não reduzir** a cobertura
> dos módulos afetados (`storage`, `database`). Sem `skip`/`only`/`xfail` sem justificativa no
> código (CLAUDE.md).

---

## Fora de escopo

- **Backup recorrente/agendado** — story 20, intocada aqui.
- **Destino offsite** (R2/B2/rsync). O risco de disco único está registrado no Context e segue
  em aberto: MinIO no mesmo VPS **não** é backup.
- Provisionamento do MinIO (serviço, volume, bucket, credenciais, proxy) — é a story 189.
- `Dockerfile` / `docker-compose.prod.yml` / nginx / TLS — story 189.
- Migração de DNS e reconfiguração dos webhooks Pagar.me e Meta WhatsApp.
- Caminho de volta (VPS → Railway): o rebase é genérico (`--from`/`--to`), mas o procedimento
  inverso não é exercitado nem documentado.
