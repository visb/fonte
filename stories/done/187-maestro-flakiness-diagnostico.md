# Plan: suíte Maestro do ops.fonte — medir e diagnosticar a instabilidade de launch

## Context

Achado da rodada de autorun 182–184 (`stories/done/PROGRESS-182-184.md` → "Resumo final", achado 3).

Durante a story 183, numa batelada de `pnpm test:ops`, **`census` e `dashboard` falharam em ~7s
cada** (fechando 11/13). Os dois passaram **isolados** e passaram **na batelada seguinte, sem
qualquer edição** — a mesma suíte, o mesmo APK, o mesmo emulador. A leitura na hora foi "hiccup de
launch do driver", mas isso é hipótese, não diagnóstico: ninguém olhou o log do driver no momento da
queda.

Enquanto isso não for medido, a suíte tem um custo escondido: **vermelho não significa regressão**.
Toda story que roda Maestro passa a gastar tempo decidindo se a falha é dela ou do ambiente — foi
exatamente o que aconteceu na 183.

### Por que não sair consertando

A correção óbvia — retry no runner, ou espera de readiness no começo dos fluxos — foi **rejeitada
como primeiro passo**. Retry sobre causa desconhecida não conserta: esconde. Se a instabilidade for
do app (boot, hidratação do store, `onlineManager` demorando a resolver) e não do driver, o retry
transforma um bug real de produção em suíte verde, que é o pior resultado possível.

### O que já se sabe do terreno

- Runner: `maestro test e2e/` (`apps/ops.fonte/package.json:16`), sem retry, sem paralelismo.
- Maestro **2.6.x**, e a versão importa: a story 184 documentou que ele não opera acima de **API 34**
  — SDK 37 morre com `gRPC UNAVAILABLE` ao ler a árvore de views, SDK 36 entra em loop de
  `Failed to record heartbeat`. A família de sintomas "driver não responde" **já é conhecida** neste
  setup; a hipótese de que a queda de 7s é a mesma coisa em versão branda é plausível e não testada.
- Ambiente provado: emulador **API 34** x86_64, APK de release via
  `pnpm --filter ops.fonte build:e2e:android` (story 184).
- A suíte tem 13 fluxos e fecha 13/13 quando não dá o hiccup.

### Decisões travadas (usuário)

1. **Esta story investiga; não promete conserto.** A entrega é um **laudo** com a taxa de falha
   medida e a causa provável identificada por evidência. A correção entra aqui **apenas** se cair de
   bandeja (mudança óbvia, pequena e provada pelo próprio experimento); caso contrário, vira story
   própria, já com diagnóstico na mão.
2. **Nada de retry no runner nesta story.** Nem `--retry-count`, nem `sleep` de readiness, nem
   reordenar fluxo para "fugir" do problema.

### Decisões assumidas por default (rever se discordar)

3. **N = 10 execuções da suíte completa.** Com falha esporádica de 2 fluxos em 13, 10 bateladas dão
   base para distinguir "1 em 10" de "1 em 3" sem transformar a story num acampamento — são ~85 min
   de execução (8m31s por batelada verde, medido na 183). Se em 10 rodadas **nada** falhar, isso é o
   resultado, e o laudo diz que a taxa é menor que 1/10 e o que fazer com essa informação.
4. **Sempre com `pnpm test:setup` antes de cada batelada.** As suítes ficaram idempotentes na story
   182, mas isolar variável de estado do banco é de graça aqui e tira uma hipótese inteira da mesa.
5. **A instrumentação é externa ao app.** Um script de bancada (`scripts/`, fora do bundle) que roda
   a suíte N vezes, carimba cada execução e recolhe os artefatos. **Nada** entra no `ops.fonte` em
   runtime — o app não deve saber que existe Maestro (mesma regra da story 184).
6. **Coletar, por batelada:** saída do `maestro test` com timestamps, o diretório de debug do Maestro
   (`~/.maestro/tests/<run>/`: log do driver, screenshot e hierarquia de views do momento da falha),
   `adb logcat` do intervalo (filtrado por processo do app e por `maestro`/gRPC) e o tempo de cada
   fluxo. Sem o logcat correlacionado não dá para separar "app não subiu" de "driver não leu".
7. **Hipóteses a distinguir**, nomeadas de antemão para o laudo não virar prosa:
   - **(a) driver/gRPC** — o Maestro perde a conexão com o app ao ler a árvore; assinatura:
     `UNAVAILABLE` / `Command failed (tcp:NNNNN)` / heartbeat, com o app vivo no logcat;
   - **(b) launch do app** — o processo demora ou morre no boot (hidratação do store SQLite,
     `Sentry.wrap`, splash); assinatura: erro do app no logcat, ou primeiro `assertVisible` caindo
     com tela ainda de splash no screenshot;
   - **(c) emulador** — pressão de CPU/memória, ou o AVD engasgando entre bateladas; assinatura:
     lentidão generalizada na batelada inteira, não em dois fluxos;
   - **(d) o próprio fluxo** — `census` e `dashboard` têm alguma primeira asserção mais frágil que os
     outros 11 (ex: espera por dado que depende de rede) e são só os primeiros a sentir um atraso
     comum. Assinatura: sempre a **mesma** linha do yaml, e outros fluxos falhando quando reordenados
     para o início.
