# AUTORUN — protocolo de execução autônoma de stories

Protocolo **estável e round-agnóstico** para **implementar, testar e commitar** um lote de
stories **sem intervenção humana**. As decisões já estão travadas em cada `stories/NN-*.md`
(seção "Decisões travadas") — **não perguntar nada ao usuário** durante a execução.

> **Este arquivo não muda entre rodadas.** O que muda (quais stories, ordem, dependências,
> cuidados) vive no **ledger da rodada** (`stories/PROGRESS.md`). Como uma unidade é implementada
> (codificar + gates + commit) é responsabilidade do agent **`fonte-implementer`** — este protocolo
> só **orquestra**: escolhe a próxima story, dispara o agent, mergeia na main e atualiza o ledger.

Forma de iniciar: skill **`/autorun`** (encapsula o loop) — ver `.claude/skills/autorun`. O texto
abaixo é o protocolo que a skill executa; pode também ser colado num `/loop` manualmente.

---

## Config da rodada (NÃO fica aqui — fica no ledger)

Cada rodada declara sua config no **topo do `stories/PROGRESS.md`** (schema no template do próprio
ledger) — preencher ao abrir a rodada: tema, ordem, branch base, deps rígidas, e os **cuidados**
(migrations, contratos `packages/types`/`api-client`, Postman, dependências externas sem
credencial, gate de cobertura). Fonte de verdade para retomar: **git log + o ledger**. Story com
commit `feat(story-NN)` = feita; pular.

---

## Princípios

- **Um spawn por story, contexto limpo:** para cada story, disparar o agent `fonte-implementer`
  (tool `Agent`). O orquestrador **não** codifica no próprio contexto — só coordena, sobe serviços,
  dispara um agent por vez, mergeia e registra.
  - **Se o spawn falhar por limite de sessão** ("You've hit your session limit"): encerrar o turno
    sem ação; o próximo disparo do `/loop` (após o reset) retoma sozinho. Não rearmar nada.
- **Merge na main por story (padrão), sem push, sem PR:** cada story, ao ficar verde, é mergeada na
  `main` local antes da próxima (`--no-ff`). Branches preservadas.
- **Teste-antes-do-merge (DoD):** antes de **qualquer** merge — suíte da área tocada **toda verde**
  (casos novos **e** sem regressão) **e** cobertura ≥ 90 no pacote tocado. Vermelho ou cobertura
  abaixo = não mergeia; devolve ao agent pra corrigir. "Story concluída" = implementada **E** verde.
- **Não travar a fila:** story bloqueada (dep externa etc.) → registrar `BLOQUEADO` no ledger, pular
  e seguir — **exceto** dep rígida declarada (se A bloquear, B da cadeia também bloqueia; não pular B).
- **Sem credencial:** implementar a lógica atrás de interface + **mock** nos testes; marcar
  PENDENTE-MANUAL no ledger o que exige ambiente externo (WhatsApp/Meta, pagamento, bucket, Sentry).
  Nunca inventar chave, chamar API real nem commitar segredo.
- **Plataforma:** Windows / PowerShell (Bash tool p/ scripts POSIX).

## Bootstrap de serviços (uma vez, no início, em background)

1. `pnpm install` (se necessário)
2. `pnpm docker:up`
3. `pnpm test:setup` — db de teste + seed
4. `pnpm build:types && pnpm build:api-client` — **obrigatório** antes de subir API/adm (sem o
   `dist/` de `@fonte/api-client` a suíte adm inteira quebra). Rebuildar sempre que a rodada tocar
   `packages/types` ou `packages/api-client`.
5. **API teste** (background): `pnpm dev:api:test` (porta 3001). Esperar healthcheck antes de testar.
   Rodar `migration:run:test` após criar migration nova.
6. **adm teste** (background, se o e2e exigir): `pnpm --filter adm.fonte dev:test` (porta 5174).

## Branches — uma por story, mergeada na main ao fechar

Cada branch parte da `main` ATUAL (já com o merge da story anterior):

```
git switch main
git switch -c {prefixo}/story-NN-{slug}
```

- O `fonte-implementer` commita o `.md` do plano (se ainda não versionado) + `feat(story-NN):
  <título>` na branch (rodapé co-author do modelo corrente; pt-BR — ver `CONTRIBUTING.md`). **Sem push.**
- Orquestrador, após recibo OK do agent **e** suíte verde: `git switch main && git merge --no-ff
  {prefixo}/story-NN-{slug} -m "merge: story NN — <título>"`. Sem push. Não deletar a branch.
- Arquivar o plano: `git mv stories/NN-*.md stories/done/` + commit
  `docs(stories): arquiva story NN concluida em done/`.

## A cada disparo do loop

1. **Reler estado:** ledger (`stories/PROGRESS.md`) + `git log`. Stories com commit `feat(story-NN)`
   = prontas; pular.
2. **Se a sessão estiver no limite** (`You've hit your session limit · resets <hora>`): **não fazer
   nada**, encerrar o turno. O `/loop` (intervalo fixo) redispara depois do reset e retoma sozinho.
   (Encher a **janela de contexto** é outro caso: há auto-compactação e segue no mesmo turno.)
3. **Caso contrário:** escolher a próxima story `[ ]`/`in_progress` na ordem (respeitando deps
   rígidas), disparar `fonte-implementer` com o plano + branch. Ao receber o recibo: se OK e verde →
   mergear na main + arquivar; senão → registrar `BLOQUEADO`/PARCIAL com motivo. Marcar status no
   ledger. Várias stories por turno se houver orçamento.
4. **Salvar estado sempre:** ledger atualizado + tudo commitado (cada story = checkpoint).

## Registro de progresso (ledger)

Após cada story, anexar ao Log da rodada:

```
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>
```

**Entrada curta — máx. ~3 linhas.** O ledger existe pra retomar (status + contagem de testes +
hashes + bloqueio + no máx. 1 nota crítica). Detalhe rico (lista de specs, percentuais, racional)
vai no **corpo do commit** ou no `.md` da story ao arquivar — não no ledger.

## Encerrar o loop

Quando **todas** as stories estiverem `[OK]` ou `BLOQUEADO`/PENDENTE-MANUAL no ledger: escrever o
resumo final (ver "Ao terminar") e **encerrar o loop** — não reagendar.

## Ao terminar

Resumo final no ledger: o que passou, o que ficou BLOQUEADO/PENDENTE-MANUAL e por quê, branches e
commits/merges, comandos exatos pra reproduzir os gates. Deixar os serviços de pé.

**Arquivar a rodada:** mover a seção da rodada encerrada para `stories/done/PROGRESS-NN-MM.md` e
restaurar o stub em `stories/PROGRESS.md` (o ledger ativo fica pequeno — é relido a cada disparo do
loop; rodadas mortas não podem acumular nele). Commit `docs(stories): arquiva rodada NN-MM`.

## Proibido

Push · abrir PR · deletar trabalho não criado pelo agente · pular testes sem justificativa · inventar
chave/segredo · chamar API externa real · perguntar qualquer coisa ao usuário · mergear na main com a
suíte tocada vermelha · editar migration aplicada · editar este arquivo com config de uma rodada
específica (vai no ledger). (Merge na main É permitido e esperado, por story, após suíte verde — sem push.)
