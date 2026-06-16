# AUTORUN — Execução autônoma das stories 44–55 (associados: overview/autocancel/tela · contas a pagar · atividades kanban · epic de cobertura de testes)

Protocolo para implementar, testar e commitar as stories `44`–`55` **sem intervenção humana**. As
decisões já estão travadas dentro de cada `NN-*.md` (seções "Decisões do usuário (travadas)") —
**não perguntar nada ao usuário**.

> Histórico de execuções anteriores (12–19, 21–25, 33–41) está em `PROGRESS.md`. Não confundir.

## Prompt de início (colar e sair)

```
Modo autônomo. Siga C:\code\fonte\stories\AUTORUN.md à risca, sem me perguntar nada. Implemente tudo de 44 a 55 que for autonomamente possível; ao terminar cada story, rode os testes automatizados (unit + e2e) e, com a suíte tocada TODA verde, faça merge --no-ff na main e siga para a próxima. ANTES de começar, arme o wakeup de fallback com ScheduleWakeup (seção "Limite de sessão", delay 1800s) e rearme-o a cada story. O que depender de credencial/serviço externo (Meta WhatsApp) que você não tem: implemente atrás de interface com mocks nos testes, marque BLOQUEADO em PROGRESS.md com o motivo, e siga — não invente chaves, não chame API real, não dê push. Estou saindo.
```

---

## Princípios

- **Contexto limpo por story**: para cada story, disparar um sub-agente novo via tool `Agent`
  (`subagent_type: general-purpose`). O orquestrador **não** implementa no próprio contexto — só
  coordena, sobe serviços e dispara um sub-agente por vez.
  - **Se o spawn falhar por limite de sessão** ("You've hit your session limit") → seção **Limite
    de sessão**: a retomada já está armada (wakeup de fallback); não tentar em loop.
- **Nenhum app rodado manualmente**: o orquestrador sobe docker, API teste, adm teste.
- **Sem push / sem PR**, mas **COM merge na main por story** (decisão do usuário): cada story, ao
  ficar verde, é mergeada na `main` local antes de seguir para a próxima. Sem push (usuário sobe
  depois).
- **Testes verdes = critério de conclusão (DoD, epic 49)**: nenhum merge na main sem a suíte
  tocada inteira verde. "Testes passando" é condição de fechamento da story — não só dos casos
  novos, mas sem regressão no que a mudança tocou.
- **Não travar a fila**: se uma story bloquear (dependência externa, etc.), registrar em
  `PROGRESS.md`, pular e seguir.
- **Plataforma**: Windows / PowerShell (Bash tool disponível p/ scripts POSIX).

## Stories e o que são

| # | Tipo | Implementar? |
|---|------|--------------|
| 44 | Overview de faturamento dos associados (agregação backend + tela adm; split de rotas `/associados` overview ↔ `/associados/lista`) | SIM — totalmente autônomo |
| 45 | Link de autocancelamento da assinatura no lembrete WhatsApp (3º+ lembrete) + página pública `/cancelar/:token` no app `associados` | PARCIAL — envio Meta sem credencial (mock); código completo e testável |
| 46 | Melhorias na tela de associados: detalhe (adesão + histórico, só front), máscara WhatsApp, scroll infinito = **paginação real** no backend | SIM — totalmente autônomo |
| 47 | **Contas a Pagar** — módulo `payable` (backend NestJS) + grupo "Financeiro" no adm (ADMIN) | SIM — greenfield full-stack autônomo |
| 48 | **Atividades** — board Kanban (backend + adm + ops), escopo por casa, 6 colunas | SIM — autônomo; ver "Dependências externas" (ops é RN) |
| 49 | **EPIC** cobertura de testes | **TEM código próprio** (não é coordenador puro): editar `.claude/skills/fonte-workflow/SKILL.md` (padrão de testes) + `.claude/skills/issue/SKILL.md` (toda issue futura atualiza testes) + reservar scripts raiz `test:*` (`test:adm:unit`, `test:associados`(+`:e2e`), `test:ops:unit`/`:e2e`, `test:app:unit`/`:e2e`, `test:api-client`) e agregador `test:all`; este AUTORUN já exige suíte verde antes do merge. Depois coordena 50–55 e fecha quando todas verdes. |
| 50 | Auditoria + gaps de teste do `services/api` (jest unit + supertest e2e) | SIM — autônomo |
| 51 | Unit tests do `adm.fonte` (Vitest + RTL + jsdom) | SIM — autônomo |
| 52 | Testes do app `associados` (Vitest unit + Playwright e2e web) | SIM — autônomo |
| 53 | Testes do `ops.fonte` (jest-expo unit + Playwright contra export web) | SIM — autônomo (sem emulador) |
| 54 | Testes do `app.fonte` (jest-expo unit + Playwright contra export web) | SIM — autônomo (sem emulador) |
| 55 | Unit tests do `@fonte/api-client` (Vitest, transporte HTTP mockado) | SIM — autônomo |

