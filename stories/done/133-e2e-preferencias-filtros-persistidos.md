# Plan: E2E Playwright do fluxo de preferências / filtros persistidos

## Context

A story 130 (preferências do usuário + filtros persistidos) entregou o backend, os contratos e o
frontend com **cobertura unit de 100%** no escopo tocado, mas **não** incluiu specs Playwright do
fluxo ponta-a-ponta. Foi uma decisão consciente registrada como PENDENTE-MANUAL: persistir o filtro
do usuário `admin@fonte.com` no **DB de teste compartilhado** vazaria entre os testes do restante da
suíte `residents.spec.ts` (ex.: o teste "lista o residente do seed" hidrataria um filtro salvo e
poderia esconder o João Testador), justamente numa suíte que **já tinha 6 falhas pré-existentes**
(ver story 131). Esta story fecha essa lacuna **com isolamento correto**, agora que o e2e de
`residents` volta a ser confiável.

### O que já existe (reusar)

- Backend `preference` (controller/service/module/entity + DTOs), 3 endpoints REST, migration
  `1783037200000-UserPreferences`, chave `residents.filters` (`RESIDENTS_FILTERS_PREFERENCE_KEY`).
- adm: `lib/preferences.ts`, `features/preferences/hooks/usePreference.ts`, hidratação no
  `ResidentsPage` (com o guard `didSyncSearch` que impede o efeito de sincronizar `q` na URL de
  sobrescrever a hidratação dos filtros no mount).
- Cobertura unit determinística dos 3 cenários do plano da 130 em `ResidentsPage`/`AuthContext`.

### Decisões / diretrizes

1. **Isolamento é o ponto central.** O filtro persiste no DB compartilhado, então cada spec que salva
   preferência **limpa depois de si**: `afterEach` (ou `test.afterEach`) fazendo
   `DELETE /preferences/residents.filters` do usuário logado, **antes** de qualquer outro teste
   assumir estado limpo. Sem isso, vaza. (Recomendação já anotada no ledger da rodada 125–130.)
2. **Não reintroduzir flakiness em `residents.spec.ts`.** Preferir um **arquivo de spec próprio**
   (ex.: `e2e/preferences.spec.ts`) que sobe, salva, verifica e limpa, em vez de embutir no
   `residents.spec.ts` já sensível. Se precisar tocar `residents`, garantir a limpeza.
3. **Cobrir os 3 cenários do plano da 130** ponta-a-ponta:
   - **filtrar → reload → filtro volta** (hidratação do DB sobrevive ao reload);
   - **link com querystring vence a preferência** (URL explícita tem prioridade sobre o salvo);
   - **outro usuário não herda** o filtro (preferência é por usuário).
4. **Depende da story 131** estar concluída (e2e de `residents` verde) — senão o novo spec roda sobre
   uma suíte instável e o sinal fica ambíguo. Ordem sugerida: 131 → 133.

## Desenho

- **`adm.fonte` e2e**: novo `e2e/preferences.spec.ts` (Playwright) com os 3 cenários + `afterEach` de
  limpeza via `DELETE /preferences/residents.filters`. Reusar helpers de login/sessão existentes.
- **Sem código de produção novo** — o comportamento já existe da 130; esta story só o exercita e2e.
  Se o e2e revelar um bug real de hidratação/prioridade, corrigir com teste (unit + o e2e que o pega).

## Validação

- **`pnpm test:adm`** (Playwright): `preferences.spec.ts` **verde** nos 3 cenários; a suíte e2e
  **inteira** roda depois sem regressão (prova de que a limpeza `afterEach` funciona e não há
  vazamento para `residents.spec.ts` nem para os demais).
- Rodar o spec **duas vezes seguidas** (ou em ordem embaralhada) para provar que não deixa estado
  residual — determinismo é o requisito central desta story.
- Se corrigir algum bug de produção descoberto: **`pnpm test:adm:unit`** cobre o ramo + o e2e o prova.

> **Gate de cobertura (trava a story):** é story **frontend/e2e-only** — citar os runners de
> cobertura do `adm.fonte` (`pnpm test:adm:unit:cov`) apenas se código de produto for tocado; caso
> contrário, o gate é **e2e verde e determinístico**, sem `skip`/`only`/`xfail` sem justificativa
> (CLAUDE.md). Nenhum caminho novo de produção sem teste.

## Fora de escopo

- Backend/contratos de preferências (entregues na 130).
- Persistir **outras** preferências além de `residents.filters` (ex.: tema, densidade de tabela).
- Consertar as falhas herdadas de `residents.spec.ts` — é a **story 131** (pré-requisito).
