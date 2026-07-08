# Plan: adm — remover a superfície "Eventos internos" (navbar + página dedicada)

## Context

O `adm.fonte` tem um menu "Eventos internos" na navbar (visível a todo Staff, inclusive
SERVANT) que abre uma listagem só-leitura de eventos com `audience=INTERNAL`
(story 94). A gestão de eventos já vive em `/eventos` (Eventos), acessível a
ADMIN/COORDINATOR. A listagem dedicada de internos no adm é redundante e o produto
pediu para removê-la.

**Escopo decidido (produto):** remover a **feature inteira de "eventos internos" no
adm.fonte** — o link da navbar, a rota, a página read-only e o encanamento
exclusivo dela (hook `useInternalEvents`, card, query key). Não é só esconder o link.

**Decisões travadas / o que NÃO muda:**

- **Backend e `@fonte/api-client` ficam intactos.** O `ops.fonte` consome
  `GET /events/internal` via `api.events.listInternal` (tem `InternalEventsPage` e
  `useInternalEvents` próprios). Mexer nisso quebraria o ops. Endpoint, service,
  controller e `contracts.test` do api-client permanecem.
- **`audience=INTERNAL` permanece.** Eventos ainda podem ser marcados como internos no
  `EventForm` (select "Tipo de evento" em `/eventos`). Só some a **listagem dedicada**
  no adm — quem gere eventos internos continua fazendo por `/eventos`.

Bloco compartilhado (dashboard/adm) — item irmão já refinado: story 116. Independentes.

## Desenho

Remover, em `apps/adm.fonte/src`:

- `components/layout/AppLayout.tsx` — bloco do `<Link to="/eventos-internos">`
  (o `{isStaff && (…)}` das linhas ~313–318). Remover import de ícone que fique órfão
  (o `CalendarDays` ainda é usado pelo link "/eventos", então mantém).
- `App.tsx` — a `<Route path="eventos-internos" …>` (linha ~110) e o
  `import { InternalEventsPage }` (linha ~41).
- `features/events/pages/InternalEventsPage.tsx` e `InternalEventsPage.test.tsx` — apagar.
- `features/events/components/InternalEventCard.tsx` — apagar (só a página usava).
- `features/events/hooks/useEvents.ts` — remover a função `useInternalEvents`
  (linhas ~17–23). Manter todo o resto (`useEvents`, `useEventById`, mutations…).
- `features/events/hooks/useEvents.test.tsx` — remover o caso de teste de
  `useInternalEvents` (~linha 47) e o import correspondente.
- `lib/queryKeys.ts` — remover `queryKeys.events.internal` (só o hook removido usava).
  Confirmar por busca que não sobrou referência no adm.

Após remover, garantir que `EventForm`, `EventsPage` e o resto da feature `events`
seguem compilando (não dependem de nada removido).

## Validação

Frontend-only (`adm.fonte`). Backend e api-client não são tocados.

- **Build/type:** `pnpm build` do adm (ou `tsc`) sem erro de import órfão após as
  remoções.
- **Vitest (`adm.fonte`):** suíte da feature `events` verde após remover os testes de
  `InternalEventsPage`/`useInternalEvents`. Nenhum teste remanescente referencia os
  símbolos apagados.
- **E2E (Playwright, `test:adm`):** o smoke de navegação não deve mais encontrar o item
  "Eventos internos"; ajustar/remover qualquer asserção de E2E que dependa desse menu
  ou da rota `/eventos-internos`. A rota `/eventos` (gestão) continua funcionando.
- **Caso a cobrir:** a navbar renderizada para um Staff (incl. SERVANT) **não** contém
  "Eventos internos"; navegar para `/eventos` segue OK.
- **Gate de cobertura:** como a story é majoritariamente remoção, o gate se cumpre
  mantendo a suíte verde e sem `skip`/`only` injustificado; não introduzir código novo
  sem teste. `pnpm test:api:cov` não se aplica (backend intocado).

Verificação manual: logar como SERVANT e como ADMIN, confirmar ausência do menu e que
`/eventos` continua acessível a ADMIN/COORDINATOR.

## Fora de escopo

- Backend `event` (endpoint `GET /events/internal`, service, controller) — permanece.
- `@fonte/api-client` `events.listInternal` e seus contracts — permanecem (ops usa).
- Eventos internos no `ops.fonte` — intocados.
- Campo `audience` / opção INTERNAL no `EventForm` — permanece.
- Remoção do conceito de "evento interno" do domínio — não é isto.
