# Plan: Atividades — visual do responsável no card

## Context

Follow-up da story 48 (`done/48-atividades-kanban.md`). Item 4 do BACKLOG: quando um card tem
**responsável atribuído**, mostrar isso com um visual mais adequado — por exemplo um ícone
"person" com o nome — em vez de só texto cru (ou nada).

Hoje o `ActivityCard` da 48 já carrega `responsible` (Staff com nome) no payload, mas a exibição é
mínima. Esta story é puramente de **apresentação**.

### Decisões travadas (defaults automáticos do modo auto — revisar se desejado)

- **Escopo: `adm.fonte` + `ops.fonte`.** Os dois apps renderizam `ActivityCard`; a melhoria visual
  é barata e consistente nos dois. Sem backend.
- **Visual: avatar com iniciais + nome.** Avatar circular com as iniciais do responsável (ou ícone
  `person`/`User` do lucide quando não dá para derivar iniciais) seguido do nome. Reaproveitar
  componente de avatar existente no app se houver; senão um componente pequeno na feature.
- **Sem responsável → estado claro.** Card sem responsável mostra ícone `person` esmaecido +
  rótulo "Sem responsável" (em vez de espaço vazio), reforçando que `rascunho`/`solicitações`
  podem não ter responsável.
- **Sem mudança de dados.** `responsible` (nome) já vem do backend; nada de novo no contrato.

## Desenho

Mudança **somente frontend** (apresentação).

### adm.fonte (`apps/adm.fonte/src/features/activities/`)

- Novo `components/ResponsibleBadge.tsx` (ou bloco extraído): recebe `responsible?` e renderiza
  avatar (iniciais) + nome, ou o estado "sem responsável". <150 linhas, responsabilidade única.
- `ActivityCard.tsx` usa o badge no rodapé/canto do card. Reusar avatar compartilhado se existir
  em `components/shared/`.

### ops.fonte (`apps/ops.fonte/features/activities/`)

- Componente equivalente `ResponsibleBadge.tsx` (RN): ícone `person` + nome (avatar de iniciais se
  já houver primitivo no app; senão só ícone + nome). Usado no `ActivityCard` mobile.

## Validação

- Sem backend → `pnpm test:api` e Postman não mudam.
- `pnpm --filter adm.fonte build` (typecheck). Smoke adm: card com responsável mostra avatar+nome;
  card sem responsável mostra estado esmaecido.
- ops: typecheck/compila; smoke visual se emulador disponível.
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
  nenhum código novo entra sem teste. Cobrir com unit o `ResponsibleBadge` nos dois estados (com
  responsável → avatar+nome; sem responsável → estado esmaecido) e a derivação de iniciais. Rodar
  o runner de cobertura do `adm.fonte`; **não reduzir** a cobertura da feature `activities`. Sem
  `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Trocar/atribuir responsável a partir do card (isso é fluxo de aprovação/edição já existente).
- Foto real de avatar (usar iniciais/ícone; upload de foto não faz parte).
- Comentários (item 2 restante / story 65) e histórico (item 3 restante / story 66).
