# Laudo — flakiness da suíte Maestro do `ops.fonte` (story 187)

> ## ⚠ EXPERIMENTO PENDENTE DE EXECUÇÃO
>
> **Este laudo está vazio de dados de propósito.** A parte codificável da story 187 (bancada de
> medição + testes) foi entregue e está verde; o experimento em si **não foi executado** porque a
> máquina da rodada 185–187 não tinha emulador nem aparelho Android conectado (`adb devices` vazio).
> Maestro 2.6.x só opera em **API level ≤ 34** (story 184), então nem havia alvo possível.
>
> **Nenhum número aqui pode ser inventado.** Enquanto as tabelas abaixo estiverem com `—`, a taxa de
> falha da suíte permanece **desconhecida** e o achado 3 da rodada 182–184 continua em aberto: numa
> batelada de `pnpm test:ops`, `census` e `dashboard` caíram em ~7s cada (11/13) e passaram isolados
> e na batelada seguinte, sem qualquer edição.
>
> Preencher este arquivo (e só então movê-lo para `stories/done/`) é o que fecha a story 187.

## Como rodar o experimento

Pré-requisitos (todos da story 184 — a receita não muda):

1. emulador/aparelho em **API ≤ 34** ligado e autorizado:
   `sdkmanager "system-images;android-34;google_apis;x86_64"` →
   `avdmanager create avd -n Maestro_API34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6` →
   `emulator -avd Maestro_API34`;
2. APK de release instalado no aparelho:
   `pnpm --filter ops.fonte build:e2e:android --device <serial>` e o `adb install -r` que ele imprime;
3. API de teste de pé: `pnpm test:setup` (uma vez) + `pnpm dev:api:test`;
4. Metro rodando (`pnpm dev:ops`) — no Android, `adb reverse tcp:8081 tcp:8081` se o emulador não
   alcançar o bundler.

Com isso de pé, o experimento é **exatamente** estes dois comandos (~85 min + ~26 min, tempo medido
de batelada verde na story 183: 8m31s):

```bash
# 10 bateladas na ordem normal — cada uma é `maestro test e2e/`, o mesmo comando do pnpm test:ops
pnpm --filter ops.fonte maestro:flakiness --runs 10 --device <serial>

# 3 bateladas com a ordem invertida — separa "falha do fluxo" de "falha da posição"
pnpm --filter ops.fonte maestro:flakiness --runs 3 --reverse --device <serial>
```

A bancada (`apps/ops.fonte/scripts/maestro-flakiness-run.js`) roda `pnpm test:setup` antes de cada
batelada (decisão 4), limpa o logcat, executa a suíte, e grava em
`apps/ops.fonte/.maestro-flakiness/<timestamp>/run-NN/` (gitignored): `maestro-stdout.txt`,
`maestro-stderr.txt`, `debug/` (log do driver, screenshot e hierarquia de views do momento da queda),
`logcat.txt` (recorte por `org.fonte.ops`, `maestro`, gRPC, `ActivityManager`, crash/ANR) e
`result.json`. Ao fim imprime — e grava em `summary.txt`/`summary.json` — a tabela que preenche as
seções 1 e 2 deste laudo.

**Batelada cuja saída o parser não conseguiu ler entra como `inconclusive`, não como verde.** Ela
conta no denominador de "bateladas executadas" e aparece nomeada na seção 3; não pode ser usada como
evidência a favor de nenhuma hipótese.

## 1. Taxa de falha por fluxo

Copiar da tabela do runner (colunas: fluxo, execuções, falhas, taxa, tempo médio, tempo da falha).

| fluxo | execuções | falhas | taxa | tempo médio (verde) | tempo da(s) falha(s) |
| --- | --- | --- | --- | --- | --- |
| auth.spec | — | — | — | — | — |
| census | — | — | — | — | — |
| dashboard | — | — | — | — | — |
| incidents | — | — | — | — | — |
| ministries | — | — | — | — | — |
| notifications | — | — | — | — | — |
| phone-login | — | — | — | — | — |
| product-contributions | — | — | — | — | — |
| resident-flow | — | — | — | — | — |
| resident-wishlist | — | — | — | — | — |
| residents | — | — | — | — | — |
| residents-offline | — | — | — | — | — |
| storeroom | — | — | — | — | — |

- Bateladas executadas: — (normais: —, `--reverse`: —)
- Bateladas verdes: — · vermelhas: — · inconclusivas: —

## 2. Taxa de falha por posição na ordem

O cruzamento que a story existe para fazer: se a falha seguir a **posição** e não o **fluxo**, a
hipótese (d) cai.

