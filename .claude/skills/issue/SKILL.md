---
name: issue
description: Cria e conduz uma story do início ao fim no monorepo fonte — escreve o plano em stories/, desenvolve numa branch nova, valida, move o concluído para stories/done e pergunta se deve mergear na main. Use quando o usuário invocar /issue ou pedir para abrir/criar uma nova story/issue/tarefa de desenvolvimento.
---

# /issue — ciclo de vida de uma story

Skill invocável pelo usuário via `/issue`. Conduz uma unidade de trabalho do plano ao merge.
Pode receber um título/descrição como argumento (`/issue corrigir filtro de relatório`) ou nada
(então levantar o escopo com o usuário).

**Sem Pull Requests.** O plano da story é commitado na própria `main`. A implementação é feita
numa branch nova, criada só na hora de executar, e mergeada de volta na main sob confirmação.
Nunca abrir PR, nunca push automático.

## Convenções do repo (já existentes — respeitar)

- Stories ficam em `stories/NN-slug-em-kebab.md`, numeração sequencial crescente.
- Concluídas são arquivadas em `stories/done/` (via `git mv`, preserva histórico).
- Formato de story segue as existentes: título `# Plan: ...`, seção **Context** (o *porquê*,
  decisões do usuário, trade-offs aceitos), **Desenho/Escopo**, **Validação**, **Fora de escopo**.
- Commits seguem `CONTRIBUTING.md`: `type(scope): descrição curta em português no infinitivo`.
- Co-author: `Claude Opus 4.8 <noreply@anthropic.com>` (ou o modelo corrente).

## Fluxo

### 1. Levantar o escopo

- Se `/issue` veio com texto, usar como ponto de partida; senão perguntar qual o problema/feature.
- Fazer só as perguntas que mudam o resultado (escopo ambíguo, decisão de produto, trade-off).
  Não interrogar à toa — preencher defaults óbvios e seguir.
- Capturar o **porquê** e as **decisões travadas**, não só o quê. É isso que o git diff não guarda.

### 2. Descobrir o próximo número

- Varrer `stories/*.md` **e** `stories/done/*.md`; pegar o maior `NN` e somar 1.
- Slug em kebab-case curto e descritivo.

### 3. Escrever a story — na `main`

- Estar na `main` (`git switch main`). A story é escrita e commitada na main, não em branch.
- Criar `stories/NN-slug.md` no formato das existentes (ver `stories/done/` como referência).
- Conteúdo mínimo: **Context** (com decisões do usuário), **Desenho**, **Validação**
  (quais testes/builds), **Fora de escopo**.
- Mostrar o plano ao usuário e confirmar antes de seguir. Em modo autônomo, travar as decisões
  na própria story e seguir.
- Commitar o `.md` na main: `docs(stories): plano da story NN — <título>`.

### 4. Branch nova — só ao executar

- Só criar a branch quando for de fato implementar o trabalho planejado na story. Nunca codar na main.
- Criar a partir da main (que já contém o plano commitado):

```
git switch main
git switch -c <type>/<slug>
```

  `<type>` casa o commit: `feat/`, `fix/`, `chore/`, `docs/`. Ex.: `feat/relatorio-filtro-data`.

### 5. Implementar

- Seguir a story à risca. Consultar as skills `fonte-*` para padrões de backend/frontend/workflow.
- Reusar antes de criar (hooks, componentes, api-client) — checklist do `CLAUDE.md`.
- Atualizar `fonte-api.postman_collection.json` se mexer em endpoint.

### 6. Validar

- Rodar a validação mínima da tabela em `fonte-workflow` conforme a área tocada.
- Backend: `pnpm test:api` (e `pnpm test:api:e2e` se houver e2e). adm: `pnpm test:adm` do spec.
- Sem `skip`/`only`/`xfail` sem justificativa no código. Corrigir até verde.

### 7. Commitar a implementação

- `git add` só dos arquivos da story + testes + postman.
- `git commit` na convenção. Um ou mais commits coesos.

### 8. Arquivar a story

- `git mv stories/NN-slug.md stories/done/NN-slug.md`.
- Commit: `docs(stories): arquiva story NN concluida em done/`.

### 9. Perguntar sobre merge na main

Concluída e verde, **perguntar ao usuário** (não decidir sozinho):

> Story NN pronta na branch `<branch>`, testes verdes. Mergear na main agora?

- **Sim** → fast-forward/merge local e seguir:

```
git switch main
git merge --no-ff <branch> -m "merge: story NN — <título>"
```

  Não deletar a branch sem o usuário pedir. Não push automático — só se o usuário pedir.
- **Não / depois** → deixar na branch, informar o nome para o usuário mergear quando quiser.

## Modo autônomo

Se o usuário pedir execução sem supervisão (ex.: "modo autônomo", várias issues em fila),
travar as decisões dentro da story e seguir o protocolo de `stories/AUTORUN.md` (sub-agente por
story, fallback `ScheduleWakeup`, registro em `PROGRESS.md`). Mesmo assim **não mergear na main
sem confirmação** — a menos que o usuário tenha autorizado o merge explicitamente de antemão.

## Proibido

- Abrir PR (não faz parte do workflow atual).
- Codar na main.
- Push sem pedido explícito.
- Mergear na main sem confirmação.
- Pular testes ou deletar trabalho não criado nesta story.
