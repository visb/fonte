# Laudo — flakiness da suíte Maestro do `ops.fonte` (story 187)

**Experimento executado em 2026-08-17/18.** Emulador `Maestro_API34` (AVD `sdk_gphone64_x86_64`,
**API 34**, x86_64), Maestro **2.6.0**, APK de release da story 184
(`pnpm --filter ops.fonte build:e2e:android`), API de teste na porta 3001, `pnpm test:setup` antes de
**cada** batelada (decisão 4). Único device conectado durante todo o experimento.

**14 bateladas · 182 execuções de fluxo · 237 launches do app.**

| braço | bateladas | verdes | vermelhas | inconclusivas |
|---|---|---|---|---|
| ordem normal (`maestro test e2e/`) | 11 | 5 | 6 | 0 |
| ordem invertida (`--reverse`, fluxos explícitos) | 3 | 3 | 0 | 0 |

> **Ressalva de método, registrada antes dos números:** as 11 bateladas da ordem normal saíram de
> duas invocações da bancada (1 de sanidade + 10 do experimento), com o mesmo comando, o mesmo APK e
> o mesmo emulador — foram tratadas como uma amostra só. Duas bateladas do lote inicial foram
> reprocessadas **a partir do stdout salvo** depois de dois bugs do parser serem corrigidos (ver §5);
> nenhum resultado foi re-executado para "melhorar", e o stdout bruto de cada batelada está nos
> artefatos.

---

## 1. Taxa de falha medida

### Por batelada

**6 de 11 bateladas em ordem normal terminaram vermelhas — 55%.** A suíte fecha 13/13 em menos da
metade das execuções. A hipótese de trabalho da story ("hiccup ocasional de launch") **subestimava o
problema em uma ordem de grandeza**: não é 1 em 10, é mais de 1 em 2.

### Por fluxo (11 bateladas, ordem normal)

| fluxo | exec | falhas | taxa | tempo médio (verde) | tempo da falha |
|---|---|---|---|---|---|
| incidents | 11 | 3 | 27% | 36s | 18s, 18s, 18s |
| census | 11 | 2 | 18% | 41s | 18s, 34s |
| notifications | 11 | 2 | 18% | 24s | 18s, 18s |
| phone-login | 11 | 2 | 18% | 32s | 18s, 35s |
| resident-wishlist | 11 | 2 | 18% | 40s | 18s, 18s |
| auth.spec | 11 | 1 | 9% | 1m01s | 35s |
| dashboard | 11 | 1 | 9% | 19s | 34s |
| ministries | 11 | 1 | 9% | 39s | 18s |
| resident-flow | 11 | 1 | 9% | 28s | 18s |
| product-contributions | 11 | 0 | 0% | 1m08s | — |
| residents | 11 | 0 | 0% | 38s | — |
| residents-offline | 11 | 0 | 0% | 34s | — |
| storeroom | 11 | 0 | 0% | 45s | — |

**9 dos 13 fluxos falharam ao menos uma vez.** Nenhum fluxo concentra o problema.

### Por posição na ordem (11 bateladas, ordem normal)

| posição | fluxo | falhas | taxa |
|---|---|---|---|
| 1 | auth.spec | 1 | 9% |
| 2 | census | 2 | 18% |
| 3 | dashboard | 1 | 9% |
| 4 | incidents | 3 | 27% |
| 5 | ministries | 1 | 9% |
| 6 | notifications | 2 | 18% |
| 7 | phone-login | 2 | 18% |
| 8 | product-contributions | 0 | 0% |
| 9 | resident-flow | 1 | 9% |
| 10 | resident-wishlist | 2 | 18% |
| 11 | residents-offline | 0 | 0% |
| 12 | residents | 0 | 0% |
| 13 | storeroom | 0 | 0% |

As falhas se espalham pelas posições 1–10 sem gradiente que sugira degradação ao longo da batelada.
As quatro posições finais limpas não formam padrão com N=11 (o esperado por posição é ~1 falha).

