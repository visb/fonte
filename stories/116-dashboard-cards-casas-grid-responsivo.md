# Plan: Dashboard adm — cards de ocupação das casas em grid responsivo

## Context

No dashboard do `adm.fonte`, a seção "Ocupação das Casas" renderiza os cards numa
linha única com scroll horizontal. Em dispositivo de tela pequena isso vira uma barra
de rolagem horizontal ruim de usar — o operador não vê todas as casas de relance.

Objetivo: os cards devem **quebrar em várias linhas** em vez de rolar na horizontal,
mantendo pelo menos 2 por linha em tela pequena.

**Decisão travada (produto):** layout em **grid auto-fill por largura mínima** — não
breakpoints fixos. `grid` com `repeat(auto-fill, minmax(~10rem, 1fr))`: cabe quantos
cards a largura permitir, respeitando a largura mínima. Em tela pequena (~320–360px)
resulta em ~2 por linha; em telas largas preenche mais colunas automaticamente. Evita
cravar contagem de colunas por breakpoint.

Bloco compartilhado (dashboard adm) — item irmão: story 117 (remover menu "eventos
internos" da navbar). Independentes entre si.

## Desenho

Arquivos:

- `apps/adm.fonte/src/features/dashboard/pages/DashboardPage.tsx`
  - Trocar o container dos cards (hoje `className="flex gap-3 overflow-x-auto pb-1"`)
    por um grid auto-fill. Como Tailwind não tem util nativo pra `auto-fill minmax`,
    usar `grid gap-3` + `gridTemplateColumns` via `style`:
    `style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))' }}`.
  - Remover `overflow-x-auto` (não há mais scroll horizontal).

- `apps/adm.fonte/src/features/dashboard/components/HouseOccupancyCard.tsx`
  - Remover `shrink-0 w-40` da classe do `<button>` (largura fixa) — o card passa a
    ocupar a célula do grid (`w-full` implícito). Manter o resto do estilo (padding,
    border, hover, conteúdo) intacto.

Sem mudança de dados, hooks, rota ou API. É ajuste de layout puro.

## Validação

Frontend-only (`adm.fonte`). Nenhuma mudança de backend/contrato.

- **E2E (Playwright, `test:adm`):** o dashboard já é exercido no fluxo de login/home.
  Garantir que o smoke do dashboard continua passando (cards das casas visíveis,
  clique no card navega para `/houses/:id`).
- **Caso novo a cobrir:** com N casas (≥3), a seção "Ocupação das Casas" renderiza
  todos os cards sem overflow horizontal e o card continua clicável navegando para a
  casa. Se não houver spec de dashboard, adicionar/ajustar o menor spec que cubra isso.
- **Gate de cobertura:** código novo/alterado sem teste não fecha a story. Rodar o
  runner de cobertura do `adm.fonte`; sem `skip`/`only` injustificado. (Backend não
  foi tocado — `pnpm test:api:cov` não se aplica a esta story.)

Verificação manual complementar: abrir o dashboard em viewport estreito (~360px de
largura) e confirmar 2 cards por linha, sem barra de rolagem horizontal.

## Fora de escopo

- Redesenho do `HouseOccupancyCard` (conteúdo/estilo interno).
- Ordenação/filtro das casas no dashboard.
- Qualquer mudança na navbar (é a story 117).
