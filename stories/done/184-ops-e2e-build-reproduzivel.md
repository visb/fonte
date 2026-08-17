# Plan: ops.fonte — build e ambiente de e2e reproduzíveis (cleartext, API level, ABI)

## Context

`pnpm test:ops` rodou pela primeira vez em aparelho em 2026-08-16 (commit `9ac1944`). Chegar lá
custou várias horas, e **nenhum** dos obstáculos estava documentado ou automatizado. Hoje, quem
tentar rodar a suíte num clone limpo bate exatamente nos mesmos três muros, na mesma ordem — e os
sintomas apontam todos para o lugar errado.

O pior deles é este: **o APK de release não fala com a API de teste, e a tela de login mente sobre
o motivo.**

### 1. Cleartext — o sintoma engana

`android:usesCleartextTraffic="true"` existe **só** em
`android/app/src/debug/AndroidManifest.xml`. No build de release o Android bloqueia HTTP puro, então
a requisição para `http://10.0.2.2:3001/api/v1` nunca sai. O app não mostra erro de rede: mostra
**"WhatsApp/e-mail ou senha incorretos."** — a mensagem de credencial errada, para uma falha que não
tem nada a ver com credencial. Perde-se um tempo enorme conferindo senha e seed.

Depois de liberar o cleartext o sintoma muda para **spinner infinito**, o que também engana: é o
`onlineManager` desligado. `lib/offline/network.ts:17-19` faz
`isConnected === true && isInternetReachable !== false`, e o React Query com `networkMode` padrão
(`'online'`) **pausa** a mutation em vez de falhar. Emulador recém-bootado ainda não validou a rede
→ login pendurado para sempre. É comportamento **correto** do app; só não é óbvio no diagnóstico.

Hoje a liberação foi feita editando à mão o manifest gerado. Como `android/` é gerado pelo CNG
(`expo prebuild`) e é gitignored, **o patch evapora no próximo prebuild** — o build atual não é
reproduzível.

### 2. API level — o Maestro não roda nas imagens instaladas

Maestro 2.6.0 **não funciona** nas imagens que a máquina tinha:

- **SDK 37 (Android 17):** o app lança, mas o driver morre ao ler a árvore de views —
  `Not able to reach the gRPC server while processing launchApp command` →
  `io.grpc.StatusRuntimeException: UNAVAILABLE` / `Command failed (tcp:NNNNN): closed`.
- **SDK 36:** pior, o fluxo nem inicia — loop infinito de `Failed to record heartbeat`, zero saída,
  parece travamento do CLI.

Funciona em **API 34** (`system-images;android-34;google_apis;x86_64`). Nada no repo diz isso, e o
`avdmanager` da máquina só reconhecia imagens 36/37 — a imagem 34 precisou ser baixada.

### 3. ABI — a receita conhecida era de aparelho físico

O emulador é **x86_64**; a receita que existia (memória do build local) usava `arm64-v8a`, de
dispositivo real. Com a ABI errada o APK simplesmente não instala.

### Decisões travadas (usuário)

1. **Cleartext liberado condicionalmente, via `app.config.js`**: `usesCleartextTraffic` só quando
   `EXPO_PUBLIC_API_URL` for `http://`. Produção fala `https://`, então o APK de produção continua
   com cleartext **bloqueado** — a postura de segurança não muda. Rejeitadas: ligar sempre via
   `expo-build-properties` (afrouxa produção junto) e servir a API de teste sob HTTPS (exige gerar e
   instalar certificado no emulador).

### Decisões assumidas por default (rever se discordar)

2. **`app.json` vira `app.config.js`**, mantendo o conteúdo atual e lendo o env. É o mecanismo do
   Expo para config dinâmica; não há como condicionar nada em `app.json`, que é estático.
