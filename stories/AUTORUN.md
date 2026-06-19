# AUTORUN — protocolo de execução autônoma de stories

Protocolo para **implementar, testar e commitar** um lote de stories **sem intervenção humana**. As
decisões já estão travadas dentro de cada `stories/NN-*.md` (seção "Decisões travadas") — **não
perguntar nada ao usuário** durante a execução.

> Preencha os placeholders `{...}` ao iniciar uma rodada (quais stories, ordem, dependências).
> Histórico de execuções anteriores vive no `git log` + `stories/done/`. Estado da rodada corrente
> em `PROGRESS.md`.

## Prompt de início (colar e sair)

Iniciar com `/loop` **com intervalo fixo** (não auto-pacing). O harness redispara o prompt sozinho
a cada intervalo, independente do limite de sessão — disparo que cair no limite não faz nada e o
próximo (após o reset) retoma. Colar (ajustar a faixa de stories e a ordem):

```
/loop 30m Modo autônomo. Siga C:\code\fonte\stories\AUTORUN.md à risca, sem me perguntar nada. A cada disparo deste loop, releia stories/PROGRESS.md + git log e continue da próxima story NÃO commitada na ordem {ORDEM}. Se a sessão tiver batido o limite, não faça nada e aguarde o próximo disparo (após o reset) — não tente rearmar nada. Implemente tudo que for autonomamente possível; ao terminar cada story, rode os testes automatizados (unit + e2e) e, com a suíte tocada TODA verde, faça merge --no-ff na main e siga para a próxima. O que depender de credencial/serviço externo que você não tem: implemente atrás de interface com mocks nos testes, marque BLOQUEADO em PROGRESS.md com o motivo, e siga — não invente chaves, não chame API real, não dê push. Quando todas estiverem commitadas ou BLOQUEADAS, escreva o resumo final em PROGRESS.md e encerre o loop.
```

---

## Princípios

- **Contexto limpo por story**: para cada story, disparar um sub-agente novo via tool `Agent`
  (`subagent_type: general-purpose`). O orquestrador **não** implementa no próprio contexto — só
  coordena, sobe serviços e dispara um sub-agente por vez.
  - **Se o spawn falhar por limite de sessão** ("You've hit your session limit") → seção **Limite
    de sessão**: encerrar o turno sem fazer nada; o próximo disparo do `/loop` (após o reset)
    retoma sozinho. Não tentar rearmar nem insistir em loop apertado.
- **Nenhum app rodado manualmente**: o orquestrador sobe docker, API teste, adm teste.
- **Sem push / sem PR**, mas **COM merge na main por story** (padrão; ajustar se a rodada pedir
  outra coisa): cada story, ao ficar verde, é mergeada na `main` local antes da próxima. Sem push.
- **Protocolo "teste-antes-do-merge" (DoD)**: antes de **QUALQUER** merge na main — rodar a suíte
  da área tocada e exigir **tudo verde**. "Story concluída" = **implementada E testes verdes**
  (casos novos **e** sem regressão no que a mudança tocou). Suíte vermelha = não mergeia, corrige.
- **Não travar a fila**: se uma story bloquear (dependência externa, etc.), registrar em
  `PROGRESS.md`, pular e seguir — **a menos que** a ordem tenha dependência rígida (ver "Ordem").
- **Plataforma**: Windows / PowerShell (Bash tool disponível p/ scripts POSIX).

## Stories da rodada

Preencher ao iniciar:

| #   | Tipo / o que é | Implementar? |
| --- | --- | --- |
| {NN} | {descrição} | {SIM / depende de X} |

## Ordem e dependências

```
{NN → ... → MM}
```

- Declarar dependências rígidas. Se houver (story B consome contrato de A), a fila é **sequencial**:
  se A bloquear, B também fica bloqueada — registrar e **parar a fila**, não pular.
- Sem dependência rígida, pode reordenar por conveniência (ex: do mais isolado ao mais acoplado).

## Branches — uma por story, mergeada na main ao fechar

Cada branch parte da `main` ATUAL (já com o merge da story anterior):

```
git switch main
git switch -c {prefixo}/story-NN-{slug}
```

- Commitar o `.md` da story primeiro na branch: `docs(stories): plano da story NN — <título>`.
- Um ou mais commits coesos da implementação: `feat(story-NN): <título>`. Sempre rodar hooks;
  co-author `Claude Opus 4.8 <noreply@anthropic.com>` (ou o modelo corrente).
- Merge na main (após suíte verde): `git switch main && git merge --no-ff {prefixo}/story-NN-{slug}
  -m "merge: story NN — <título>"`. Sem push. Não deletar a branch.
- Arquivar a story: `git mv stories/NN-*.md stories/done/` + commit
  `docs(stories): arquiva story NN concluida em done/`.

## Dependências externas — o que fazer SEM credenciais (não perguntar, não inventar)

Regra geral: **implementar a lógica e os contratos atrás de interface clara, com testes usando
MOCK**; nunca chamar API real, nunca inventar chave, nunca commitar segredo. Pontos típicos
(pagamento, WhatsApp/Meta, storage/bucket, Sentry): mockar nos testes; marcar PENDENTE-MANUAL em
`PROGRESS.md` o que exige ambiente externo; não bloquear o código por falta de credencial.

## Cuidados específicos da rodada

