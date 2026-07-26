# Runbook: retomar o import em lote dos filhos

> **✅ CONCLUÍDA (2026-07-26).** Import em lote 100% finalizado direto em produção
> pelo Claude Code (sem `ANTHROPIC_API_KEY`). Resultado: todas as fichas novas +
> readmissões (via `admissions`) + `commit-missing` (`#SemFicha`) importadas;
> `Fichas/done/` = 1177, `Fichas/` topo = 0. Johnatan Batista de Faria resolvido
> (500 era data inválida `2026-04-31` na planilha, não bug de backend). Detalhes na
> memória `project-bulk-import-filhos`.
>
> **Código NÃO commitado por decisão do dono:** os 2 endpoints auxiliares
> (`import/extract-docx-raw`, `import/match-extracted`), o DTO `match-extracted`,
> os testes, a coleção Postman e a skill `fonte-import-filhos` foram ferramentas
> descartáveis desta migração única e ficam apenas no working tree (não serão usados
> de novo). O runner/estado vive fora do repo, em `Documents/.../Filhos/_import/`.

> **Status (2026-07-23): DESBLOQUEADO — não depende mais de crédito Anthropic.**
> A extração da ficha agora é feita PELO Claude Code (sem `ANTHROPIC_API_KEY`).
> Ver skill **`fonte-import-filhos`** (`.claude/skills/`) para o runbook completo do
> novo fluxo de 3 fases (`prep` → extração no Claude Code → `commit`).
> O texto abaixo é o registro histórico da rodada de 2026-07-10 (IA no backend).
> O runner e todo o estado vivem junto dos dados, em
> `Documents/Fonte de Misericórdia/Filhos/_import/`.

## Novo fluxo sem API key (2026-07-23)

Backend ganhou 2 endpoints sem IA: `import/extract-docx-raw` (texto+imagens da ficha)
e `import/match-extracted` (cross-match do já-extraído). O runner (`import-runner.mjs`)
ganhou os modos `prep` e `commit`. Escopo real: **825 fichas pendentes** em `Fichas/`
(as 377 de `done/` já foram). Importar todas — as ~70 que casam a planilha entram ricas,
as ~755 restantes como ARCHIVED só-ficha. Passo a passo e regras de extração na skill.

---

## Registro histórico (rodada 2026-07-10, IA no backend)

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
