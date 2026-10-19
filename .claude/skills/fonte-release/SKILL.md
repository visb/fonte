---
name: fonte-release
description: Prepara uma release da plataforma fonte (/release) — coleta os commits desde a última tag vX.Y.Z, sugere o bump semver, escreve o changelog em pt-BR de usuário (apps/release.fonte/content/releases/vX.Y.Z.md) com aprovação do usuário, faz o bump do apps/ops.fonte/package.json, smoke do APK local, commit chore(release) e tag anotada. NÃO faz push — termina informando `git push origin main --follow-tags`, que dispara o release.yml (APK assinado + deploy). Use quando o usuário invocar /release ou pedir para gerar/preparar/publicar uma release, versão, changelog ou APK do ops.
---

# /release — preparar uma release da plataforma

Skill invocável pelo usuário via `/release` (story 213). Organiza a release para que o usuário **só
faça o push**: o push da tag dispara o `.github/workflows/release.yml`, que compila o APK assinado
no CI, publica `ghcr.io/visb/fonte-apk:<versão>` e reimplanta o `fonte-web` com o
`release.fontedemisericordia.com.br` atualizado.

> **Esta skill NUNCA faz push, PR nem deploy.** Termina no passo 8 com o comando para o usuário.

## Conceitos (não reinventar)

- **Release = versão da plataforma inteira.** Uma tag `vX.Y.Z` cobre adm, ops (web + APK), api e
  portal. A versão vive em **um lugar só**: `version` de `apps/ops.fonte/package.json`. O
  `android.versionCode` deriva dela (`major*10000 + minor*100 + patch`,
  `apps/ops.fonte/config/version.js`) — minor/patch **< 100**; se a sugestão passar disso, suba a
  major.
- **Changelog** = `apps/release.fonte/content/releases/vX.Y.Z.md`, um por release. Frontmatter:
  `version`, `date` (AAAA-MM-DD), `summary` (uma linha), `apk` (true — toda tag publica APK),
  `breaking` (true quando exige desinstalar). Corpo com `## Ops (celular)`, `## Administração`,
  `## Portal`, `## App das famílias`, `## Geral` — só as seções que tiverem itens. O nome do arquivo
  tem de ser `v<version>.md`; frontmatter inválido **quebra o build** do release.fonte.
- **Público e para usuário.** O site é aberto. Escrever o que mudou **na prática** para quem usa
  (coordenador, servo, adm). **Proibido** no texto: nome de filho/familiar/servo, CPF, telefone,
  qualquer dado pessoal; detalhe de infraestrutura (IP, host interno, nome de bucket, porta,
  secret, stack trace); jargão técnico (endpoint, migration, refactor, hook, DTO).
- **Fora do changelog:** `test`, `chore`, `ci`, `refactor`, `style`, `build`, `docs(stories)` —
  o script já filtra. Quebra (`!`/`BREAKING CHANGE`) sempre entra.

## Disciplina de shell (obrigatória — mantém o auto mode vivo)

Arquivos **só** via `Write`/`Edit` (nunca `cat >`, heredoc, `echo >`, `sed -i`). Um comando simples
por chamada Bash, caminho absoluto em vez de `cd X &&`. Mensagem de commit e de tag em arquivo
(`Write`) + `git commit -F` / `git tag -F`. Nunca here-string do PowerShell na tool Bash.

## Fluxo (8 passos, em ordem — não pular)

### 1. Pré-checagem

Cada comando numa chamada:

```bash
git -C C:/code/fonte branch --show-current     # tem de ser main
git -C C:/code/fonte status --porcelain        # tem de vir vazio
git -C C:/code/fonte fetch origin
git -C C:/code/fonte status -sb                # sem "ahead"/"behind" de origin/main
pnpm test:cov:all                              # gate completo, verde
```

Qualquer falha → **para** e reporta. Se o usuário pedir para pular o `test:cov:all`, registrar a
decisão (vai no corpo do commit da release: "gate pulado a pedido do usuário").

### 2. Coleta

```bash
node C:/code/fonte/scripts/release/collect.mjs
```

Devolve JSON: `lastTag`, `firstRelease`, `suggestedVersion`, `bump`, `sections` (commits por app),
`stories` (números citados), `excludedCount`, `unconventional`.

- **`needsStartingPoint: true`** (primeira release, sem tag): **perguntar ao usuário** de onde
  começar (hash ou data) e rodar de novo com `--from <ref>`. Não despejar o histórico inteiro.
- Para cada story em `stories`, ler `stories/done/NN-*.md` (ou `stories/NN-*.md`) e entender o
  **porquê** da mudança — é isso que vira texto de usuário, não o título do commit.
- `unconventional`: revisar à mão; incluir só se for mudança visível ao usuário.
- `--markdown` imprime um rascunho cru (frontmatter + títulos de commit) como ponto de partida.

