# Plan: card da listagem de filhos responsivo no mobile (`adm.fonte`)

## Context

Na listagem de filhos do `adm.fonte` (`ResidentsPage` → `ResidentCard`), cada card é uma linha
flex só: avatar | nome + metadados (casa, entrada, idade) | badges (status, Social, vencimento) |
botões (editar, menu de ações). No desktop funciona. No mobile os três blocos à direita do avatar
disputam a mesma linha estreita: o nome trunca cedo, os badges se espremem numa coluna própria e
os botões ficam no meio do card. Na prática viram 3 colunas apertadas lado a lado.

Pedido do usuário: *"melhorar o responsivo da listagem de filhos. no mobile, separar em 2
colunas (hoje está em 3), deixando os botões por último"*.

### Decisões travadas (usuário)

1. **Mobile em 2 colunas**: avatar na 1ª coluna e todo o conteúdo na 2ª.
2. **Botões por último**: editar e menu de ações vão para o fim do card, depois do texto e dos
   badges.

### Decisões de desenho (defaults assumidos no refino)

3. **Breakpoint `sm` (640px) do Tailwind.** Abaixo dele vale o layout novo; de `sm` para cima o
   card fica **idêntico ao de hoje** (sem regressão visual no desktop).
4. **Ordem na 2ª coluna (mobile)**: nome → metadados → badges → linha de botões alinhada à
   direita. Os badges saem da coluna própria e passam a quebrar linha (`flex-wrap`) abaixo dos
   metadados.
5. **Só CSS/estrutura do `ResidentCard`.** Mesmo DOM lógico, sem duplicar badges/botões por
   breakpoint (nada de `hidden sm:flex` com duas cópias), para não dobrar os alvos nos testes e
   leitores de tela. O reagrupamento é por wrapper + classes responsivas (grid/flex com `order`
   ou contêiner do conteúdo envolvendo badges e botões no mobile).
6. **Stretched link e `z-10` preservados.** O card inteiro continua clicável (abrir em nova aba);
   badge de vencimento e botões continuam acima do link.
7. **Componente fica abaixo de ~150 linhas** (CLAUDE.md). As funções de cálculo
   (`getNextDueInfo`, `getPaymentBadge`, `computeAge`, `formatLocalDate`) podem ir para
   `features/residents/utils.ts` se a mudança empurrar o arquivo além do limite; extrair
   `ResidentCardBadges` / `ResidentCardActions` se ajudar a leitura.

---

## Desenho

`apps/adm.fonte/src/features/residents/components/ResidentCard.tsx`:

```
mobile (< sm)                         desktop (≥ sm) — inalterado
┌──────┬──────────────────────────┐   ┌──────┬──────────────┬─────────┬──────┐
│avatar│ Nome                     │   │avatar│ Nome         │ badges  │ ✎  ⋮ │
│      │ casa · entrada · idade   │   │      │ casa · ...   │         │      │
│      │ [Ativo] [Vence 10/11]    │   └──────┴──────────────┴─────────┴──────┘
│      │                   ✎   ⋮  │
└──────┴──────────────────────────┘
```

- Raiz: avatar alinhado ao topo no mobile (`items-start`), `sm:items-center` no desktop.
- 2ª coluna no mobile agrupa info, badges e botões; em `sm` os badges e botões voltam a ser
  irmãos à direita, com `shrink-0` como hoje.
- `ResidentsPage` não muda.

Sem backend, sem contratos, sem Postman.

---

## Validação

### `adm.fonte`: unit (`pnpm test:adm:unit`)

`ResidentCard.test.tsx` (existente) continua verde e ganha:

- badges e botões aparecem **uma vez só** no DOM (sem cópia por breakpoint);
- a ordem no DOM do conteúdo é nome → metadados → badges → botões (garante "botões por último"
  no fluxo de leitura/tab);
- badge de vencimento continua link para `?tab=contributions` e o editar para `/edit`, ambos
  acima do stretched link (`z-10`);
- regras de permissão do menu (remover/excluir por role) inalteradas.

Se houver extração de utils/subcomponentes, os testes existentes de cálculo de vencimento e idade
acompanham o código para o novo arquivo.

### `adm.fonte`: e2e (`pnpm test:adm`)

No spec de filhos (ou `layout.spec.ts`, que já usa viewport mobile), com viewport 390×844:

- o card do filho do seed não causa scroll horizontal na página;
- a caixa dos botões (editar/ações) fica **abaixo** do nome (`boundingBox().y` maior) e o
  editar continua clicável e navega para a edição;
- em viewport desktop (1280) os botões ficam na mesma linha do nome (sem regressão).

Somente leitura sobre o seed (story 182).

### Gate de cobertura (trava a story)

Código novo ou alterado sem teste não fecha a story. Rodar `pnpm test:adm:unit` com cobertura:
**não reduzir** a cobertura de `features/residents`. Sem `skip`/`only`/`xfail` sem justificativa
explícita no código.

---

## Fora de escopo

- Outras listagens (servos, familiares, casas) — mesmo padrão pode ser aplicado depois.
- Filtros (`ResidentsFilters`) e `PageHeader` no mobile.
- Mudar conteúdo do card (campos, badges, ações) ou o layout desktop.
- `ops.fonte` / `app.fonte`.
