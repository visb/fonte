# AUTORUN — Execução autônoma das stories 21–25 (editor de templates + code quality)

Protocolo para implementar, testar e commitar as stories `21`–`25` desta pasta **sem intervenção humana**. As decisões já estão travadas dentro de cada `NN-*.md` (seção "Refinamentos pendentes" com itens ✅) — **não perguntar nada ao usuário**.

## Prompt de início (colar e sair)

```
Modo autônomo. Siga C:\code\fonte\stories\AUTORUN.md à risca, sem me perguntar nada. Trabalhe sozinho até as 5 stories (21–25) estarem implementadas, testadas (verde) e commitadas. ANTES de começar, arme um wakeup de fallback com ScheduleWakeup (seção "Limite de sessão") e reagende-o a cada story commitada — assim a fila se reprograma sozinha se você bater o limite de uso. Estou saindo; quero tudo pronto quando voltar.
```

---

## Princípios

- **Contexto limpo por story**: para cada story, disparar um sub-agente novo via tool `Agent` (`subagent_type: general-purpose`). O orquestrador **não** implementa stories no próprio contexto — só coordena, sobe serviços e dispara um sub-agente por vez.
  - **Se o spawn do sub-agente falhar por limite de sessão** ("You've hit your session limit"), ver a seção **Limite de sessão** — a retomada já está armada de antemão (wakeup de fallback); não tentar em loop.
- **Nenhum app rodado manualmente**: o orquestrador sobe todos os serviços (docker, API teste, adm teste). O usuário não roda nada.
- **Sem push / sem PR**: trabalho fica commitado na branch local. Usuário revisa e sobe depois.
- **Não travar a fila**: se uma story bloquear, registrar em `PROGRESS.md`, pular e seguir.
- **Plataforma**: Windows / PowerShell.

## Branch

- **Stories 21–24** (editor de templates): trabalhar na branch existente **`feat/template-editor-melhorias`** (criada a partir de `feat/lgpd-conformidade`; as stories já estão commitadas nela como docs). Um commit por story: `feat(story-NN): <título curto>`.
- **Story 25** (code quality): criar branch **`chore/code-quality`** a partir de `feat/template-editor-melhorias` **depois** de 21–24 commitadas. Ali, **commits parciais** (`refactor(<area>): ...` / `fix(<area>): ...`), **sem merge com main, sem PR** — ver a própria story.
- Sempre rodar hooks; co-author `Claude Opus 4.8 <noreply@anthropic.com>`.

## Ordem (respeita dependências)

```
23 → 22 → 21 → 24 → 25
```

- **23** (unificar fonte px→pt) primeiro: é pré-requisito da **24** (a quebra de página na tela só bate com o PDF se a unidade de fonte estiver unificada).
- **22** (imagem) é independente e curta.
- **21** (tabelas) adiciona regras de tabela ao CSS de impressão.
- **24** (moldura A4 + paginação + extrair `DOCUMENT_PRINT_CSS`): maior; **consolida** o CSS de impressão das anteriores. Depende de 23.
- **25** (review de code quality + correção de gaps nos frontends) **por último**, em branch própria, revisando inclusive o que 21–24 produziram. Não é um sub-agente único — ver "Story 25".

## Bootstrap de serviços (uma vez, no início, em background)

Só precisa de backend + adm (todas as stories são `adm.fonte` + pequenos ajustes/spec no backend). **Sem emulador/Maestro.**

1. `pnpm install` (se necessário)
2. `pnpm docker:up`
3. `pnpm test:setup` — db de teste + seed
4. `pnpm build:types && pnpm build:api-client` — **obrigatório** antes de subir API/adm (sem o `dist/` de `@fonte/api-client` a suíte adm inteira quebra)
5. **API teste** (background): `pnpm dev:api:test` (porta 3001). Esperar healthcheck HTTP antes de testar.
6. **adm teste** (background): `pnpm --filter adm.fonte dev:test` (porta 5174). Esperar responder.

## Por cada story (dentro do sub-agente)

a. Ler `stories/NN-*.md` **inteiro**. Implementar exatamente o descrito (arquivos, snippets, decisões ✅ travadas).
b. Se tocou `packages/types` / `packages/api-client` / novo `packages/doc-styles` (story 24), rodar os builds correspondentes.
c. Se adicionou dependência npm (ex.: `@tiptap/extension-table` na 21, extensão de paginação na 24), instalar com `pnpm --filter adm.fonte add <pkg>` conferindo compat de versão com o `@tiptap/core` já instalado.
d. Atualizar/adicionar os testes da seção **"Testes automatizados"** da story.
e. Atualizar `fonte-api.postman_collection.json` se a story mudar endpoints (provável só a 22, se mexer no upload — conferir).
f. Rodar **só** os testes daquela story, usando os serviços já no ar:
   - Backend: `pnpm test:api` (e `pnpm test:api:e2e` se tiver e2e de API)
   - adm: `pnpm test:adm` (filtrar pelo spec da story, ex.: `document-templates.spec.ts`)
g. Corrigir até **todos** os testes da story passarem. Sem `skip`/`only`/`xfail`.
h. `git add` apenas arquivos da story + testes + postman; `git commit` com a convenção acima.
i. Devolver ao orquestrador: arquivos tocados, testes rodados, resultado.