### Braço invertido

**3 bateladas, 39 execuções de fluxo, 51 launches: 3/3 verdes, zero falhas, zero natimortos.** Sob a
taxa por launch da ordem normal (6,5%), o esperado em 51 launches seria ~3,3 quedas; observar zero
tem probabilidade ≈ 3,4%. É **sugestivo, não conclusivo** — e vem com um confundidor honesto: o braço
`--reverse` não muda só a ordem, muda **a forma da invocação** (lista explícita de yamls em vez do
diretório). Ver §4.

---

## 2. Assinatura das quedas

As 15 quedas se separam em **duas** assinaturas, e só uma delas é a flakiness que a story perseguia.

### Assinatura A — launch natimorto (12 de 15 quedas)

Erro do Maestro: `Element not found: Text matching regex: input-email`, sempre em **18s** (o timeout
do `tapOn`). Screenshot da queda: **tela de splash em branco** — o login nunca renderizou.

Logcat do mesmo instante (`run-05`, pid 28074):

```
00:15:26.149 I/ActivityManager: Start proc 28074:org.fonte.ops/u0a192 for next-top-activity {org.fonte.ops/.MainActivity}
00:15:26.157 I/ActivityManager: Killing 28074:org.fonte.ops/u0a192 (adj -10000): remove task
00:15:36.156 W/ActivityManager: Process ProcessRecord{6f8aebc 28074:org.fonte.ops/u0a192} failed to attach
```

O processo é morto **8 ms** depois de nascer, por `remove task`, e 10 s depois o sistema desiste dele
(`failed to attach`). Nunca aparece `Displayed org.fonte.ops/.MainActivity` para esse pid.

**Correlação medida, batelada a batelada** (launches sem `Displayed`, com `remove task` + `failed to
attach`):

| batelada | launches | displayed | natimortos | quedas por `input-email` |
|---|---|---|---|---|
| sanidade run-01 | 16 | 14 | 2 | 2 |
| run-01 | 17 | 14 | 3 | 3 |
| run-02 | 17 | 15 | 2 | 2 |
| run-03 | 17 | 17 | 0 | 0 |
| run-04 | 17 | 17 | 0 | 0 |
| run-05 | 17 | 14 | 3 | 3 |
| run-06 | 17 | 17 | 0 | 0 |
| run-07 | 15 | 14 | 1 | 1 |
| run-08 | 17 | 17 | 0 | 0 |
| run-09 | 17 | 17 | 0 | 0 |
| run-10 | 17 | 16 | 1 | 1 |
| `--reverse` (3 bateladas) | 51 | 51 | 0 | 0 |

**12 natimortos, 12 quedas — correlação exata, sem sobra dos dois lados.** Toda batelada verde tem
zero natimortos. Taxa por launch na ordem normal: **12/186 ≈ 6,5%**.

### Assinatura B — login pendurado (3 de 15 quedas)

Só na `run-07`, nas posições 1–3 (`auth.spec`, `census`, `dashboard`). Erro:
`Assertion is false: "Bem-vindo," is visible`, em ~34-35s. O logcat mostra `Displayed` normal em
**todos** os launches dessa batelada — o app subiu. O screenshot mostra a tela de login **preenchida**
(`operator@fonte.com`, senha mascarada) com o botão em estado de carregando: a requisição de login
saiu e não voltou a tempo.

Throttler **descartado**: o log da API de teste não registra nenhum `ThrottlerException`/429 em todo
o experimento (o limite é 120 req/min por IP, `app.module.ts:65`).

---

## 3. Hipóteses: o que a evidência sustenta e o que ela mata