### 3. Versão

Regra: quebra → **major**; algum `feat` → **minor**; só `fix`/`perf`/demais → **patch**. Na
primeira release a sugestão é a versão atual do `package.json` (sem bump). Apresentar a sugestão
e o motivo; **o usuário confirma ou ajusta**. Conferir minor/patch < 100.

### 4. Rascunho do changelog (itera até aprovação)

Escrever `apps/release.fonte/content/releases/vX.Y.Z.md` com `Write`. Agrupar por app, frases
curtas no presente, do ponto de vista de quem usa ("Agora dá para…", "Corrigido: …"). Mostrar ao
usuário e **iterar até ele aprovar**. Antes de fechar, revisar de novo a lista de proibidos
(dado pessoal, infraestrutura, jargão).

`breaking: true` só quando a instalação exige desinstalar (troca de assinatura) — aí o texto
**tem** de pedir para sincronizar as pendências antes de desinstalar.

Validar o arquivo:

```bash
pnpm test:release
pnpm build:release
```

### 5. Bump

`Edit` em `apps/ops.fonte/package.json` → `"version": "X.Y.Z"`. Nada mais: o `versionCode` deriva
sozinho. Conferir:

```bash
node C:/code/fonte/scripts/release/check-tag.mjs vX.Y.Z
```

(é o mesmo check do passo 1 do `release.yml` — se falhar aqui, falharia no CI.)

### 6. Smoke do APK local

Só para garantir que o build passa antes de taguear; **o APK publicado é o do CI**. Sem keystore
local sai debug-signed (esperado). Receita conhecida (Windows; `ANDROID_HOME` apontando para o
SDK):

```bash
pnpm build:types
pnpm build:api-client
pnpm --filter ops.fonte exec expo prebuild -p android --clean --no-install
```

Depois o gradle, com as variáveis do build de release no prefixo do comando (uma chamada):

```bash
EXPO_NO_METRO_WORKSPACE_ROOT=1 NODE_ENV=production SENTRY_DISABLE_AUTO_UPLOAD=true EXPO_PUBLIC_API_URL=https://ops.fontedemisericordia.com.br/api/v1 C:/code/fonte/apps/ops.fonte/android/gradlew.bat -p C:/code/fonte/apps/ops.fonte/android assembleRelease -PreactNativeArchitectures=arm64-v8a --project-cache-dir C:/gtmp/ops
```

APK em `apps/ops.fonte/android/app/build/outputs/apk/release/app-release.apk`. `android/` é CNG
(gitignored) — **nunca** editar à mão. **Falhou → para e reporta; não tagueia.** Se o toolchain
Android não existir na máquina, perguntar ao usuário se segue sem o smoke (o CI builda de
qualquer forma) e registrar a decisão no corpo do commit.

### 7. Commit + tag

Só os arquivos da release — nada mais:

```bash
git -C C:/code/fonte add apps/release.fonte/content/releases/vX.Y.Z.md apps/ops.fonte/package.json
git -C C:/code/fonte status --porcelain        # conferir: só esses dois
```

Mensagem em arquivo (`Write` no scratchpad), título `chore(release): vX.Y.Z`, corpo com o resumo e
o rodapé `Co-Authored-By:` vigente; então:

```bash
git -C C:/code/fonte commit -F <arquivo-da-mensagem>
```

Tag **anotada** com o resumo da versão (mensagem também em arquivo):

```bash
git -C C:/code/fonte tag -a vX.Y.Z -F <arquivo-da-mensagem-da-tag>
git -C C:/code/fonte show --stat vX.Y.Z        # conferir: tag anotada + só os 2 arquivos
```

### 8. Para

**Não faz push.** Informar ao usuário, e só:

```
Release vX.Y.Z pronta (commit <hash>, tag anotada vX.Y.Z). Para publicar:

    git push origin main --follow-tags

O push dispara o release.yml: APK assinado → ghcr.io/visb/fonte-apk:X.Y.Z → fonte-web → deploy.
Acompanhe em Actions → Release. Depois, instale por cima num aparelho e confirme login, dados e
pendências.
```

## Se algo der errado depois do push

- **`release.yml` falhou em "Conferir a tag"**: tag × `package.json` × changelog divergem. Corrigir
  na `main`, apagar a tag (`git tag -d vX.Y.Z` + `git push origin :refs/tags/vX.Y.Z` — pelo
  usuário) e refazer os passos 5–8.
- **Falhou em "Keystore de release"**: faltam secrets `OPS_KEYSTORE_*`/`OPS_KEY_*` (README §9.7).
- **Falhou em "Conferir assinatura"**: o APK saiu com a chave debug — não publicar; revisar os
  secrets.
- Ensaio sem publicar: Actions → Release → Run workflow (tag existente, `publish` desmarcado).