## Registro de progresso

Manter `stories/PROGRESS.md`. Após cada story, anexar linha:

```
[OK|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — <timestamp>
```

Fonte de verdade para retomar após resumo de contexto / reinício / reset de limite: **git log + PROGRESS.md**. Stories já commitadas (`feat(story-NN)`) = feitas; pular.

## Limite de sessão / continuação automática

**Por que proativo, não reativo.** Quando a conta bate o limite de uso (`You've hit your session limit · resets <hora> (<tz>)`), toda inferência é bloqueada — o modelo **não consegue mais chamar `ScheduleWakeup` naquele momento** (a própria chamada exige rodar o modelo, que está congelado). Logo, **não dá** para "agendar a retomada quando o limite bater". O único wakeup que sobrevive ao limite é o que **já estava armado antes** dele estourar — o harness guarda o agendamento independente do modelo. Por isso o fallback é armado no início e refrescado a cada story.

> Nota: isto vale para o **limite de uso/sessão**. Encher a **janela de contexto** é outro caso — há auto-compactação e a execução segue sozinha; não precisa agendar nada.

### Passo a passo

1. **Armar o fallback logo no início** (antes da 1ª story), com a tool `ScheduleWakeup`:
   - `delaySeconds` = `3600` (máx do clamp `[60, 3600]`).
   - `prompt` = o sentinel literal **`<<autonomous-loop-dynamic>>`** (retoma este modo autônomo no próximo disparo).
   - `reason` = `"fallback AUTORUN stories 21-25: retoma se a sessao tiver batido o limite"`.
2. **Refrescar a cada story commitada**: chamar `ScheduleWakeup` de novo (mesmos parâmetros) ao fechar cada story. Cada turno bem-sucedido empurra o disparo ~1h pra frente, então em operação normal ele nunca dispara à toa; se o limite estourar no meio, o último wakeup armado dispara depois e retoma.
3. **Salvar estado sempre**: progresso em `PROGRESS.md` e tudo que passou commitado (cada story commitada = checkpoint). É a fonte de verdade pra retomar.
4. **Ao acordar** (wakeup disparou): reler `PROGRESS.md` + `git log`, identificar a próxima story não commitada na ordem `23 → 22 → 21 → 24 → 25`, e continuar do passo "Por cada story".
   - Se as chamadas **ainda falharem** por limite (reset não chegou): **rearmar** o fallback (passo 1) e dormir de novo — não desistir, não insistir em loop apertado.
   - Se voltou a funcionar: rearmar o fallback (passo 1) e seguir trabalhando normalmente.
5. **Opcional — ancorar no horário do reset**: se a mensagem de limite trouxe `<hora>`, dá pra calcular `delaySeconds` = segundos até (`<hora>` + 120s de margem), respeitando o clamp. É refino; o caminho padrão é o fallback de 3600s rearmado, que funciona sem saber a hora exata.
6. **Alternativa equivalente — `/loop`**: rodar este AUTORUN sob `/loop <intervalo>` também sobrevive ao limite (o harness re-dispara no intervalo; disparos durante o limite falham, o 1º depois do reset retoma). Trade-off: queima alguns disparos à toa durante a janela de limite. Escolher um dos dois (fallback rearmado **ou** `/loop`), não os dois.

> Objetivo: a fila das stories sobrevive a um esgotamento de limite no meio do caminho — ela já tem a continuação **armada de antemão**, reprograma sozinha e fecha quando o limite voltar.

## Story 25 (caso especial — review de code quality)

Difere do fluxo "uma story = um sub-agente + um commit":

- Rodar **só depois** de 21–24 commitadas em `feat/template-editor-melhorias`.
- **Criar a branch** `chore/code-quality` a partir de `feat/template-editor-melhorias` antes de começar.
- É um **review + correção em lotes**, não um feature único. Dentro do sub-agente: mapear gaps (grep/leitura), corrigir em lotes coesos por eixo/domínio, e fazer **um commit parcial por lote** (`refactor(<area>): ...`).
- **Sem merge com main, sem PR.** Só commits locais na branch.
- Só **qualidade** (vertical-slice/MVVM, reuso, tipos/tamanho) — **não mudar comportamento**. Gap que exija mudança de comportamento: registrar em `PROGRESS.md` e pular.
- DoD: build do adm verde + `tsc --noEmit` de ops/app limpos + testes existentes sem regressão (ver a story). Se o volume for grande, fechar por app (adm primeiro) mantendo build verde e registrar o resto para um 2º passe.

## Bloqueios

- Não parar a fila. Registrar motivo + o que falta em `PROGRESS.md`, pular para a próxima.
- **Story 24, extensão de paginação**: se nenhuma extensão TipTap de paginação for compatível com a versão instalada, cair no **MVP visual** (guias de quebra) descrito na story e registrar a decisão no `PROGRESS.md` — não esperar o usuário.

## Proibido

Push, abrir PR, deletar trabalho não criado pelo agente, pular testes, perguntar qualquer coisa ao usuário.

## Ao terminar

Escrever resumo final em `PROGRESS.md`: o que passou, o que bloqueou, comandos exatos para o usuário reproduzir. Deixar os serviços de pé.
