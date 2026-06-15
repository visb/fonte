# AUTORUN — Execução autônoma das stories 33–40 (curso bíblico: notas + associados: cobrança recorrente)

Protocolo para implementar, testar e commitar as stories `33`–`40` **sem intervenção humana**. As
decisões já estão travadas dentro de cada `NN-*.md` (seções "Decisões do usuário (travadas)") —
**não perguntar nada ao usuário**.

> Histórico de execuções anteriores (12–19, 21–25) está em `PROGRESS.md`. Não confundir.

## Prompt de início (colar e sair)

```
Modo autônomo. Siga C:\code\fonte\stories\AUTORUN.md à risca, sem me perguntar nada. Implemente tudo de 33 a 40 que for autonomamente possível; ao terminar cada story, rode os testes automatizados (unit + e2e), e com tudo verde faça merge --no-ff na main e siga para a próxima. ANTES de começar, arme o wakeup de fallback com ScheduleWakeup (seção "Limite de sessão", delay 1800s) e rearme-o a cada story. O que depender de credenciais/serviço externo (AbacatePay, Meta WhatsApp) que você não tem: implemente atrás de interface com mocks nos testes, marque BLOQUEADO em PROGRESS.md com o motivo, e siga — não invente chaves, não chame API real, não dê push. Estou saindo.
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
- **Não travar a fila**: se uma story bloquear (dependência externa, etc.), registrar em
  `PROGRESS.md`, pular e seguir.
- **Plataforma**: Windows / PowerShell (Bash tool disponível p/ scripts POSIX).

## Stories e o que são

| # | Tipo | Implementar? |
|---|------|--------------|
| 33 | **Epic** curso bíblico notas | NÃO codar o arquivo; coordena 34/35. Fecha quando 34+35 verdes. |
| 34 | Catálogo de módulos do curso bíblico (backend + adm) | SIM — totalmente autônomo |
| 35 | Lançamento de notas prova/trabalho (backend + adm) | SIM — totalmente autônomo |
| 36 | **Epic** associados cobrança recorrente | NÃO codar o arquivo; coordena 37–40. |
| 37 | Backend `associate` + CRUD adm | SIM — totalmente autônomo |
| 38 | Integração AbacatePay (cartão recorrente, gross-up, webhook) | PARCIAL — ver "Dependências externas" |
| 39 | WhatsApp Meta Cloud API + scheduler 9h | PARCIAL — ver "Dependências externas" |
| 40 | App público `associados` (página de pagamento) | PARCIAL — depende de 38 |

## Ordem (respeita dependências)

```
34 → 35   (epic 33)
37 → 38 → 40 → 39   (epic 36)
```

- **34 antes de 35**: 35 referencia os módulos do catálogo de 34.
- **37 base** do epic 36. **38** depende de 37. **40** consome o checkout de 38. **39** envia o
  link da página de 40 e usa o status que 38 grava.

## Branches — uma por story, mergeada na main ao fechar

Como cada story é mergeada na main assim que fica verde, usar **uma branch por story**, sempre
criada da `main` ATUAL (que já tem o merge da story anterior):

```
git switch main
git switch -c feat/story-NN-<slug>
```

- 34 → `feat/story-34-curso-biblico-catalogo`
- 35 → `feat/story-35-curso-biblico-notas`
- 37 → `feat/story-37-associados-backend`
- 38 → `feat/story-38-associados-abacatepay`
- 40 → `feat/story-40-associados-app`
- 39 → `feat/story-39-associados-whatsapp`

> Cada branch parte da main atualizada, então 35 já enxerga 34, 38 já enxerga 37, etc. — as
> dependências entre stories ficam resolvidas pelo merge sequencial.
> A branch antiga `feat/curso-biblico-notas` (só tinha o plano, já mergeada) **não é usada**.

- Um commit por story: `feat(story-NN): <título curto>` (ou vários coesos se a story for grande).
- Sempre rodar hooks; co-author `Claude Opus 4.8 <noreply@anthropic.com>`.
- Merge na main (após testes verdes): `git switch main && git merge --no-ff feat/story-NN-<slug>
  -m "merge: story NN — <título>"`. Sem push. Não deletar a branch.

## Dependências externas — o que fazer SEM credenciais (não perguntar, não inventar)

Não há chaves de AbacatePay nem de Meta WhatsApp neste ambiente. Regra geral: **implementar a
lógica e os contratos atrás de interface clara, com testes usando MOCK**; nunca chamar API real,
nunca inventar chave, nunca commitar segredo. Marcar a parte que exige serviço externo como
BLOQUEADO em `PROGRESS.md` com o motivo e o que falta (chave X, conta sandbox Y, template Z).

### Story 38 (AbacatePay) — premissa bloqueante

1. Tentar **confirmar via doc** (tool `WebFetch`/`WebSearch` na doc oficial do AbacatePay) se há
   cartão de crédito + assinatura recorrente + webhook + tabela de taxas. Registrar o achado em
   `PROGRESS.md`.
2. **Se confirmado**: implementar `AbacatePayClient` (interface + impl HTTP) conforme a doc,
   `computeGrossUp` (pura, 100% testável), service de subscribe, webhook idempotente, endpoints
   públicos. Testes com client **mockado**. Sem chamar a API real (sem chave). Marcar a validação
   sandbox como pendente manual.
3. **Se NÃO confirmável** (doc inacessível, ou AbacatePay não tem recorrência de cartão):
   implementar só o que independe (`computeGrossUp`, entidades/migration já em 37, contratos,
   webhook handler genérico) e marcar a integração de assinatura como **BLOQUEADO** em
   `PROGRESS.md` (motivo: premissa não confirmada / sem chave). Não perguntar ao usuário.

### Story 39 (Meta WhatsApp)

- Implementar `WhatsAppClient` (interface + impl Meta Cloud API lendo env) + `associate-charge`
  scheduler (cron 9h, dedupe 5 dias, gatilhos adesão/reativação). Testes do scheduler com
  `WhatsAppClient` **mockado**. Envio real e template aprovado = **BLOQUEADO** (sem credencial
  Meta) — registrar em `PROGRESS.md`. O agendamento e a seleção de quem cobrar são testáveis sem
  Meta.

### Story 40 (app associados)

- Scaffold do novo app `apps/associados` (React + Vite, espelhando `adm.fonte`), registrar no
  workspace pnpm + script `dev:associados`/`build` no root. Implementar a página consumindo os
  contratos públicos de 38 via `@fonte/api-client`. Tokenização de cartão do AbacatePay =
  componente isolado; se 38 estiver BLOQUEADO, deixar o ponto de tokenização atrás de interface com
  TODO claro e a UI/fluxo prontos. DoD autônomo: **`pnpm --filter associados build` verde + lint**.

## Bootstrap de serviços (uma vez, no início, em background)

Backend + adm cobrem 34/35/37. (40 é build, não precisa dev server; 38/39 backend.)

1. `pnpm install` (se necessário)
2. `pnpm docker:up`
3. `pnpm test:setup` — db de teste + seed
4. `pnpm build:types && pnpm build:api-client` — **obrigatório** antes de subir API/adm (sem o
   `dist/` de `@fonte/api-client` a suíte adm inteira quebra)
5. **API teste** (background): `pnpm dev:api:test` (porta 3001). Esperar healthcheck antes de testar.
6. **adm teste** (background): `pnpm --filter adm.fonte dev:test` (porta 5174). Esperar responder.

## Por cada story (dentro do sub-agente)

a. Ler `stories/NN-*.md` **inteiro** (e o epic-pai). Implementar exatamente o descrito.
b. Se tocou `packages/types` / `packages/api-client`, rodar os builds correspondentes.
c. Se adicionou dependência npm, instalar com `pnpm --filter <app> add <pkg>` conferindo compat.
d. Atualizar/adicionar os testes da seção **Validação** da story (sem `skip`/`only`/`xfail` sem
   justificativa no código — dependência externa SEM credencial é justificativa válida; mockar).
e. Atualizar `fonte-api.postman_collection.json` se a story mudar endpoints.
f. Rodar os testes **automatizados** da story (unit + e2e), usando os serviços já no ar:
   - Backend: `pnpm test:api` **e** `pnpm test:api:e2e` (sempre os dois — unit + e2e)
   - adm: `pnpm test:adm` filtrando pelo spec da story
   - app novo (40): `pnpm --filter associados build` + lint (+ e2e Playwright se houver)
g. Corrigir até os testes da story passarem (sem regressão na suíte tocada).
h. `git add` apenas arquivos da story + testes + postman; `git commit` na convenção.
i. **Merge na main**: `git switch main && git merge --no-ff feat/story-NN-<slug> -m "merge: story
   NN — <título>"`. Resolver conflito se houver. Sem push, não deletar a branch.