## Ordem (respeita dependências)

```
44 → 46 → 45            (associados — epic 36)
47                      (contas a pagar — standalone)
48                      (atividades kanban — standalone)
49(epic+código) → 55 → 51 → 52 → 50 → 53 → 54   (cobertura de testes — epic 49)
```

- **44 antes de 46/45**: 44 faz o split de rotas (`/associados` overview, `/associados/lista`
  lista) e renomeia `AssociatesPage`→`AssociatesListPage`; 46 só então incrementa a página da
  lista (detalhe + scroll infinito) sobre o nome já renomeado. 45 (autocancel) é independente dos
  outros dois — fecha o trio.
- **47 e 48** são greenfield independentes; vêm depois dos associados.
- **Epic 49 por último**: 49 primeiro entrega seu código (skills + scripts + este AUTORUN), depois
  as filhas. Ordem das filhas conforme a story 49: **55** (api-client, base de todos os fronts) e
  **51** (adm unit) primeiro porque destravam o padrão Vitest reusado por **52** (associados);
  **50** (gaps do backend) depois, já enxergando os módulos novos `payable`/`activity` (47/48)
  mergeados; **53/54** (Expo web) por último por exigirem o setup de export web + Playwright.

## Branches — uma por story, mergeada na main ao fechar

Como cada story é mergeada na main assim que fica verde, usar **uma branch por story**, sempre
criada da `main` ATUAL (que já tem o merge da story anterior):

```
git switch main
git switch -c <prefixo>/story-NN-<slug>
```

- 44 → `feat/story-44-associados-overview`
- 46 → `feat/story-46-associados-tela-melhorias`
- 45 → `feat/story-45-associados-autocancelamento`
- 47 → `feat/story-47-contas-a-pagar`
- 48 → `feat/story-48-atividades-kanban`
- 49 → `test/story-49-cobertura-epic` (skills + scripts raiz + este AUTORUN)
- 55 → `test/story-55-api-client`
- 51 → `test/story-51-adm-unit`
- 52 → `test/story-52-associados`
- 50 → `test/story-50-api-gaps`
- 53 → `test/story-53-ops-web`
- 54 → `test/story-54-app-web`

> Cada branch parte da main atualizada, então as dependências entre stories ficam resolvidas pelo
> merge sequencial (46/45 já enxergam 44; o epic de testes já enxerga 44–48).

- Um commit por story: `feat(story-NN): <título>` para features (44–48) e `test(story-NN): <título>`
  para as filhas de teste (50–55). Vários commits coesos se a story for grande.
- Sempre rodar hooks; co-author `Claude Opus 4.8 <noreply@anthropic.com>`.
- Merge na main (após suíte verde): `git switch main && git merge --no-ff <prefixo>/story-NN-<slug>
  -m "merge: story NN — <título>"`. Sem push. Não deletar a branch.

## Dependências externas — o que fazer SEM credenciais (não perguntar, não inventar)

Regra geral: **implementar a lógica e os contratos atrás de interface clara, com testes usando
MOCK**; nunca chamar API real, nunca inventar chave, nunca commitar segredo. Marcar a parte que
exige serviço externo como BLOQUEADO em `PROGRESS.md` com o motivo e o que falta.

### Story 45 (autocancelamento via WhatsApp) — envio Meta bloqueado (igual story 39)

Não há credencial Meta WhatsApp neste ambiente. Implementar:

- A **contagem de streak** (lembretes desde a última cobrança `PAID`) e o gatilho do 3º+ lembrete
  no `AssociateChargeScheduler` — 100% testável com `Repository<AssociateCharge>` real (db de
  teste) e `WhatsAppClient` **mockado**.
- O **segundo botão de URL** (link de cancelamento) no `WhatsAppClient`/payload — testar a montagem
  do payload (botão de pagamento + botão de cancelar) com o cliente mockado; Meta nunca é chamada.
- A **página pública `/cancelar/:token`** no app `associados` (resolve pelo `payment_token`
  existente) + o **endpoint público de cancelamento** no backend — testáveis por build/tsc (app) e
  unit/e2e com gateway mockado (backend).
- **BLOQUEADO** (registrar em `PROGRESS.md`): envio real Meta + **novo template aprovado** com os
  dois botões de URL (sem credencial/template). Anotar o nome do template a preencher em
  `META_WA_TEMPLATE_NAME` e que o formato dos `components` pode precisar de ajuste ao template real.

