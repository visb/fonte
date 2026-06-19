# Plan: melhorias na tela de associados (detalhe, máscara WhatsApp, scroll infinito)

## Context

Três pedidos sobre a tela de gestão de associados (`adm.fonte`, role ADMIN),
agrupados numa story só por decisão do usuário (bundle, branch única, commits
coesos por tema):

1. **Detalhe do associado** — ao clicar numa linha da lista, abrir detalhe
   mostrando **data de adesão** e **histórico de contribuições**.
2. **Máscara de WhatsApp** no formulário de associado.
3. **Scroll infinito** na listagem.

Decisões travadas com o usuário:

- **Scroll infinito = paginação real no backend.** Hoje `GET /associates` retorna
  TODOS os associados sem paginação (`findAll` → `order: { createdAt: 'DESC' }`).
  Vamos adicionar paginação por `limit`/`offset` no endpoint e `useInfiniteQuery`
  no frontend. Não é lazy-render só no cliente.
- **Backend do detalhe já existe.** `GET /associates/:id` (`findOne`) já devolve
  `AssociateDetail` = associado + `subscription` + `charges[]` (histórico). A
  **data de adesão é `createdAt`** do associado. Logo o detalhe é trabalho 100%
  frontend — reaproveita o hook `useAssociateById` já presente.
- **WhatsApp é E.164** (`+5562999998888`, validado por regex no
  `associateSchema`). Cadastro é da comunidade local → assume-se Brasil (`+55`).
  A máscara é de exibição/digitação; o valor submetido continua E.164. **Sem nova
  dependência** de máscara (não há lib de mask instalada nem helper de telefone
  no `adm.fonte`) — helper próprio pequeno.

## Desenho

### Parte 1 — Paginação no backend (scroll infinito)

**`services/api`**

- `AssociateService.findAll` passa a aceitar `{ limit, offset }` e retornar
  `{ items: AssociateListItem[]; total: number }`.
  - `repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset })`.
  - Mantém o enriquecimento com `lastCharge` por item (só da página atual).
- `AssociateController.findAll` recebe `@Query()` com DTO de paginação
  (`limit`, `offset`) validado por `class-validator` (`@IsInt`, `@Min`, `@Max`,
  `@Type` para coerção). Defaults: `limit=20`, `offset=0`, `limit` máx. 100.
- Atualizar `fonte-api.postman_collection.json` (query params + novo response).

**`packages/types`**

- Novo `PaginatedAssociates { items: AssociateListItem[]; total: number }`.
  (ou genérico `Paginated<T>` se já não existir equivalente — checar antes;
  se não existir, manter específico para não inflar contrato).

**`packages/api-client`**

- `associates.list` passa a aceitar `params?: { limit?; offset? }` e retornar
  `PaginatedAssociates`. Repassa via `http.get('/associates', { params })`.

**`adm.fonte`**

- `useAssociates` → `useInfiniteAssociates` com `useInfiniteQuery`:
  - `queryFn: ({ pageParam }) => api.associates.list({ limit, offset: pageParam })`.
  - `getNextPageParam`: `offset+limit < total ? offset+limit : undefined`.
  - `queryKey: queryKeys.associates.all` (mantém invalidação existente).
- `AssociatesPage` achata `data.pages` em uma lista. Sentinela no fim da `Table`
  com `IntersectionObserver` (hook `useInfiniteScroll` reutilizável em
  `components/shared/` ou `hooks/`) que chama `fetchNextPage` quando visível e
  `hasNextPage`. Mostrar `LoadingState`/spinner de rodapé em `isFetchingNextPage`.
- Mutations (`create`/`delete`/`cancel`) continuam invalidando
  `queryKeys.associates.all` — funciona com infinite query.

### Parte 2 — Detalhe do associado

**`adm.fonte`** (sem backend)

- Linha da lista clicável → abre `AssociateDetailDialog` (não fazer prop drilling:
  dialog recebe só `associateId`/`open`/`onClose` e busca via `useAssociateById`,
  `{ enabled: open }`).
- Conteúdo do dialog:
  - **Data de adesão**: `createdAt` formatado pt-BR.
  - Dados-resumo: status (badge existente), contribuição, dia de vencimento.
  - **Histórico de contribuições**: tabela das `charges` (data de vencimento
    `dueDate`, valor bruto `grossAmount`, status, `paidAt` quando houver),
    ordenadas como vêm (createdAt DESC). `EmptyState` se vazio.
- Novo badge de status de cobrança: `ChargeStatusBadge` + labels/variants em
  `constants.ts` (`ChargeStatus`: PENDING/PAID/FAILED).
- Extrair item da tabela de cobranças (`ChargeRow`) se passar de item trivial
  (regra de decomposição do CLAUDE.md).
- Abertura: clique na `AssociateRow` abre o detalhe; os botões de ação
  (editar/cancelar/excluir) param a propagação (`stopPropagation`) para não
  abrir o detalhe junto.

### Parte 3 — Máscara de WhatsApp

**`adm.fonte`**

- Helper de máscara BR em `features/associates/lib/` (ex.: `whatsappMask.ts`):
  - `formatWhatsapp(e164: string): string` → `+55 (62) 99999-8888` para exibição.
  - `toE164(masked: string): string` → digitos → `+55XXXXXXXXXXX`.
- No `AssociateForm`, o campo WhatsApp usa `Controller` ou `onChange` que aplica
  máscara na exibição e grava E.164 no form. `associateSchema` (regex E.164)
  permanece a fonte de verdade da validação — o valor validado/submetido é E.164.
- `reset`/edição: formata o E.164 vindo do associado ao popular o campo.

## Validação

- Backend: `pnpm test:api` verde. Atualizar/garantir testes de `AssociateService`
  (`findAll` paginado: `take/skip`, shape `{ items, total }`) e do controller/DTO
  de paginação. E2E `associates-payment`/`associates` se tocados.
- adm: ajustar/rodar `apps/adm.fonte/e2e/associates.spec.ts` (lista paginada,
  abrir detalhe, máscara). `pnpm test:adm` do spec.
- `pnpm build:types` e `pnpm build:api-client` após mexer nos contratos.
- Postman atualizado para `GET /associates` paginado.

## Fora de escopo

- Filtro/busca de associados na listagem.
- Paginação cursor-based (offset basta para o volume atual).
- Exportar histórico de contribuições.
- Internacionalização da máscara (assume-se Brasil/+55).
- Alterar o backend do detalhe (já pronto).