3. **A condição é "a URL da API é `http://`", não uma flag de e2e.** Uma variável tipo
   `E2E_BUILD=1` seria um segundo interruptor para esquecer de ligar. Derivar da URL que o app já
   recebe é uma fonte só, e é exatamente a condição que importa: só faz sentido permitir cleartext
   quando o destino é cleartext.
4. **Script `test:ops:build`** em `apps/ops.fonte/package.json` que faz prebuild + `assembleRelease`
   com a ABI e as env vars corretas. A receita não pode morar só numa memória de sessão.
5. **A escolha de ABI vem do dispositivo conectado**, não fixa: `adb shell getprop
   ro.product.cpu.abi`. Emulador x86_64 e aparelho arm64 são os dois casos reais, e cravar um quebra
   o outro.
6. **Nada é verificado em runtime pelo app.** A checagem de API level do emulador é do script/doc,
   não do app — o `ops.fonte` não deve saber que existe Maestro.

---

## Desenho

### 1. `apps/ops.fonte/app.config.js` (novo, substitui `app.json`)

```js
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
// Só o build apontado para uma API em HTTP puro (dev/e2e) libera cleartext.
// Produção usa https e continua com o bloqueio padrão do Android.
const allowCleartext = apiUrl.startsWith('http://');

module.exports = {
  expo: {
    /* …conteúdo atual do app.json, sem alteração… */
    plugins: [
      'expo-router',
      'expo-font',
      '@sentry/react-native',
      ['expo-splash-screen', { /* …igual… */ }],
      [
        'expo-build-properties',
        {
          android: {
            kotlinVersion: '1.9.25',
            usesCleartextTraffic: allowCleartext,
          },
        },
      ],
    ],
  },
};
```

`app.json` é **removido** (o Expo não deve ver os dois). Todo o resto do conteúdo — `newArchEnabled:
false`, `android.package`, splash, ícones, `experiments.typedRoutes` — migra literalmente.

### 2. `apps/ops.fonte/package.json` — script de build de e2e

```json
"build:e2e:android": "node scripts/build-e2e-android.js"
```

`scripts/build-e2e-android.js` (novo):

- exige `ANDROID_HOME`; erra com mensagem clara se faltar;
- lê a ABI do dispositivo conectado (`adb shell getprop ro.product.cpu.abi`) e a usa em
  `-PreactNativeArchitectures`;
- **lê o API level (`ro.build.version.sdk`) e aborta com mensagem explícita se for > 34**, dizendo
  que o Maestro 2.6.x não opera nesse nível e como criar o AVD certo. Isso é o coração da story: o
  erro que hoje custa horas vira uma linha na saída;
- exporta `EXPO_NO_METRO_WORKSPACE_ROOT=1`, `NODE_ENV=production`,
  `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api/v1`, `SENTRY_DISABLE_AUTO_UPLOAD=true`
  (sem esta última o release **falha** no upload do Sentry por falta de org/slug);
- roda `expo prebuild -p android --clean --no-install` e depois
  `gradlew assembleRelease --project-cache-dir` fora do projeto (evita erro de move-lock do `.gradle`
  no Windows);
- ao fim, imprime o caminho do APK e o `adb install -r` correspondente.

### 3. `pnpm test:ops` continua sendo o comando da suíte

Sem mudança no script raiz. O que muda é que existe um caminho documentado para chegar ao estado em
que ele funciona.

### 4. Documentação

- **`CLAUDE.md`**, seção "Pré-requisitos por tipo": a linha de `test:ops`/`test:app` passa a citar o
  **API level máximo 34** e o script de build, em vez de só "Maestro instalado + emulador".
- **`.claude/skills/fonte-frontend`**: bloco curto com a receita e os três sintomas enganosos
  (credencial incorreta = cleartext; spinner infinito = `onlineManager` offline; gRPC UNAVAILABLE /
  heartbeat = API level). O valor está em ligar sintoma → causa, que é o que se perde entre sessões.