Listar operações de risco médio (renomear app, mexer em CI/scripts, migration destrutiva, etc.) e
como validar cada uma. Preencher conforme as stories da rodada.

## Bootstrap de serviços (uma vez, no início, em background)

1. `pnpm install` (se necessário)
2. `pnpm docker:up`
3. `pnpm test:setup` — db de teste + seed
4. `pnpm build:types && pnpm build:api-client` — **obrigatório** antes de subir API/adm (sem o
   `dist/` de `@fonte/api-client` a suíte adm inteira quebra). Rebuildar sempre que a story tocar
   `packages/types` ou `packages/api-client`.
5. **API teste** (background): `pnpm dev:api:test` (porta 3001). Esperar healthcheck antes de testar.
   Rodar `migration:run:test` após criar migration nova.
6. **adm teste** (background): `pnpm --filter adm.fonte dev:test` (porta 5174). Esperar responder.

## Por cada story (dentro do sub-agente)

a. Ler `stories/NN-*.md` **inteiro**. Implementar exatamente o descrito.
b. Se tocou `packages/types` / `packages/api-client`, rodar os builds correspondentes.
c. Se criou migration, aplicá-la no db de teste (`migration:run:test`) antes do e2e.
d. Se adicionou dependência npm, instalar com `pnpm --filter <app> add <pkg>` conferindo compat.
e. Atualizar/adicionar os testes da seção **Validação** da story (sem `skip`/`only`/`xfail` sem
   justificativa no código — dependência externa SEM credencial é justificativa válida; mockar).
f. Atualizar `fonte-api.postman_collection.json` se a story mudar endpoints.
g. Rodar os testes **automatizados** da story (serviços já no ar):
   - Backend: `pnpm test:api` **e** `pnpm test:api:e2e` (sempre os dois).
   - adm: `pnpm test:adm:unit` + `pnpm test:adm` filtrando pelo spec da story.
   - portal: `pnpm --filter portal.fonte build` + `pnpm test:portal`(+`:e2e`).
   - ops/app: `pnpm test:ops:unit`/`pnpm test:app:unit` + e2e web Playwright (Maestro nativo é
     opcional, não-gate — bloqueio de infra recorrente).
h. Corrigir até a suíte tocada passar **inteira** (casos novos + sem regressão). Suíte verde é
   pré-requisito do merge (DoD).
i. `git add` apenas arquivos da story + testes + postman; `git commit` (`feat(story-NN)`).
j. **Merge na main**: `git switch main && git merge --no-ff {prefixo}/story-NN-{slug} -m "merge:
   story NN — <título>"`. Resolver conflito se houver. Sem push, não deletar a branch.
k. Arquivar: `git mv stories/NN-*.md stories/done/` + commit de arquivamento.
l. Devolver ao orquestrador: arquivos tocados, testes rodados (unit+e2e), hash do merge, BLOQUEIOS.

## Registro de progresso

Manter `stories/PROGRESS.md` (seção nova da rodada). Após cada story, anexar:

```
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>
```

Fonte de verdade para retomar após resumo de contexto / reinício / reset de limite: **git log +
PROGRESS.md**. Stories já commitadas (`feat(story-NN)`) = feitas; pular.

## Limite de sessão / continuação automática (via `/loop`)

**A continuação é responsabilidade do `/loop`, não do modelo.** A execução roda dentro de um
`/loop` com **intervalo fixo** (~30 min): o **harness** redispara o prompt a cada intervalo. Por
isso sobrevive ao limite de sessão sem o modelo precisar rearmar nada.

Quando a conta bate o limite (`You've hit your session limit · resets <hora>`), o disparo atual não
consegue fazer nada — **encerrar o turno sem ação**. O **próximo disparo do loop**, já depois do
reset, retoma sozinho.

> Vale para o **limite de uso/sessão**. Encher a **janela de contexto** é outro caso — há
> auto-compactação e a execução segue sozinha dentro do mesmo turno.

### A cada disparo do loop

1. **Reler estado**: `stories/PROGRESS.md` + `git log`. Stories com commit `feat(story-NN)` estão
   prontas; pular.
2. **Se a sessão estiver no limite**: não fazer nada, encerrar o turno. O harness redispara depois.
3. **Caso contrário**: identificar a próxima story NÃO commitada na ordem e executar do passo "Por
   cada story" (várias por turno se houver orçamento).
4. **Salvar estado sempre**: progresso em `PROGRESS.md` + tudo commitado (cada story = checkpoint).

### Encerrar o loop

Quando **todas** as stories da rodada estiverem commitadas ou registradas BLOQUEADO em
`PROGRESS.md`: escrever o resumo final (seção "Ao terminar") e **encerrar o loop** — não reagendar.

## Proibido

Push, abrir PR, deletar trabalho não criado pelo agente, pular testes sem justificativa, inventar
chaves/segredos, chamar API externa real, perguntar qualquer coisa ao usuário, mergear na main com
a suíte tocada vermelha. (Merge na main É permitido e esperado, por story, após suíte verde — sem
push.)

## Ao terminar

Escrever resumo final em `PROGRESS.md`: o que passou, o que ficou BLOQUEADO/PENDENTE-MANUAL e por
quê, branches e commits, comandos exatos para reproduzir. Deixar os serviços de pé.
