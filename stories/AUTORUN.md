# AUTORUN — Execução autônoma das stories 21–24 (editor de templates)

Protocolo para implementar, testar e commitar as stories `21`–`24` desta pasta **sem intervenção humana**. As decisões já estão travadas dentro de cada `NN-*.md` (seção "Refinamentos pendentes" com itens ✅) — **não perguntar nada ao usuário**.

## Prompt de início (colar e sair)

```
Modo autônomo. Siga C:\code\fonte\stories\AUTORUN.md à risca, sem me perguntar nada. Trabalhe sozinho até as 4 stories (21–24) estarem implementadas, testadas (verde) e commitadas. Se a sessão bater o limite de tokens, agende a retomada para quando o limite resetar (seção "Limite de sessão"). Estou saindo; quero tudo pronto quando voltar.
```

---

## Princípios

- **Contexto limpo por story**: para cada story, disparar um sub-agente novo via tool `Agent` (`subagent_type: general-purpose`). O orquestrador **não** implementa stories no próprio contexto — só coordena, sobe serviços e dispara um sub-agente por vez.
  - **Se o spawn do sub-agente falhar por limite de sessão** ("You've hit your session limit"), ver a seção **Limite de sessão** — agendar retomada; não tentar em loop.
- **Nenhum app rodado manualmente**: o orquestrador sobe todos os serviços (docker, API teste, adm teste). O usuário não roda nada.
- **Sem push / sem PR**: trabalho fica commitado na branch local. Usuário revisa e sobe depois.
- **Não travar a fila**: se uma story bloquear, registrar em `PROGRESS.md`, pular e seguir.
- **Plataforma**: Windows / PowerShell.

## Branch

Trabalhar na branch existente **`feat/template-editor-melhorias`** (criada a partir de `feat/lgpd-conformidade`; as 4 stories já estão commitadas nela como docs). Um commit por story: `feat(story-NN): <título curto>` (rodar hooks; co-author `Claude Opus 4.8 <noreply@anthropic.com>`).

## Ordem (respeita dependências)

```
23 → 22 → 21 → 24
```

- **23** (unificar fonte px→pt) primeiro: é pré-requisito da **24** (a quebra de página na tela só bate com o PDF se a unidade de fonte estiver unificada).
- **22** (imagem) é independente e curta.
- **21** (tabelas) adiciona regras de tabela ao CSS de impressão.
- **24** por último: é a maior (moldura A4 no editor + paginação + extrair `DOCUMENT_PRINT_CSS` para pacote compartilhado) e **consolida** o CSS de impressão das stories anteriores. Depende de 23.

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

Se a sessão bater o limite de uso/tokens (ex.: sub-agente ou chamada falha com `You've hit your session limit · resets <hora> (<tz>)`), **não** insistir em loop. Em vez disso:

1. **Salvar estado**: garantir que o progresso atual está em `PROGRESS.md` e que tudo que já passou está commitado (cada story commitada é um checkpoint).
2. **Calcular o reset**: extrair `<hora>` da mensagem de limite e converter para "segundos a partir de agora". Adicionar margem de ~120s após o horário do reset.
3. **Agendar a retomada** com a tool `ScheduleWakeup`:
   - `delaySeconds` = segundos até (reset + 120s), respeitando o clamp `[60, 3600]` (se o reset for além de 1h, agendar 3600 e reavaliar ao acordar).
   - `prompt` = o sentinel literal **`<<autonomous-loop-dynamic>>`** (retoma este modo autônomo no próximo disparo).
   - `reason` = algo como `"retomando AUTORUN stories 21-24 apos reset do limite as <hora>"`.
4. **Ao acordar**: reler `PROGRESS.md` + `git log`, identificar a próxima story não commitada na ordem `23 → 22 → 21 → 24`, e continuar do passo "Por cada story". Se o limite ainda não tiver resetado (chamadas voltam a falhar), reagendar (passo 3) — não desistir.
5. Se preferir cadência fixa em vez de horário do reset, usar `/loop` — mas o caminho padrão aqui é `ScheduleWakeup` ancorado no horário do reset.

> Objetivo: a fila das 4 stories sobrevive a um esgotamento de limite no meio do caminho — ela mesma reprograma a continuação e fecha sozinha quando o limite voltar.

## Bloqueios

- Não parar a fila. Registrar motivo + o que falta em `PROGRESS.md`, pular para a próxima.
- **Story 24, extensão de paginação**: se nenhuma extensão TipTap de paginação for compatível com a versão instalada, cair no **MVP visual** (guias de quebra) descrito na story e registrar a decisão no `PROGRESS.md` — não esperar o usuário.

## Proibido

Push, abrir PR, deletar trabalho não criado pelo agente, pular testes, perguntar qualquer coisa ao usuário.

## Ao terminar

Escrever resumo final em `PROGRESS.md`: o que passou, o que bloqueou, comandos exatos para o usuário reproduzir. Deixar os serviços de pé.