| hipótese (do plano) | veredito | por quê |
|---|---|---|
| **(a) driver/gRPC** — Maestro perde a conexão ao ler a árvore | **descartada como causa raiz** | Nenhum `UNAVAILABLE`, `Command failed (tcp:...)` ou loop de heartbeat em 14 bateladas. O driver **leu** a árvore e reportou honestamente que o elemento não estava lá — porque não estava. |
| **(b) launch do app** — processo demora ou morre no boot (hidratação do store, `Sentry.wrap`, splash) | **confirmada no sintoma, refutada na causa** | O sintoma é launch, sim. Mas o processo é morto em **8 ms**, antes de rodar qualquer código do app: hidratação do SQLite, `Sentry.wrap` e splash estão **inocentes**. Culpar o boot do app aqui seria consertar o lugar errado. |
| **(c) emulador** — pressão de CPU/memória entre bateladas | **não sustentada** | Nenhum `lowmemorykiller`, `am_kill` por memória, ANR ou `Skipped N frames`. Os launches que sobrevivem exibem a tela em **600–760 ms**, uniformemente, inclusive nas bateladas vermelhas. Não há lentidão generalizada. |
| **(d) o próprio fluxo** — `census`/`dashboard` têm asserção mais frágil | **morta** | 9 dos 13 fluxos caíram; `census` e `dashboard` não lideram (`incidents` tem a maior taxa). A primeira asserção que falha é a mesma para todos, e é a **primeira do fluxo**, logo após `launchApp`. |

### Causa provável (assinatura A)

**Corrida dentro do `launchApp: clearState: true` do driver**, entre o `clear data` / `remove task`
que ele faz para zerar o estado e o start do processo que o próprio launch acabou de pedir ao
ActivityManager. O sistema começa a subir `MainActivity` (`for next-top-activity`), o driver derruba
a task (`adj -10000`, prioridade de foreground — não é reclamação de memória) e o processo recém-criado
morre antes de anexar. Em ~6,5% dos launches a ordem dos dois eventos se inverte.

Isso é **do driver, não do app** e **não do gRPC**. Todos os 13 yamls abrem com
`launchApp: clearState: true`, o que explica por que qualquer fluxo pode ser a vítima da vez.

### Causa da assinatura B

**Não isolada.** O que se sabe: app renderizado, credenciais digitadas, requisição de login em voo,
sem resposta em ~34s; throttling descartado. Concentrada numa única batelada e nas três primeiras
posições — compatível com uma lentidão momentânea da API de teste no host (que roda em
`nest start --watch`), mas isso é hipótese, e este laudo não promove hipótese a diagnóstico. Fica
registrada com os artefatos para a próxima ocorrência.

---

## 4. Recomendação

**Nada disso entra como conserto nesta story** (decisão 1: a correção só entraria se caísse de
bandeja, pequena e provada pelo próprio experimento — não é o caso). E **retry continua proibido**
(decisão 2): agora que a causa está identificada, retry seria explicitamente esconder uma corrida
do driver — e o custo de 55% de bateladas vermelhas é alto demais para ser mascarado.

Story seguinte, com este laudo em anexo, deve testar **nesta ordem** (da hipótese mais barata para a
mais cara), cada uma com N ≥ 10 bateladas pela mesma bancada:

1. **Separar `clearState` do `launchApp`** nos 13 yamls: `- clearState` como comando próprio antes de
   `- launchApp` (sem a flag). Se a corrida é entre limpar e subir, sequenciar os dois em comandos
   distintos a elimina. É a mudança mais barata e a que ataca a causa medida.
2. **Forma da invocação:** rodar a ordem normal com a **lista explícita** de yamls, como o braço
   `--reverse` faz. Isola o confundidor de §1 — se der verde com N ≥ 10, o `maestro test e2e/`
   (diretório) é o gatilho e `pnpm test:ops` muda de forma.
3. **Versão do Maestro:** se 1 e 2 falharem, é bug do driver 2.6.0 em API 34, e a discussão passa a
   ser upgrade — sabendo que a story 184 fixou API ≤ 34 justamente por incompatibilidade das versões
   novas com SDK 36/37. Aqui o custo cresce e a decisão é do usuário.