| posição | execuções | falhas | taxa | fluxos que ocuparam a posição |
| --- | --- | --- | --- | --- |
| 1 | — | — | — | — |
| … | — | — | — | — |

## 3. Assinatura de cada queda

Uma entrada por falha observada. **Queda sem artefato não entra aqui** — conta só para a taxa da
seção 1 (decisão da seção "Validação" do plano).

### Queda 1 — batelada NN (`normal`/`reverse`), fluxo `—`

- **Erro do Maestro:** (linha exata do `maestro-stdout.txt`, com o passo do yaml que caiu)
- **Duração até a queda:** —
- **Screenshot / hierarquia de views (`debug/`):** (o que estava na tela: splash? tela logada?
  elemento ausente? árvore vazia?)
- **Logcat no mesmo instante (`logcat.txt`):** (o processo `org.fonte.ops` estava vivo? houve
  `FATAL EXCEPTION`/ANR? aparece `UNAVAILABLE`/`Failed to record heartbeat`?)
- **Leitura:** (o que essa queda, sozinha, sustenta ou derruba)

## 4. Hipóteses

Nomeadas de antemão no plano para o laudo não virar prosa. Marcar **sustentada / descartada /
sem evidência** e dizer por quê, citando a seção 3.

| # | Hipótese | O que ela prevê (assinatura) | Veredito |
| --- | --- | --- | --- |
| (a) | **driver/gRPC** — o Maestro perde a conexão com o app ao ler a árvore de views | `UNAVAILABLE` / `Command failed (tcp:NNNNN)` / heartbeat no stdout ou no logcat, **com o processo do app vivo** no logcat e screenshot mostrando o app em tela normal | — |
| (b) | **launch do app** — o processo demora ou morre no boot (hidratação do store SQLite, `Sentry.wrap`, splash) | erro do app no logcat (crash/ANR) **ou** primeiro `assertVisible` caindo com splash na tela do screenshot; falha concentrada no **início** de cada fluxo | — |
| (c) | **emulador** — pressão de CPU/memória, AVD engasgando entre bateladas | lentidão **generalizada** na batelada inteira (tempo médio de todos os fluxos subindo naquela run), não queda de dois fluxos | — |
| (d) | **o próprio fluxo** — `census`/`dashboard` têm primeira asserção mais frágil (ex.: espera dado que depende de rede) | **sempre a mesma linha** do yaml caindo, e a falha **acompanhando o fluxo** quando a ordem inverte (seção 2) | — |

Combinações também contam: (b) e (c) se reforçam se a queda seguir a posição; (a) e (d) se separam
pela assinatura do erro. Se duas hipóteses ficarem em pé, dizer isso e qual medida as separaria.

### Resultado negativo também é resultado

Se nenhuma batelada falhar: registrar a taxa como **< 1/N**, com N = bateladas efetivamente
executadas (as inconclusivas não contam como verdes), e recomendar reavaliar só se o sintoma voltar.
Nesse caso o valor da story é o instrumento: o próximo vermelho já nasce com bancada para medir.

## 5. Recomendação

- **Se a causa for do app** (b): arquivo que a correção tocaria, e por quê — **story própria**, com
  este laudo em anexo. Retry no runner continua proibido (decisão 2): esconderia bug de produção.
- **Se a causa for do fluxo** (d) e for **óbvia e pequena**: corrigir e provar com as mesmas N
  execuções — é o único caso que a story 187 fecha sozinha.
- **Se a causa for do Maestro/emulador** (a)/(c): qual contorno é aceitável, **com o custo dito em
  voz alta** (tempo de suíte, risco de mascarar regressão) — decisão de story própria.
- Em qualquer caso: se a recomendação for mexer no runner, ela sai daqui como **proposta**, não como
  mudança já feita. `pnpm test:ops` fecha esta story como abriu: `maestro test e2e/`, sem retry e sem
  espera nova.

## Estado atual da story 187

| Item | Estado |
| --- | --- |
| `apps/ops.fonte/scripts/maestro-flakiness-run.js` (bancada) | entregue |
| `apps/ops.fonte/tests/maestroFlakinessRun.test.ts` (unit dos puros) | entregue, verde |
| `.gitignore` → `.maestro-flakiness/` | entregue |
| Regressão: `pnpm test:ops` = `maestro test e2e/` | verificada por teste |
| **Experimento (10 normais + 3 `--reverse`)** | **PENDENTE-MANUAL — sem aparelho API ≤ 34** |
| **Seções 1–5 deste laudo** | **PENDENTES — dependem do experimento** |
