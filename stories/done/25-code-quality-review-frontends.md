# Plan: Review de code quality e correção de gaps (frontends)

## Context

O padrão de arquitetura dos frontends foi **codificado** na skill `fonte-frontend` (`.claude/skills/fonte-frontend/SKILL.md`): **vertical slices** (`features/<domínio>/{hooks,pages,components,constants,lib}`) + **MVVM** (Model = `@fonte/types`/`@fonte/api-client`/constants/lib; ViewModel = hooks; View = pages/components). O `CLAUDE.md` lista os anti-padrões proibidos (fetch em page, query-key literal, `useState` em form, cast manual de erro, estados ad-hoc, componente > ~150 linhas, prop drilling em dialog).

Esta story faz um **review de code quality** dos apps frontend contra esse padrão e **corrige todos os gaps** encontrados. Atividade pedida pelo usuário:

> "crie um novo branch a partir da feat/template-editor-melhorias e faça um review de code quality e corrija todos os gaps que encontrar. Faça commits parciais. Não faça merge com main nem pull request."

## Escopo

- **Apps**: `apps/adm.fonte`, `apps/ops.fonte`, `apps/app.fonte`.
- **Camada compartilhada quando o gap for evidente**: `packages/api-client` (fetch duplicado que deveria estar aqui), `packages/types`.
- **Fora de escopo**: backend `services/api` (tem skill/regras próprias), mudança de comportamento de feature, redesign visual. Só **qualidade** — sem alterar o que a tela faz.

## Branch e commits

- Criar branch **`chore/code-quality`** a partir de `feat/template-editor-melhorias`.
- **Commits parciais**: um commit por eixo/domínio coeso (ex.: `refactor(adm-residents): page nao faz fetch (MVVM)`, `refactor(ops): extrai query-keys literais`). Não um commit gigante.
- **Não** fazer merge com `main` nem abrir PR. Trabalho fica local na branch.
- Convenção de commit: `refactor(<area>): <o que>` / `fix(<area>): <o que>`; co-author `Claude Opus 4.8 <noreply@anthropic.com>`.

## O que procurar (checklist de gaps)

### A. Conformidade vertical-slice / MVVM
- [ ] **Page faz fetch**: `useQuery`/`useMutation`/`useForm` importado direto numa `pages/*`. → mover para hook do slice (ViewModel); page só orquestra.
- [ ] **Query key literal**: `queryKey: ['algo']` fora de `lib/queryKeys.ts`. → centralizar.
- [ ] **`useState` para campo de form**: → `react-hook-form` + `zod` (RN: `Controller`).
- [ ] **Regra de negócio / fetch em componente de apresentação**: → subir para hook; componente recebe props/callbacks.
- [ ] **Cross-slice import**: `features/A` importando `features/B/{hooks,components,lib}` internos. → subir o comum p/ `components/shared`, `src/lib`/`lib`, ou `@fonte/api-client`.
- [ ] **Dialog com prop drilling** de dados que só ele usa. → dialog busca via hook `{ enabled: open }`.
- [ ] **Estado de loading/empty/error ad-hoc** (ActivityIndicator/Text solto). → componentes de estado compartilhados.

### B. Reuso / simplificação
- [ ] Fetch HTTP duplicado entre apps que deveria viver em `@fonte/api-client`.
- [ ] Código morto / import não usado / componente órfão.
- [ ] Helper repetido em vários slices → subir para `lib` compartilhado.

### C. Tipos / robustez
- [ ] `any` / cast manual `(x as any)` evitável; usar `getErrorMessage` para erro de API.
- [ ] Componente > ~150 linhas ou com múltiplas responsabilidades visuais → quebrar (extrair item de lista/header/card).

## Como executar

1. **Mapear** cada gap por app/slice com `grep`/leitura (não confiar de memória). Sugestões de varredura:
   - Pages que importam `useQuery`/`useMutation`/`useForm`: `grep -rn "use\(Query\|Mutation\|Form\)" apps/*/**/pages`.
   - Query-key literais: `grep -rn "queryKey:\s*\[" apps` e comparar com `lib/queryKeys.ts`.
   - `useState(` perto de inputs em arquivos com `<form`/`TextInput`.
   - Cross-slice: `grep -rn "features/" apps/<app>/src/features/<slice>` apontando para outro slice.
2. **Priorizar** A (conformidade) > C (tipos/tamanho) > B (reuso). Corrigir em lotes coesos, commit por lote.
3. **Cada lote**: corrigir → rodar validação do app afetado → commit parcial.
4. **Não** mudar comportamento: refactor preserva a saída da tela. Se um gap exigir mudança de comportamento, **registrar** em `PROGRESS.md` e não aplicar (fica fora de escopo).

## Testes / validação (Definition of Done)

- `apps/adm.fonte`: `pnpm --filter adm.fonte build` verde; `pnpm test:adm` (suíte existente) sem regressão.
- `apps/ops.fonte` / `apps/app.fonte`: `pnpm --filter ops.fonte exec tsc --noEmit` e `pnpm --filter app.fonte exec tsc --noEmit` limpos.
- `packages/api-client` (se tocado): `pnpm build:api-client`.
- Nenhum teste novo de feature é exigido (é refactor); os testes existentes **devem continuar verdes**. Sem `skip`/`only`/`xfail`.

## Verificação manual

1. Subir `pnpm dev:adm` e navegar 2-3 telas refatoradas — comportamento idêntico ao anterior.
2. Conferir que nenhuma page importa `useQuery/useMutation/useForm` (grep limpo).
3. Conferir que `git log` da branch tem commits parciais coesos e que **não** houve merge/PR.

## Refinamentos pendentes (decisões)

1. ✅ **Escopo = frontends** (adm/ops/app) + camada compartilhada quando óbvio. Backend fora.
2. ✅ **Só qualidade, sem mudar comportamento**. Gap que exija mudança de comportamento → registrar e pular.
3. ✅ **Branch `chore/code-quality` a partir de feat/template-editor-melhorias; commits parciais; sem merge/PR.**
4. Profundidade: priorizar A>C>B; se o volume de gaps for grande, fechar por app (adm primeiro) e registrar o restante em `PROGRESS.md` para um segundo passe — não deixar a branch num estado meio-refatorado sem build verde.