**Enquanto isso, a leitura correta de um vermelho do `pnpm test:ops`** é: queda de `Element not
found` aos ~18s logo na primeira asserção do fluxo = assinatura A, ambiente, **não regressão**. A
prova barata é o logcat: `Killing <pid>:org.fonte.ops ... remove task` sem `Displayed` para o mesmo
pid. Qualquer outro erro, ou falha em asserção que não seja a primeira do fluxo, é para investigar
como regressão de verdade.

---

## 5. Subproduto: dois bugs da própria bancada, achados pela saída real

O plano previa (PENDENTE-MANUAL 3 do recibo da story) que o parser, escrito contra saída sintética,
podia precisar de ajuste no primeiro contato com o Maestro de verdade. Precisou — três vezes, e as
três falharam **do lado seguro**, sem nunca inventar um verde:

1. **`--debug-output` é flag do subcomando `test`, não global.** Antes do `test`, o Maestro 2.6.0
   recusa a invocação inteira (`Unknown options: '--debug-output'`) e a batelada morre sem rodar nada.
   A bancada marcou `inconclusive` com o motivo certo. Corrigido em `27c1fed`.
2. **Sumário da batelada verde vem com o tempo colado:** `13/13 Flows Passed in 8m 30s`. O regex não
   tolerava o sufixo, e **5 bateladas 13/13 verdes foram reportadas como "saída truncada"**. Sem a
   correção, o laudo teria concluído que metade das bateladas não termina — conclusão errada, na
   direção alarmista.
3. **Nome do fluxo reprovado vinha grudado com a duração** (`incidents (18s)` como se fosse um fluxo
   distinto de `incidents`), rachando a agregação em linhas duplicadas de "100% de falha". O motivo da
   falha, que agora é capturado num campo próprio, é o que sustenta a §2.

Os três casos viraram teste de regressão com a **saída literal** do Maestro em
`apps/ops.fonte/tests/maestroFlakinessRun.test.ts`. As 11 bateladas afetadas foram **reprocessadas a
partir do stdout salvo**, sem re-executar nada.

---

## 6. Estado das pendências que o experimento fechou de carona

- **`pnpm test:ops` das stories 185 e 186 — validado em aparelho.** `product-contributions` passou em
  **11 de 11 bateladas** (ordem normal) e **3 de 3** (invertida), média de 1m08s, **sem o `swipe`**
  (story 185) e **logado como operador** (story 186). É a única coisa que a suíte inteira nunca
  reprovou — o fluxo que as duas stories tocaram é o mais estável do conjunto.
- **`resident-flow` e os demais 12 fluxos** rodaram nas 14 bateladas; a suíte fecha 13/13 quando a
  corrida do driver não morde.
- **Prova manual do `ChangeMinistryModal` (story 185)** segue pendente: é interação manual, não
  coberta por yaml.

## Artefatos

Fora do git (`.maestro-flakiness/`, gitignored), na máquina do experimento:

```
apps/ops.fonte/.maestro-flakiness/2026-08-17T23-28-08/   # sanidade (1 batelada)
apps/ops.fonte/.maestro-flakiness/2026-08-17T23-38-32/   # ordem normal (10 bateladas)
apps/ops.fonte/.maestro-flakiness/2026-08-18T01-07-51/   # --reverse (3 bateladas)
```

Cada `run-NN/` traz `maestro-stdout.txt`, `maestro-stderr.txt`, `logcat.txt` (filtrado por processo do
app, driver e crashes), `result.json` e `debug/` do Maestro (log do driver, screenshot e hierarquia de
views do momento da queda).

## Reproduzir

```bash
emulator -avd Maestro_API34
pnpm --filter ops.fonte build:e2e:android --device <serial>
adb -s <serial> install -r apps/ops.fonte/android/app/build/outputs/apk/release/app-release.apk
pnpm dev:api:test
pnpm --filter ops.fonte maestro:flakiness --runs 10 --device <serial>
pnpm --filter ops.fonte maestro:flakiness --runs 3 --reverse --device <serial>
```
