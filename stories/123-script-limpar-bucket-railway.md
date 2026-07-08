# Plan: Script para esvaziar o bucket principal (Railway)

## Context

Precisamos de um script operacional para **esvaziar** o bucket S3 principal
(arquivos de produção, `AWS_S3_BUCKET_NAME`) hospedado no Railway Object Storage —
deletar todos os objetos, mantendo o bucket em si. Uso típico: reset de um
ambiente (dev/staging apontado pelo `.env` local) antes de recarregar dados.

Diferente da story 93 (`done/93-bucket-orphan-cleanup.md`), que remove só objetos
**não referenciados** (órfãos). Aqui é wipe total, incondicional — o script não
consulta o banco, apaga tudo que está no bucket.

A infra já existe em `StorageService`
(`services/api/src/modules/storage/storage.service.ts`):
- `listBucketKeys()` (`:265`) já pagina todas as páginas do bucket.
- `delete(fileUrl)` (`:222`) apaga um objeto por chave (best-effort, ignora
  not-found).

O padrão de script destrutivo do repo é `backup-import.ts`: ts-node em
`src/database/`, parse de `--yes` via `process.argv`, aborta sem confirmação,
`.env` aponta o alvo.

### Decisões travadas

- **Alvo: bucket principal (`AWS_S3_BUCKET_NAME`).** O script mira o bucket de
  produção configurado no `.env` corrente. **Não** recebe nome de bucket por
  argumento — o alvo é sempre o principal do ambiente apontado, evitando digitar
  um nome errado. O operador controla o ambiente pelo `.env` que carrega.
- **Ação: esvaziar (deletar objetos), preservar o bucket.** Não deleta o bucket
  no Railway; deixa-o vazio e reutilizável.
- **Guard: dry-run por default + `--yes`.** Sem flag, o script **lista** quantos e
  quais objetos apagaria e sai sem apagar nada (dry-run). Só com `--yes` explícito
  ele executa a deleção. Espelha `backup-import` / story 93.
- **Deleção em lote quando possível.** Usar `DeleteObjectsCommand` (até 1000
  chaves por chamada) para performance; fallback por-objeto via
  `StorageService.delete` se o provider não suportar batch. Best-effort: falha de
  um objeto loga e segue, não aborta o lote.
- **Sem toque no banco.** Wipe é puramente sobre o bucket; não zera nem concilia
  nenhum registro. O operador é responsável por recarregar/limpar dados depois.

## Desenho

### Script `services/api/src/database/clear-bucket.ts`

- `import "dotenv/config"` + monta `StorageService` com `ConfigService` sobre
  `process.env` (mesmo truque de `backup-import.ts`).
- Fluxo:
  1. Resolver o bucket principal do `.env`. Se `AWS_S3_BUCKET_NAME`/endpoint
     ausentes → erro claro e `exit(1)` (não roda em modo local/uploads).
  2. `keys = await listBucketKeys()`.
  3. Se vazio → informar "bucket já vazio" e sair 0.
  4. **Dry-run (sem `--yes`)**: imprimir o nome do bucket, a contagem e uma
     amostra das chaves; avisar que nada foi apagado e como confirmar (`--yes`);
     sair 0.
  5. **Com `--yes`**: apagar todas as chaves em lotes de até 1000 via
     `DeleteObjectsCommand`; logar progresso e o total apagado; best-effort por
     objeto (erro loga e segue).
- Log de cabeçalho deixa explícito o **endpoint + bucket alvo** antes de qualquer
  deleção, para o operador conferir que o `.env` aponta o ambiente certo.

### Suporte no StorageService (se necessário)

- Adicionar `clearBucket(): Promise<{ deleted: number }>` que reusa
  `listBucketKeys()` + `DeleteObjectsCommand` em lotes, mantendo a lógica S3
  encapsulada no service (o script só orquestra dry-run/confirmação e logs).
  No-op fora do modo S3 (retorna `{ deleted: 0 }`).

### Script no package.json

- `services/api/package.json`: `"bucket:clear": "npx ts-node src/database/clear-bucket.ts"`.
- Uso documentado no topo do arquivo:
  ```
  # dry-run (lista o que apagaria, não apaga):
  pnpm bucket:clear
  # executa a deleção:
  pnpm bucket:clear --yes
  ```

### Runbook

- Atualizar a skill `fonte-backup` (`.claude/skills/fonte-backup/SKILL.md`) com uma
  nota curta sobre `bucket:clear` (wipe do bucket principal, dry-run+`--yes`,
  destrutivo, `.env` define o alvo). Não é backup, mas é operação de bucket e o
  operador procura ali.

## Validação

Story de backend (script + método de service). Gate abaixo é obrigatório.

- **`pnpm test:api`** — unit do `StorageService.clearBucket` com S3 mockado
  (`S3Client.send` stub):
  - bucket com N objetos (N > 1000) → paginação e lotes corretos, retorna
    `deleted === N`, todas as chaves cobertas;
  - bucket vazio → `deleted === 0`, nenhum `DeleteObjectsCommand` enviado;
  - fora do modo S3 (sem `AWS_S3_BUCKET_NAME`) → no-op, `deleted === 0`;
  - erro em um lote → loga e segue (best-effort), não lança.
- **Guard do script (dry-run vs `--yes`)** — testar a função de decisão do
  `clear-bucket.ts` (extrair a lógica de "confirmado?" p/ ser testável isolada,
  como o parse de argv): sem `--yes` não chama `clearBucket`; com `--yes` chama.
  Sem `AWS_S3_BUCKET_NAME` → sai com erro antes de listar.
- **Não** há endpoint HTTP novo → sem `test:api:e2e` e sem alteração no Postman.
- Contratos (`packages/types` / `api-client`) não mudam → sem `build:types` /
  `build:api-client`.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste
correspondente — nenhum código novo entra sem teste. Rodar `pnpm test:api:cov`;
**não reduzir** a cobertura do módulo `storage`. Sem `skip`/`only`/`xfail` sem
justificativa no código (CLAUDE.md).

## Fora de escopo

- Deletar o próprio bucket no Railway (só esvazia).
- Receber nome de bucket arbitrário por argumento / limpar o bucket de **backup**
  (`BACKUP_S3_BUCKET_NAME`) ou outro que não o principal do `.env`.
- Zerar/conciliar tabelas do banco após o wipe (responsabilidade do operador).
- Endpoint ADMIN de wipe pela UI (é operação de terminal, não de app).
- Versionamento/lixeira ou retenção de objetos apagados.
- Reconciliação por órfãos (é a story 93, já concluída).
