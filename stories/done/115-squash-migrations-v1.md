# Plan: Colapsar as migrations numa InitialSchema limpa (v1 de migrations)

> **Status: PLANEJAMENTO.** Backend/infra. Sem reset de dados.

## Context

O diretório `services/api/src/database/migrations` acumulou **85 migrations** desde o início do
projeto. O pedido: uma **"v1 limpa"** — colapsar (squash) o histórico numa única
`InitialSchema` que reproduz o schema atual, para simplificar setup e leitura.

### Decisões travadas

- **Escopo = só squash das migrations.** **Nenhum reset/limpeza de dados** (fora de escopo). O
  schema resultante deve ser **idêntico** ao produzido hoje rodando as 85 em sequência.
- **Ambiente pré-produção, banco descartável.** Não há produção viva com dados a preservar
  (confirmado no planning), então **não há passo de baseline** de banco existente — todo ambiente
  (dev/teste/qualquer deploy) é **recriado do zero** com a nova migration única. Documentar isso
  como consequência: quem tiver um banco antigo precisa recriá-lo (`pnpm docker:reset` + migrate).
- **Entities são a fonte da verdade.** A migration única é gerada a partir das entities
  (`migration:generate`) e **conferida** contra o schema das 85-em-sequência para pegar qualquer
  drift acumulado entre entities e migrations ao longo do histórico.
- **Timestamp da nova migration** = anterior a qualquer migration futura (usar `1777743139019` ou um
  timestamp baixo dedicado) para ser sempre a primeira a rodar. Nome `InitialSchema` mantido.

## Desenho

### `services/api/src/database`

1. **Capturar o schema-alvo**: em banco limpo, rodar as 85 migrations atuais (`migration:run`) e
   extrair o schema (ex: `pg_dump --schema-only`) como referência.
2. **Gerar a migration única**: apagar as 85 migrations, subir um banco vazio e rodar
   `pnpm --filter api migration:generate` (contra as entities) para produzir uma
   `<ts>-InitialSchema.ts` que cria todo o schema. Incluir o que `migration:generate` não captura
   sozinho (extensões como `unaccent` — ver `1782200000000-UnaccentExtension`; enums; índices
   funcionais; seeds de estrutura embutidos em migrations antigas, se houver).
3. **Conferir equivalência**: comparar o schema da migration única (passo 2) com o de referência
   (passo 1) — devem ser idênticos (tabelas, colunas, tipos, enums, FKs, índices, extensões). Ajustar
   a migration única até bater. Este diff é o **critério de aceite** do squash.
4. **Ajustar artefatos que referenciam migrations**: conferir `data-source.ts` (glob de migrations
   continua válido), scripts de seed (`seed.ts`/`seed-test.ts`) e docs que citem migrations antigas.
5. **Remover os 85 arquivos antigos** de `migrations/` (ficam no histórico git).

## Validação

Gate: a suíte que roda contra o banco recriado **é** a cobertura — não pode haver regressão de
schema. Sem `skip`/`only`/`xfail` injustificado.

- **Equivalência de schema** (critério central): `pg_dump --schema-only` do banco migrado com a
  **migration única** == dump do banco migrado com as **85 antigas**. Zero diff.
- **`pnpm test:setup` + `pnpm migration:run:test`**: banco de teste sobe do zero só com a
  `InitialSchema` sem erro.
- **`pnpm test:api`** e **`pnpm test:api:e2e`** verdes contra o banco recriado (exercitam o schema
  real de ponta a ponta).
- **`pnpm docker:reset` + `pnpm dev:api`**: sobe limpo, migration roda, app inicia.
- `migration:revert` da `InitialSchema` derruba o schema sem erro (down coerente).

## Fora de escopo

- **Reset/limpeza de dados** — só squash de migrations.
- **Baseline de banco de produção** — não há produção a preservar (pré-produção).
- Mudar qualquer schema/comportamento — o squash é **schema-neutro** (idêntico ao atual).
- Consolidar seeds num único arquivo.
