# AUTORUN — Execução autônoma das stories 12–19

Protocolo para implementar, testar e commitar as stories `12`–`19` desta pasta **sem intervenção humana**. Todas as decisões já estão resolvidas dentro de cada `NN-*.md` — **não perguntar nada ao usuário**.

## Prompt de início (colar e sair)

```
Modo autônomo. Siga C:\code\fonte\stories\AUTORUN.md à risca, sem me perguntar nada. Trabalhe sozinho até todas as 8 stories (12–19) estarem implementadas, testadas (verde) e commitadas. Estou saindo; quero tudo pronto quando voltar.
```

---

## Princípios

- **Contexto limpo por story**: para cada story, disparar um sub-agente novo via tool `Agent` (`subagent_type: general-purpose`). Cada sub-agente nasce com contexto frio (equivalente a `/clear`, mas sem ação manual). O orquestrador **não** implementa stories no próprio contexto — só coordena, sobe serviços e dispara um sub-agente por vez.
- **Nenhum app rodado manualmente**: o orquestrador sobe todos os serviços (docker, API teste, adm teste, Metro/emulador). O usuário não roda nada.
- **Sem push / sem PR**: trabalho fica commitado na branch local. Usuário revisa e sobe depois.
- **Não travar a fila**: se uma story bloquear, registrar em `PROGRESS.md`, pular e seguir.
- **Plataforma**: Windows / PowerShell. Env Android já configurado (`ANDROID_HOME` setado, `emulator`/`adb`/`maestro` no PATH).

## Branch

Trabalhar na branch existente `docs/stories-alteracoes-lote`. Um commit por story: `feat(story-NN): <título curto>` (rodar hooks; co-author `Claude Opus 4.8 <noreply@anthropic.com>`).

## Ordem (respeita dependências)

```
18 → 13 → 14 → 12 → 16 → 17 → 15 → 19
```

- `13` e `14` mexem no **mesmo arquivo** (`AdmissionWizardPage.tsx`); fazer 13 e depois 14, sequencial, sem conflito.
- `15` depende do enum `FamilyInvestment` — **já existe** no código (story 09 feita). Só acrescenta `paidAmount`/`paidFamilyInvestment` + ajuste no relatório.
- `19` é a maior (WebSocket realtime + ops). Por último.

## Bootstrap de serviços (uma vez, no início, em background)

1. `pnpm install` (se necessário)
2. `pnpm docker:up`
3. `pnpm test:setup` — db de teste + seed
4. `pnpm build:types && pnpm build:api-client`
5. **API teste** (background): `pnpm dev:api:test` (porta 3001). Esperar subir (healthcheck HTTP) antes de testar.
6. **adm teste** (background): `pnpm --filter adm.fonte dev:test` (porta 5174). Esperar responder.
7. **Só para a story 19 (ops/Maestro)**:
   - Bootar emulador: `emulator -avd Test_Emulator -no-snapshot -gpu auto` (background). Esperar `adb shell getprop sys.boot_completed` == `1`. Dismiss keyguard: `adb shell wm dismiss-keyguard`.
   - Metro do ops (background): `pnpm dev:ops`.
   - `adb reverse tcp:8081 tcp:8081`.

> AVD de teste é `Test_Emulator` (Android 17 / SDK 37, google_apis não-playstore, **sem senha**). Se oscilar/falhar, fallback: criar/usar AVD com `system-images;android-36;google_apis_playstore;x86_64`.

## Por cada story (dentro do sub-agente)

a. Ler `stories/NN-*.md` **inteiro**. Implementar exatamente o descrito (arquivos, snippets, decisões travadas).
b. Se tocou `packages/types` ou `api-client`, rodar os builds correspondentes.
c. Atualizar/adicionar os testes da seção **"Testes automatizados"** da story.
d. Atualizar `fonte-api.postman_collection.json` se a story mudar endpoints.
e. Rodar **só** os testes daquela story, usando os serviços já no ar:
   - Backend: `pnpm test:api` (e `pnpm test:api:e2e` se a story tiver e2e de API)
   - adm: `pnpm test:adm` (pode filtrar pelo spec da story)
   - ops (story 19): `pnpm test:ops`
f. Corrigir até **todos** os testes da story passarem. Sem `skip`/`only`/`xfail`.
g. `git add` apenas arquivos da story + testes + postman; `git commit` com a convenção acima.
h. Devolver ao orquestrador: arquivos tocados, testes rodados, resultado.

## Registro de progresso

Manter `stories/PROGRESS.md`. Após cada story, anexar linha:

```
[OK|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — <timestamp>
```

Fonte de verdade para retomar após resumo de contexto / reinício: **git log + PROGRESS.md**. Stories já commitadas = feitas; pular.

## Bloqueios

- Não parar a fila. Registrar motivo + o que falta em `PROGRESS.md`, pular para a próxima.
- **Story 19, caso especial**: se o deploy/proxy não suportar WebSocket (pré-requisito de infra §7b), implementar o realtime mesmo assim, marcar o risco no PROGRESS e seguir — não esperar o usuário.
- **ops/Maestro** é o ponto mais frágil (emulador pode oscilar). Se o e2e mobile falhar por infra, registrar bloqueio e seguir — o resto deve ficar pronto mesmo assim.

## Proibido

Push, abrir PR, deletar trabalho não criado pelo agente, pular testes, perguntar qualquer coisa ao usuário.

## Ao terminar

Escrever resumo final em `PROGRESS.md`: o que passou, o que bloqueou, comandos exatos para o usuário reproduzir. Deixar os serviços de pé.
