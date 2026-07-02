---
name: issue
description: Cria uma story de desenvolvimento no monorepo fonte — levanta o escopo, escreve o plano em stories/NN-slug.md e commita na main. NÃO implementa, NÃO cria branch, NÃO mergeia. Use quando o usuário invocar /issue ou pedir para abrir/criar uma nova story/issue/tarefa de desenvolvimento.
---

# /issue — criar uma story

Skill invocável pelo usuário via `/issue`. **Só cria a story.** Levanta o escopo, escreve o plano e
commita o `.md` na main. Para aí.

Pode receber um título/descrição como argumento (`/issue corrigir filtro de relatório`) ou nada
(então levantar o escopo com o usuário).

> **Esta skill NÃO implementa a story.** Implementar é um passo manual separado, feito depois numa
> branch própria (ver `fonte-workflow`). `/issue` termina assim que a story está commitada na main.

## Convenções do repo (já existentes — respeitar)

- Stories ficam em `stories/NN-slug-em-kebab.md`, numeração sequencial crescente.
- Concluídas são arquivadas em `stories/done/` (via `git mv`) — isso acontece **depois**, ao
  concluir a implementação, não nesta skill.
- Formato de story segue as existentes: título `# Plan: ...`, seção **Context** (o *porquê*,
  decisões do usuário, trade-offs aceitos), **Desenho/Escopo**, **Validação**, **Fora de escopo**.
- **A Validação é obrigatória e SEMPRE inclui instruções explícitas de teste** (ver
  "Validação e gate de cobertura" abaixo). Nenhuma story é escrita sem elas.
- Commits seguem `CONTRIBUTING.md`: `type(scope): descrição curta em português no infinitivo`.
- Co-author: o modelo corrente (`Claude <modelo> <noreply@anthropic.com>` — o harness já injeta o rodapé correto; não cravar nome de modelo).

## Fluxo

### 1. Levantar o escopo

- Se `/issue` veio com texto, usar como ponto de partida; senão perguntar qual o problema/feature.
- Fazer só as perguntas que mudam o resultado (escopo ambíguo, decisão de produto, trade-off).
  Não interrogar à toa — preencher defaults óbvios e seguir.
- Capturar o **porquê** e as **decisões travadas**, não só o quê. É isso que o git diff não guarda.

### 2. Descobrir o próximo número

- Varrer `stories/*.md` **e** `stories/done/*.md`; pegar o maior `NN` e somar 1.
- Slug em kebab-case curto e descritivo.

### 3. Escrever a story

- Criar `stories/NN-slug.md` no formato das existentes (ver `stories/done/` como referência).
- Conteúdo mínimo: **Context** (com decisões do usuário), **Desenho**, **Validação**
  (quais testes/builds a implementação vai exigir — ver abaixo), **Fora de escopo**.
- Mostrar o plano ao usuário e confirmar antes de commitar.

#### Validação e gate de cobertura (OBRIGATÓRIO em toda story)

A seção **Validação** NUNCA pode ser vaga ("rodar os testes"). Ela SEMPRE:

1. Lista os **testes específicos** que a implementação exige, por camada tocada:
   - backend → `pnpm test:api` (unit do service) e, se houver fluxo HTTP novo/alterado,
     `pnpm test:api:e2e`;
   - `adm.fonte` → unit (Vitest/RTL) + e2e (Playwright) dos fluxos afetados;
   - `ops.fonte`/`app.fonte` → o teste correspondente (Maestro) quando o fluxo for tocado;
   - contratos → `pnpm build:types` / `pnpm build:api-client`; endpoint novo/alterado → Postman.
2. Enumera os **casos a cobrir** (caminhos felizes, erros, permissões/roles, validações, ramos
   novos) — não só "tem teste", mas *o que* o teste prova.
3. Fecha com um **gate de cobertura** explícito, no mesmo espírito das stories já refinadas:
   > **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente
   > — nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` (e o runner de cobertura dos
   > apps tocados); **não reduzir** a cobertura dos módulos afetados. Sem `skip`/`only`/`xfail` sem
   > justificativa no código (CLAUDE.md).

Adaptar o gate ao escopo real: story **frontend-only** cita só os runners de cobertura dos apps
(sem `test:api:cov`); story de backend cita `test:api:cov`. O princípio "código novo sem teste não
fecha a story" vale sempre.

### 4. Commitar a story na MAIN

- A story é commitada **direto na main**. **NUNCA criar branch para a story.**
- `git add` só do `stories/NN-slug.md`.
- `git commit -m "docs(stories): plano da story NN — <título>"`.
- **Não push automático** — só se o usuário pedir.

### 5. Encerrar

- Informar ao usuário: story NN criada e commitada na main.
- **PARAR AQUI.** Não criar branch, não implementar, não rodar testes, não mergear.
- Se o usuário quiser tocar a implementação, ele pede explicitamente depois (passo separado, em
  branch própria — ver `fonte-workflow`).

## Proibido

- **Implementar a story** — esta skill só cria o plano. Codar é passo separado, sob pedido explícito.
- **Criar branch** — a story vai direto na main.
- Abrir PR (não faz parte do workflow do repo).
- Push sem pedido explícito.
- Mergear qualquer coisa.
- Continuar para qualquer trabalho além de escrever e commitar o `.md` da story.
