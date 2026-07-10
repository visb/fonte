# Runbook: retomar o import em lote dos filhos (crédito Anthropic esgotado)

> **Status: PENDENTE — aguardando recarga de crédito na key Anthropic.**
> Não é uma story de código: é o registro de uma migração de dados em andamento,
> parada por falta de crédito. O runner e todo o estado NÃO estão no repo — vivem
> junto dos dados, em `Documents/Fonte de Misericórdia/Filhos/_import/`.

## Context

Migração do acervo histórico de filhos pra **PRODUÇÃO** (Railway) a partir da planilha
de referência + 1202 fichas `.docx`. Feita por um script headless que bate nos MESMOS
endpoints do import em lote da UI (`parse-spreadsheet` → `check-files` →
`parse-docx-with-spreadsheet` → `check-conflict` → `commit`) e replica o
`buildCommitPayloadFromPreview` do `adm.fonte`. Roda contra `pnpm dev:api` local (que
aponta pra prod). Cada ficha `.docx` passa por 1 extração `claude-sonnet-4-6` usando a
`ANTHROPIC_API_KEY` do `services/api/.env` — isso é inevitável (ficha é texto livre).

## Estado em 2026-07-10

| | Qtd |
|---|---|
| Importados na prod (resident + familiares + contribuições + foto) | **341** |
| Já cadastrados antes (pulados sem IA) | 34 |
| Conflito — já existiam por nome/CPF (GUILHERME FERREIRA DOURADOS, Alexsander de Ramos) | 2 |
| **Pendentes (falharam)** | **71** |
| Sem ficha (filho na planilha sem `.docx`) | 91 |

**Por que parou:** a key Anthropic ficou **sem crédito** após ~340 extrações
(`"Your credit balance is too low"`). Das 71 pendentes: 68 = sem crédito · 2 = bug
`weight` float→int (já corrigido no runner) · 1 = erro 500 no commit (reprocessa).

## Como retomar

Tudo (runner + checkpoint + logs + relatório) está em
`Documents/Fonte de Misericórdia/Filhos/_import/`. Passos completos em
`_import/RESUME-IMPORT.md`. Resumo:

1. Recarregar crédito na `ANTHROPIC_API_KEY` do `services/api/.env`.
2. `pnpm dev:api` (raiz do monorepo).
3. JWT ADMIN do adm.fonte (`localStorage.getItem('fonte_token')`).
4. Na pasta `_import`: `FONTE_TOKEN="<jwt>" node import-runner.mjs run`
   — o checkpoint pula os 341 feitos e retenta só os 71.

O checkpoint (`_import/import-checkpoint.json`) é o que torna o resume seguro e
idempotente. **Não apagar.** O runner já indexa `Fichas/` + `Fichas/done/`, então roda
correto mesmo com as 377 fichas já movidas pra `done/`.

## Fora de escopo

- Não há mudança de código no monorepo. O bug latente `weight/height must be integer`
  (a UI também falharia com peso float extraído pela IA) pode virar uma story própria
  depois; aqui foi contornado só no runner.