j. Devolver ao orquestrador: arquivos tocados, testes rodados (unit+e2e), hash do merge, BLOQUEIOS.

## Registro de progresso

Manter `stories/PROGRESS.md` (nova seção "stories 33–40"). Após cada story, anexar:

```
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — <timestamp> — <bloqueio se houver>
```

Fonte de verdade para retomar após resumo de contexto / reinício / reset de limite: **git log +
PROGRESS.md**. Stories já commitadas (`feat(story-NN)`) = feitas; pular.

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
   - `reason` = `"fallback AUTORUN stories 33-40: retoma se a sessao tiver batido o limite"`.
2. **Refrescar a cada story commitada**: chamar `ScheduleWakeup` de novo (mesmos parâmetros) ao
   fechar cada story. Em operação normal nunca dispara à toa; se o limite estourar no meio, o
   último wakeup armado dispara depois (~30 min) e retoma.
3. **Salvar estado sempre**: progresso em `PROGRESS.md` + tudo commitado (cada story = checkpoint).
4. **Ao acordar** (wakeup disparou): reler `PROGRESS.md` + `git log`, identificar a próxima story
   não commitada na ordem `34 → 35 → 37 → 38 → 40 → 39`, continuar do passo "Por cada story".
   - Se ainda falhar por limite (reset não chegou): **rearmar** o fallback (passo 1) e dormir de
     novo — não desistir, não insistir em loop apertado.
   - Se voltou a funcionar: rearmar o fallback e seguir.

