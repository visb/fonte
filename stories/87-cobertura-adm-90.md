# Plan: Cobertura `adm.fonte` 80.02% → **90%** statements (sub-fases por feature)

> Filha do epic **85**. O maior esforço da rodada: ~1286 statements a cobrir. Sub-fases por feature
> (87a, 87b, …) — cada uma checkpoint commitável/mergeável que sobe a catraca, como o climbing da 80.

## Context

A story 80 levou o adm a 80.02% (10314/12888 statements; branches 83.78 / functions 81.5 / lines
80.02) com a catraca em 80. Faltam ~1286 statements para 90% — o maior denominador do monorepo.
A primeira passada cobriu o grosso de hooks/libs e muitos componentes; o que resta são **branches de
render e submit ainda descobertos** espalhados pelas features.

### Decisões travadas (herdadas do epic 85)

- TESTES-ONLY: nenhuma mudança de produção. Refactor mínimo de testabilidade (extrair lógica de tela
  p/ hook/lib) só se citado no commit.
- Mock central do `@fonte/api-client` via `@/lib/api` (helper `src/test/utils.tsx` já existente) —
  reusar. Forms: rhf+zod.
- Catraca sobe a cada sub-fase ao valor atingido; trava em statements:90 ao fechar; nunca desce.
- Honestidade: manter as exclusões de orquestração da 80 (`src/**/pages/**`, `App`/`AppLayout`,
  editores TipTap+menus, `AvatarUpload`, `src/test/**`). **Não ampliar** para inflar — nova exclusão
  é re-baseline com comentário justificando.

## Desenho — sub-fases (checkpoints; medir com `pnpm test:adm:unit:cov` e atacar o maior gap)

Quebrar por feature/área, fechando os branches descobertos de cada uma. Ordem por gap de statements
(reavaliar a cada checkpoint):

- **87a** residents (tabs/forms/dialogs restantes) + houses.
- **87b** payables/billing + financeiro.
- **87c** events + support-groups + associates + census.
- **87d** messages + notifications + bible-courses.
- **87e** settings (não-editor) + backup + dashboard + auth + shared restante.

Cada sub-fase: branches de loading/empty/error, variantes de badge/card/linha, ramos condicionais de
form (rhf+zod), submit válido/inválido, callbacks. Componentes de apresentação puros com asserts
reais (RTL: rótulos/valores formatados, singular/plural, links de arquivo).

> Arquivos de editor pesado (TipTap/ProseMirror, `AvatarUpload`) seguem excluídos — DOM de browser
> indisponível no jsdom; comportamento é E2E. Não forçar unit de fumaça neles.

## Validação

- `pnpm test:adm:unit:cov` — **≥ 90% statements**, sem regressão de branches/functions/lines vs 80.
- E2E Playwright (`pnpm test:adm`) dos fluxos tocados não regride.

### Casos a cobrir

Por feature: estados loading/empty/error de cada lista/detalhe; variantes de badge/status;
ramos condicionais de form (campos que aparecem/somem por tipo/role); submit válido muta + inválido
bloqueia (zod); callbacks de editar/excluir/navegar; formatação (moeda/data/máscara, singular/plural).

> **Gate de cobertura (trava a story):** todo branch novo coberto tem assert real — nenhuma exclusão
> nova sem comentário, nenhum teste de fumaça sem assert. Rodar `pnpm test:adm:unit:cov`; **não
> reduzir** statements/branches/functions/lines; catraca do adm sobe para 90 (via sub-fases) e não
> desce. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Editores TipTap + `AvatarUpload` (orquestração de browser — E2E).
- Pages (orquestração — E2E, já excluídas).
- Mudança de produção/contrato. Outros pacotes (cada um na sua filha).
