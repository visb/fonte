# Plan: Sidebar do adm.fonte com scroll próprio

## Context

No `adm.fonte`, quando a janela não tem altura suficiente para exibir todos os itens da
sidebar, a `<aside>` estoura a viewport: o rodapé com **Meu Perfil** e **Sair** é empurrado
para fora da tela e só aparece se o usuário rolar o corpo da página. O efeito é pior para
`ADMIN`, que enxerga todos os links (Dashboard, Casas, Filhos, Servos, Grupos de Apoio,
Curso Bíblico, Mensagens, Atividades, Eventos, Faturamento + submenu aberto, Importar,
Contas a Pagar, Configurações + submenu aberto, Backup) — com os dois submenus expandidos a
lista passa de 20 linhas.

Causa: em `apps/adm.fonte/src/components/layout/AppLayout.tsx:245`, a `<nav>` é
`flex-1 p-4 space-y-1`, sem `overflow-y-auto` nem `min-h-0`. Em um flex container coluna
(`aside` dentro de `div.flex.h-screen`), o `min-height: auto` padrão impede a `<nav>` de
encolher abaixo do conteúdo, então ela transborda e desloca o bloco de rodapé
(`AppLayout.tsx:340`).

Decisão travada: **header e footer da sidebar ficam fixos; apenas a lista de links rola.**
O topo (`adm.fonte` + toggle de tema + botão fechar no mobile) e o rodapé (Meu Perfil / Sair)
permanecem sempre visíveis; a `<nav>` ganha barra de rolagem própria quando necessário.

```
┌──────────────────────┐
│ adm.fonte    🌙  ✕   │ ← fixo
├──────────────────────┤
│ Dashboard          ▲ │
│ Casas              █ │ ← rola
│ Filhos             █ │
│ ...                ▼ │
├──────────────────────┤
│ 👤 Meu Perfil        │ ← fixo
│ ⏻  Sair              │
└──────────────────────┘
```

Vale para desktop (`md:relative`) e mobile (`fixed inset-y-0`), já que ambos usam a mesma
`<aside>` e a mesma altura de viewport.

## Desenho

Arquivo único: `apps/adm.fonte/src/components/layout/AppLayout.tsx`.

1. **`<nav>`** (linha ~245): adicionar `min-h-0 overflow-y-auto` às classes existentes
   (`flex-1 p-4 space-y-1`). `min-h-0` é o que autoriza o item flex a encolher abaixo do
   conteúdo; `overflow-y-auto` transfere o excedente para a barra de rolagem interna.
2. **Header da sidebar** (`div` de linha ~222) e **footer** (`div` de linha ~340): adicionar
   `shrink-0` para que nunca sejam comprimidos quando a nav pede espaço.
3. Nenhuma mudança de estrutura, de rota ou de estado — só classes utilitárias do Tailwind.
   Sem novo componente, sem alteração no comportamento dos submenus.

Não mexer no `<main>` (linha ~390): ele já tem `overflow-auto` e continua rolando de forma
independente.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
sem justificativa explícita no código.

- **Unit (Vitest + RTL) — `apps/adm.fonte/src/components/layout/AppLayout.test.tsx`** (novo):
  - renderiza o layout autenticado como `ADMIN` e verifica que o elemento `<nav>` carrega
    as classes `min-h-0` e `overflow-y-auto`;
  - verifica que os blocos de header e footer da sidebar carregam `shrink-0`;
  - verifica que **Meu Perfil** e **Sair** continuam no documento (não foram movidos para
    dentro da área rolável);
  - regressão de comportamento existente: clique em **Sair** chama `logout` e navega para
    `/login`; submenus Faturamento/Configurações continuam abrindo e fechando.
  - Runner: `pnpm test:adm:unit` (cobertura via `pnpm test:cov:all` / runner de cobertura do
    `adm.fonte`, mantendo o patamar de 90% do escopo tocado).
- **E2E (Playwright) — `apps/adm.fonte/e2e/layout.spec.ts`** (novo):
  - login como `ADMIN`, `page.setViewportSize({ width: 1280, height: 600 })` (altura baixa,
    suficiente para estourar a lista com os submenus expandidos);
  - expandir Faturamento e Configurações;
  - assertar que o link **Sair** está visível (`toBeVisible`) **sem** rolar a página;
  - assertar que o `<body>`/container raiz não ganhou scroll vertical
    (`scrollHeight <= clientHeight`);
  - assertar que a `<nav>` tem `scrollHeight > clientHeight` (ou seja, o excedente foi
    para o scroll interno) e que rolar a nav não move o rodapé.
  - Pré-requisitos: `pnpm test:setup` + `pnpm dev:api:test` + `pnpm dev:adm` na 5174.
    Runner: `pnpm test:adm`.
- **Build/tipos**: `pnpm --filter adm.fonte build` (ou `rtk tsc`) sem erros.

## Fora de escopo

- Sidebar colapsável / modo ícone.
- Reordenar, agrupar ou reduzir os itens do menu para caber na tela.
- Estilizar a barra de rolagem (scrollbar customizada).
- Mesma correção em `portal.fonte`, `ops.fonte` ou `app.fonte` — `portal.fonte` não tem
  sidebar autenticada e os apps Expo usam navegação nativa.
- Persistir o estado de scroll ou de abertura dos submenus entre navegações.