> Objetivo: a fila sobrevive a um esgotamento de limite no meio — já tem a continuação **armada de
> antemão**, reprograma sozinha e fecha quando o limite voltar.

## Epics (33, 36) — caso especial

- **Não** disparar sub-agente para implementar `33-*.md` nem `36-*.md` (são coordenadores).
- O epic "fecha" quando suas filhas estão commitadas (ou registradas BLOQUEADO). Ao fechar cada
  epic, anexar uma linha-resumo em `PROGRESS.md`.

## Bloqueios

- Não parar a fila. Registrar motivo + o que falta em `PROGRESS.md`, pular para a próxima.
- Dependência externa sem credencial (AbacatePay/Meta) = BLOQUEADO esperado, **não** é falha do
  agente: entregar o máximo testável com mock e seguir.

## Proibido

Push, abrir PR, deletar trabalho não criado pelo agente, pular testes sem justificativa, inventar
chaves/segredos, chamar API externa real, perguntar qualquer coisa ao usuário. (Merge na main É
permitido e esperado, por story, após testes verdes — sem push.)

## Ao terminar

Escrever resumo final em `PROGRESS.md`: o que passou, o que ficou BLOQUEADO e por quê (com o que
o usuário precisa prover: chaves AbacatePay/Meta, template aprovado, conta sandbox), branches e
commits, comandos exatos para reproduzir. Deixar os serviços de pé.