- Criação do AVD documentada junto:
  `sdkmanager "system-images;android-34;google_apis;x86_64"` +
  `avdmanager create avd -n Maestro_API34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6`.

---

## Validação

### Contratos e build

- `npx expo config --type public` (em `apps/ops.fonte`) devolve config válida com
  `app.config.js` e **sem** `app.json` presente — prova que a migração não perdeu campo.
- Com `EXPO_PUBLIC_API_URL=https://…`: a config resolvida traz
  `usesCleartextTraffic: false`; após `expo prebuild`, o `<application>` do
  `android/app/src/main/AndroidManifest.xml` **não** tem o atributo ligado.
- Com `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001/api/v1`: a config traz `true` e o manifest gerado
  ganha `android:usesCleartextTraffic="true"`.
- **Comparar a config resolvida antes/depois da migração** (`app.json` versus `app.config.js`) e
  conferir que a única diferença é `usesCleartextTraffic`. É a prova de que nada foi perdido no
  caminho — `newArchEnabled: false` em especial, cujo desaparecimento deixaria o NativeWind sem
  aplicar `className` e o app inteiro sem estilo.

### `ops.fonte` — unit, `pnpm test:ops:unit`

Teste do `app.config.js` (é um módulo Node comum, roda no Jest):

- `EXPO_PUBLIC_API_URL` com `http://` → `usesCleartextTraffic: true`;
- com `https://` → `false`;
- **ausente / string vazia** → `false` (o default é o seguro, não o permissivo);
- os campos críticos seguem presentes: `newArchEnabled === false`,
  `android.package === 'org.fonte.ops'`, plugin `expo-build-properties` com
  `kotlinVersion: '1.9.25'`.

Teste do `scripts/build-e2e-android.js` (extrair as decisões para funções puras e testar essas):

- API level 34 → segue; 36 e 37 → aborta com mensagem citando o API level e o AVD sugerido;
- ABI lida do device é repassada a `-PreactNativeArchitectures`;
- `ANDROID_HOME` ausente → erro claro, sem chamar o gradle.

### Fim a fim (manual, uma vez — é o ponto da story)

Num clone limpo, seguindo **só** o que ficou documentado: criar o AVD, rodar
`pnpm --filter ops.fonte build:e2e:android`, instalar, `pnpm test:setup`, `pnpm test:ops`. Critério:
**nenhum passo fora do que está escrito**, e a suíte chega ao mesmo resultado do dia — 11/13 antes da
story 183, 13/13 depois dela.

### Gate de cobertura (trava a story)

Story de config/infra do app: rodar `pnpm test:ops:unit:cov`; **não reduzir** a cobertura do
`ops.fonte`. Todo caminho novo (a condição de cleartext, as guardas do script) tem teste
correspondente — nenhum ramo novo entra sem teste. Sem `skip`/`only`/`xfail` sem justificativa
explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Consertar `storeroom.yaml` e `product-contributions.yaml`** — é a story 183. Esta aqui só torna
  possível rodá-los.
- **CI rodando Maestro.** Esta story deixa o build reproduzível numa máquina de dev; runner com
  emulador é outra discussão (custo, tempo de suíte, flakiness).
- **`app.fonte`**: tem o mesmo `test:app` com Maestro e provavelmente os mesmos muros, mas não foi
  executado nem investigado. Replicar depois que o caminho do `ops.fonte` estiver assentado.
- **Trocar o Maestro de versão** para suportar SDK 36/37. Pode ser que uma versão mais nova resolva;
  fixar em API 34 é a escolha desta story porque é o que está provado funcionando. Reavaliar quando
  o Maestro anunciar suporte.
- **Servir a API de teste sob HTTPS** — rejeitado na decisão 1.
- **Mexer no tratamento de erro da tela de login** (mostrar "sem conexão" em vez de "credenciais
  incorretas" quando a requisição falha na rede). É um problema real de UX que este trabalho
  expôs, mas é mudança de comportamento de produto: merece story própria.
