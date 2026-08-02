# Plan: datas relativas nos e2e de eventos (bomba-relógio de data fixa)

## Context

`services/api/test/events.e2e-spec.ts:192` (`GET /events/internal returns only INTERNAL events`)
começou a falhar **sozinho, sem ninguém tocar no código** — foi detectado em 2026-08-02 durante a
rodada 153-154, e verificado na `main` limpa.

**Causa raiz.** O helper `validBody()` (`events.e2e-spec.ts:48-53`) crava
`startAt: '2026-08-01T18:00:00.000Z'`. O `EventService.listInternal`
(`src/modules/event/event.service.ts:129`) filtra `e.start_at >= :now`, ou seja, **só eventos
futuros**. Enquanto "hoje" era antes de 2026-08-01, o evento criado pelo teste era futuro e
aparecia na listagem; a partir de 2026-08-02 ele virou passado e o endpoint — corretamente — parou
de devolvê-lo. O teste não pegou nenhuma regressão: ele apodreceu.

Repare que a asserção da linha 191 (`every(... === 'INTERNAL')`) continua verde e os outros três
testes da mesma rota (permissões ADMIN/COORDINATOR/SERVANT, 403 para RELATIVE, 401 sem token)
passam. **O endpoint está saudável e em uso** — `ops.fonte` o consome via tile "Eventos internos"
do dashboard (`QuickActions.tsx:60` → `app/(app)/events/index.tsx` → `useInternalEvents` →
`api.events.listInternal`). Foi levantada a hipótese de que a rota fosse morta; ela **não é** (a
story 117 removeu eventos internos só do `adm.fonte` e registrou explicitamente que backend e
`api-client` permanecem porque o ops usa).

**Não é um caso isolado.** A varredura por literais de data nos e2e achou **9 ocorrências em 3
arquivos**: `events.e2e-spec.ts` (7), `events-invite.e2e-spec.ts` (1), `events-payment.e2e-spec.ts`
(1). Toda data fixa num teste que compara com `now()` é uma falha agendada — as outras vão
detonar conforme o calendário avança. É isso que a story conserta, não só a linha 192.

### Decisões travadas

1. **Datas relativas ao `now()` do teste, não literais.** `validBody()` passa a derivar
   `startAt` de `new Date(Date.now() + N * DIA)`. Nenhuma data de evento futuro fica hardcoded.
2. **Helpers nomeados e explícitos**, não aritmética solta espalhada: criar no spec (ou num helper
   compartilhado de `test/`) algo como `daysFromNow(n: number): string` devolvendo ISO. O teste
   deve ler "daqui a 30 dias", não `'2026-08-01T18:00:00.000Z'`.
3. **Testes que precisam de evento passado usam `daysFromNow(-n)`** — hoje o par upcoming/past
   (`events.e2e-spec.ts:284,291`) depende do calendário para separar os dois grupos; passa a
   depender do sinal do offset.
4. **Escopo é a suíte de eventos** (`events.e2e-spec.ts`, `events-invite.e2e-spec.ts`,
   `events-payment.e2e-spec.ts`). Varrer outros e2e atrás do mesmo padrão **é bem-vindo e deve ser
   relatado**, mas corrigir fora de eventos fica para story própria — evita um diff gigante.
5. **Nada muda em `src/`.** O comportamento do `listInternal` (só futuros) está **certo** e é o que
   o ops espera; quem está errado é o teste. Se a implementação mudasse, a tela do ops passaria a
   listar evento vencido.
6. **Margem folgada nos offsets.** Usar dias (ex.: +30), não minutos, para que a suíte não fique
   sensível a fuso, relógio da máquina ou execução lenta.

Encosta em [[94-internal-events]] (criou o endpoint e este spec) e [[117-remover-eventos-internos-navbar-adm]]
(removeu a tela do adm e registrou que o backend permanece). Não depende de nenhuma story em aberto.

## Desenho

1. **`test/events.e2e-spec.ts`**
   - Adicionar o helper de data relativa (`daysFromNow`).
   - `validBody()` passa a usar `daysFromNow(30)` em `startAt`.
   - Trocar os demais literais: o `endAt` inválido da linha 113 (que só precisa ser *anterior* ao
     `startAt` → `daysFromNow(29)`), o "Evento anterior" da linha 264 (ordenação ascendente →
     `daysFromNow(15)`, mantendo-o antes do `validBody()`), e o par upcoming/past (linhas ~284/291)
     usando offsets de sinais opostos.
   - Conferir que o teste de ordenação continua provando **ordenação**, não coincidência de datas.
2. **`test/events-invite.e2e-spec.ts` e `test/events-payment.e2e-spec.ts`** — mesmo tratamento no
   literal de cada um.
3. **Considerar extrair o helper para `test/` compartilhado** se os três arquivos o repetirem; se
   ficar em um só, duplicar é aceitável — não criar abstração para dois usos.
4. Sem mudança de rota, DTO, service ou schema ⇒ **sem alteração no
   `fonte-api.postman_collection.json`** e **sem migration**.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado.

- **`pnpm test:api:e2e`** — a suíte de eventos inteira verde, incluindo a linha 192 que hoje falha.
  Pré-requisito: `pnpm test:setup` + `pnpm dev:api:test` (porta 3001).
- **Casos a cobrir / o que o teste prova:**
  - `GET /events/internal` devolve o evento INTERNAL criado pelo próprio teste (a asserção que
    hoje falha) **e** só eventos INTERNAL;
  - a ordenação ascendente por `start_at` continua provada por datas relativas, não por literais;
  - o filtro `upcoming` devolve só `start_at >= now` e o `past` só `start_at < now`, agora
    ancorados em offsets de sinal oposto e não no calendário;
  - as validações de erro que dependem de ordem de datas (`endAt` antes de `startAt` → 400)
    continuam 400.
- **`pnpm test:api`** — sem regressão nos unit (não deve haver: nada em `src/` muda).
- **Prova anti-regressão da própria story (obrigatória):** rodar a suíte de eventos com o relógio
  do sistema adiantado (ou com o offset base do helper deslocado para simular meses no futuro) e
  confirmar que ela continua verde. É o que prova que a bomba-relógio foi desarmada, e não apenas
  reagendada para a próxima data fixa.
- **Relatar** (sem corrigir) quaisquer outros e2e fora de eventos com literais de data que a
  varredura encontrar — insumo para a story seguinte.

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
> nenhum código novo entra sem teste. Rodar `pnpm test:api:cov`; **não reduzir** a cobertura dos
> módulos afetados. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).
> Observação: esta story é test-only, então a cobertura de `src/` deve ficar **inalterada** — se
> mudar, algo saiu do escopo.

## Fora de escopo

- Mudar o comportamento do `listInternal` / dos filtros de data do `EventService` — a implementação
  está correta (decisão 5).
- Corrigir literais de data em e2e fora da suíte de eventos (decisão 4) — story própria.
- Introduzir mock/freeze de relógio global (`jest.useFakeTimers`, `@sinonjs/fake-timers`) nos e2e:
  são testes contra API HTTP real, onde congelar o relógio do processo de teste não afeta o
  servidor. Datas relativas resolvem sem essa complexidade.
- Reavaliar se `/events/internal` deve existir — **existe e está em uso pelo `ops.fonte`**.
- Limpeza/seed do DB de teste entre suítes.