### Story 48 (Atividades Kanban) — parte `ops.fonte` (React Native) sem emulador

- Backend + adm: 100% autônomos (api unit + e2e; adm build/tsc + Playwright do board).
- ops.fonte: implementar a tela do board em RN; validar por **`tsc --noEmit`** + sem regressão no
  build dos demais. O e2e **mobile nativo** (Maestro/emulador) é bloqueio de infra recorrente
  (ver PROGRESS 19/25) — **não bloquear a story por isso**. O e2e **web** do ops só passa a existir
  na story 53; em 48 a validação do ops é estática (tsc) + a feature web roda depois. Registrar a
  verificação do board no device como pendência manual.

## Bootstrap de serviços (uma vez, no início, em background)

Backend + adm cobrem 44/46/47/48(adm)/50/51/55. App `associados` (45/52) e Expo web (53/54) são
build/export por story.

1. `pnpm install` (se necessário)
2. `pnpm docker:up`
3. `pnpm test:setup` — db de teste + seed
4. `pnpm build:types && pnpm build:api-client` — **obrigatório** antes de subir API/adm (sem o
   `dist/` de `@fonte/api-client` a suíte adm inteira quebra). Rebuildar de novo sempre que a story
   tocar `packages/types` ou `packages/api-client`.
5. **API teste** (background): `pnpm dev:api:test` (porta 3001). Esperar healthcheck antes de testar.
6. **adm teste** (background): `pnpm --filter adm.fonte dev:test` (porta 5174). Esperar responder.

## Por cada story (dentro do sub-agente)

a. Ler `stories/NN-*.md` **inteiro** (e o epic-pai quando houver). Implementar exatamente o descrito.
b. Se tocou `packages/types` / `packages/api-client`, rodar os builds correspondentes.
c. Se adicionou dependência npm, instalar com `pnpm --filter <app> add <pkg>` conferindo compat
   (Vitest/RTL/jsdom no Vite instalado; jest-expo na major que o `expo` corrente recomenda).
d. Atualizar/adicionar os testes da seção **Validação** da story (sem `skip`/`only`/`xfail` sem
   justificativa no código — dependência externa SEM credencial é justificativa válida; mockar).
e. Atualizar `fonte-api.postman_collection.json` se a story mudar endpoints (44/45/46/47/48 mexem
   no backend; as filhas de teste 50–55 normalmente não mudam endpoint).
f. Rodar os testes **automatizados** da story, usando os serviços já no ar:
   - Backend: `pnpm test:api` **e** `pnpm test:api:e2e` (sempre os dois — unit + e2e)
   - adm: `pnpm test:adm` filtrando pelo spec da story; unit (após 51) `pnpm test:adm:unit`
   - associados: `pnpm --filter associados build` + `pnpm test:associados` (após 52)
   - ops/app: `pnpm test:ops:unit`/`pnpm test:app:unit` (jest-expo) + e2e web Playwright contra
     `expo export --platform web` (após 53/54). Maestro nativo é opcional, não é gate.
   - api-client (55): `pnpm test:api-client` + `pnpm build:api-client`
g. Corrigir até a suíte tocada passar **inteira** (casos novos + sem regressão). Suíte verde é
   pré-requisito do merge (DoD, epic 49).
h. `git add` apenas arquivos da story + testes + postman; `git commit` na convenção
   (`feat(story-NN)` para 44–48, `test(story-NN)` para 50–55).
i. **Merge na main**: `git switch main && git merge --no-ff <prefixo>/story-NN-<slug> -m "merge:
   story NN — <título>"`. Resolver conflito se houver. Sem push, não deletar a branch.
j. Devolver ao orquestrador: arquivos tocados, testes rodados (unit+e2e), hash do merge, BLOQUEIOS.

## Registro de progresso

Manter `stories/PROGRESS.md` (seção "stories 44–55"). Após cada story, anexar:

```
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <timestamp> — <bloqueio se houver>
```

Fonte de verdade para retomar após resumo de contexto / reinício / reset de limite: **git log +
PROGRESS.md**. Stories já commitadas (`feat(story-NN)` / `test(story-NN)`) = feitas; pular.

## Limite de sessão / continuação automática

**Por que proativo, não reativo.** Quando a conta bate o limite (`You've hit your session limit ·
resets <hora>`), toda inferência é bloqueada — o modelo **não consegue mais chamar
`ScheduleWakeup` naquele momento**. O único wakeup que sobrevive é o que **já estava armado antes**.
Por isso o fallback é armado no início e refrescado a cada story.