8. **Ordem de execução entra no experimento.** Rodar também com a ordem invertida (ou `census`/
   `dashboard` no fim). Se a falha seguir a **posição** e não o fluxo, a hipótese (d) cai e (b)/(c)
   ganham força — é o experimento mais barato que separa duas hipóteses de uma vez.

---

## Desenho

### 1. `apps/ops.fonte/scripts/maestro-flakiness-run.js` (novo, bancada)

Script Node, no espírito do `build-e2e-android.js` da story 184 (mesmas guardas: `ANDROID_HOME`,
serial explícito quando há mais de um device, API level ≤ 34):

- `--runs N` (default 10), `--reverse` para inverter a ordem dos fluxos, `--device <serial>`;
- por batelada: `pnpm test:setup` → `maestro test e2e/` → coleta;
- carimba cada execução num diretório de saída (`.maestro-flakiness/<timestamp>/`, **gitignored**):
  saída do runner, cópia do diretório de debug do Maestro daquela run, recorte do `adb logcat`, tempo
  por fluxo;
- ao fim, imprime a **tabela**: fluxo × execuções, falhas, tempo médio, tempo da falha.

O script é ferramenta de bancada, não gate: **não** entra em `pnpm test:ops` nem em CI.

### 2. `stories/done/187-laudo-maestro-flakiness.md` — o entregável

O laudo vai no repo, junto do plano arquivado, com:

- taxa de falha medida por fluxo e por posição na ordem;
- para cada queda: assinatura do erro, o que o screenshot/hierarquia mostravam, o que o logcat dizia
  do processo do app no mesmo instante;
- **qual das hipóteses (a)–(d) a evidência sustenta**, e quais foram descartadas e por quê;
- recomendação: correção proposta (com o arquivo que ela tocaria) ou, se a causa for do Maestro/
  emulador, o contorno aceitável e seu custo;
- se nada falhar em N execuções: registrar a taxa como < 1/N e a recomendação de reavaliar só se o
  sintoma voltar — resultado negativo também é resultado, desde que fique escrito.

### 3. `.gitignore`

`.maestro-flakiness/` — os artefatos (screenshots, logcat) são pesados e não versionáveis.

### 4. Correção, se e só se cair de bandeja

Se o experimento apontar causa **óbvia e pequena** (ex: uma asserção de `census` esperando dado que
só existe com rede, quando bastaria esperar o elemento de tela), corrigir aqui mesmo e provar com as
mesmas N execuções. Qualquer coisa maior — mudança no app, no runner, ou no ambiente — sai como story
nova com o laudo em anexo.

---

## Validação

Esta story é de investigação: o "teste" é o próprio experimento, e o critério de aceite é o laudo
responder as perguntas. Ainda assim, o que ela **produz em código** é testado.

### `ops.fonte` — unit, `pnpm test:ops:unit`

Mesmo padrão da story 184 (funções puras extraídas do script, testadas):

- parser de resultado do `maestro test` (saída → fluxo, status, duração) reconhece batelada verde,
  batelada com falha e saída truncada; saída inesperada **não** vira "verde" em silêncio — este caso
  é o que impede o experimento de mentir a favor da hipótese nula;
- agregação de N execuções produz a tabela certa (taxa por fluxo, por posição);
- guardas: `ANDROID_HOME` ausente → erro claro sem chamar adb; mais de um device sem serial → erro
  listando os devices; API level > 34 → aborta citando o level (mesma mensagem da story 184).

### Experimento

- **N = 10** bateladas na ordem normal + **3** com `--reverse`, todas com `pnpm test:setup` antes;
- artefatos completos das bateladas que falharam (sem log, a queda não conta para o laudo — só para a
  taxa);
- o laudo nomeia a hipótese sustentada e as descartadas.

### Regressão

`pnpm test:ops` continua sendo `maestro test e2e/`, **sem retry e sem espera nova** (decisão 2). Se a
story terminar com a suíte se comportando diferente sem que o laudo explique por quê, algo entrou de
contrabando.

### Gate de cobertura (trava a story)

`pnpm test:ops:unit:cov` — **não reduzir** a cobertura do `ops.fonte` (baseline 94.5 / 85.2 / 93.15 /
95.6; thresholds 90/81/89/93). Todo caminho novo do script tem teste correspondente; código novo sem
teste não fecha a story. Sem `skip`/`only`/`xfail` sem justificativa explícita no código
(`CLAUDE.md`).

---

## Fora de escopo

- **Retry ou espera de readiness no runner** — decisão 2. Se o laudo recomendar, é a story seguinte.
- **Trocar a versão do Maestro** para tentar sorte com SDK 36/37 — a story 184 fixou API 34 por ser o
  que está provado; mexer nisso é decisão própria.
- **Rodar Maestro em CI** — outra discussão (custo de runner com emulador, tempo de suíte). Este laudo
  é insumo para ela, não a resolve.
- **`app.fonte`** (`pnpm test:app`) — nunca foi executado; replicar depois que o caminho do
  `ops.fonte` estiver assentado, como já dizia a story 184.
- **Reescrever `census.yaml` ou `dashboard.yaml`** por precaução, sem evidência de que a asserção é a
  causa — é exatamente o tipo de conserto às cegas que esta story existe para evitar.
- **Paralelizar a suíte** — fixture isolada é pré-requisito (story 182 tratou disso no backend/adm),
  mas paralelismo no Maestro envolve device por worker.