> Vale para o **limite de uso/sessão**. Encher a **janela de contexto** é outro caso — há
> auto-compactação e a execução segue sozinha.

### Passo a passo

1. **Armar o fallback logo no início** (antes da 1ª story), com `ScheduleWakeup`:
   - `delaySeconds` = `1800` (~30 min, escolha do usuário).
   - `prompt` = o sentinel literal **`<<autonomous-loop-dynamic>>`**.
   - `reason` = `"fallback AUTORUN stories 44-55: retoma se a sessao tiver batido o limite"`.
2. **Refrescar a cada story commitada**: chamar `ScheduleWakeup` de novo (mesmos parâmetros) ao
   fechar cada story. Em operação normal nunca dispara à toa; se o limite estourar no meio, o
   último wakeup armado dispara depois (~30 min) e retoma.
3. **Salvar estado sempre**: progresso em `PROGRESS.md` + tudo commitado (cada story = checkpoint).
4. **Ao acordar** (wakeup disparou): reler `PROGRESS.md` + `git log`, identificar a próxima story
   não commitada na ordem `44 → 46 → 45 → 47 → 48 → 49 → 55 → 51 → 52 → 50 → 53 → 54`, continuar
   do passo "Por cada story".
   - Se ainda falhar por limite (reset não chegou): **rearmar** o fallback (passo 1) e dormir de
     novo — não desistir, não insistir em loop apertado.
   - Se voltou a funcionar: rearmar o fallback e seguir.

> Objetivo: a fila sobrevive a um esgotamento de limite no meio — já tem a continuação **armada de
> antemão**, reprograma sozinha e fecha quando o limite voltar.

## Epic 49 — TEM código próprio (não é coordenador puro)

Diferente dos epics 33/36 (puros coordenadores), a story 49 entrega artefatos antes das filhas.
Disparar um sub-agente para implementar `49-*.md` (branch `test/story-49-cobertura-epic`):

1. **`.claude/skills/fonte-workflow/SKILL.md`** — documentar o padrão de testes: runner por tipo de
   workspace (Vitest web/packages, jest-expo nos Expo, jest+supertest no backend), onde ficam os
   arquivos (`*.test.ts(x)` ao lado do código nos fronts; `*.spec.ts` no backend), comandos
   `pnpm test:*`, regra "toda mudança atualiza os testes".
2. **`.claude/skills/issue/SKILL.md`** — toda issue futura DEVE criar/atualizar testes (unit + e2e
   quando houver fluxo); reforçar passo "Validar" + seção "Proibido"; DoD inclui suíte verde.
3. **Scripts raiz `package.json`** — reservar os nomes `test:adm:unit`, `test:associados`(+`:e2e`),
   `test:ops:unit`/`:e2e`, `test:app:unit`/`:e2e`, `test:api-client` e um agregador `test:all` que
   roda as suítes unit existentes (cresce conforme as filhas entram). Não quebrar `pnpm install`.
4. Confirmar que este `AUTORUN.md` exige suíte verde antes de qualquer merge (já exige — DoD).

Validar: `pnpm test:api` continua verde após mexer só em docs/skills/scripts (sem regressão).
Merge na main como qualquer story. **Só então** seguir para as filhas (55 → 51 → 52 → 50 → 53 → 54).

- O epic "fecha" quando as filhas 50–55 estão commitadas (ou registradas BLOQUEADO). Ao fechar,
  anexar uma linha-resumo em `PROGRESS.md`.

## Bloqueios

- Não parar a fila. Registrar motivo + o que falta em `PROGRESS.md`, pular para a próxima.
- Dependência externa sem credencial (Meta WhatsApp, story 45) = BLOQUEADO esperado, **não** é
  falha do agente: entregar o máximo testável com mock e seguir.
- e2e mobile nativo (Maestro/emulador) preso a infra (ops/app) = **não** é gate; usar unit
  jest-expo + e2e web. Não bloquear story por isso.

## Proibido

Push, abrir PR, deletar trabalho não criado pelo agente, pular testes sem justificativa, inventar
chaves/segredos, chamar API externa real, perguntar qualquer coisa ao usuário, mergear na main com
a suíte tocada vermelha. (Merge na main É permitido e esperado, por story, após suíte verde — sem
push.)

## Ao terminar

Escrever resumo final em `PROGRESS.md`: o que passou, o que ficou BLOQUEADO e por quê (com o que
o usuário precisa prover: credencial Meta + template aprovado com os dois botões de URL), branches
e commits, comandos exatos para reproduzir. Deixar os serviços de pé.
