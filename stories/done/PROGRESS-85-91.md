# PROGRESS — stories 85–91 (cobertura de testes — piso 90%) [RODADA ANTERIOR — ARQUIVADA]

Rodada autônoma (AUTORUN). Epic **85** (guarda-chuva, NÃO se implementa) + filhas. Sequência do epic
78 (que travou 80%, já arquivado). Trabalho = subir cada pacote a **90% statements** e a catraca.

Ordem: `86 → 87 → 88 → 89 → 90 → 91`. Fonte de verdade: esta seção + git log.

**Natureza**: rodada de TESTES. Salvo 91 (config de gate CI), nenhuma story muda código de produção/
contrato/migration/Postman. Sem dependência externa → **nenhum PENDENTE-MANUAL esperado**.

## Dependências
- **86, 87, 88, 89, 90 são independentes** — cada uma toca só o seu pacote; se uma travar, registrar
  e seguir (não para a fila).
- **91 (gate) depende de 86–90 ≥ 90%** — só mergear o gate quando todas no piso; senão travar
  threshold parcial dos prontos e registrar BLOQUEADO os demais.
- **Sub-fases (87a–e)** = checkpoints commitáveis/mergeáveis que sobem a catraca; a story é arquivada
  quando o pacote inteiro bate 90% statements.

## Baseline (verificado 2026-06-26, gate 80% verde)
api 81.69% (4359/5336) · adm 80.02% (10314/12888) · ops 81.4% (1545/1898) · app 83.77% (284/339) ·
portal 83.17% (717/862) · api-client 99.06% (741/748). Exclusões de orquestração já aplicadas (epic
78) — **não ampliar** para inflar; catraca só sobe.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 86 — cobertura services/api 81.69→90% | [OK] 90.32% | api unit 946✓ (99 suites); cov 90.32% stmt (br 75.79 / fn 87.23 / ln 92.52); catraca jest 90/75/87/92 | 4b7022a | 0d7725d |
| 2 | 87 — cobertura adm.fonte 80.02→90% (87a–87b) | [OK] 90.65% | adm unit verde; cov 90.65% stmt (br 85.88 / fn 83.87 / ln 90.65) medida em ~100s; catraca vitest 90/85/83/90. **Bloqueio era falso**: não era o provider v8 — um loop de render em `HouseDialog` (default `[]` instável na dep do `useEffect`) pendurava o worker do tinypool no fim da suíte. Corrigido o bug, a cov roda normal | bb17540 + 87b | 0cc97ea + 87b |
| 3 | 88 — cobertura ops.fonte 81.4→90% | [OK] 91.3% | ops unit 513✓ (52 suites); cov 91.3% stmt (br 81.12 / fn 89.97 / ln 93.1); catraca jest 90/81/89/93 | 727a505 | 71dbc6f |
| 4 | 89 — cobertura app.fonte 83.77→90% | [OK] 91.74% | app unit 111✓ (21 suites); cov 91.74% stmt (br 81.71 / fn 91.66 / ln 93.89); catraca jest 90/81/91/93 | 9138c02 | bea9e86 |
| 5 | 90 — cobertura portal.fonte 83.17→90% + api-client trava 90% | [OK] portal 99.16% / api-client 99.06% | portal unit 93✓ (19 suites); cov 99.16% stmt (br 86.99 / fn 98.27 / ln 99.16); catraca vitest portal 90/86/98/99, api-client 90/99/98/99 | 094370f | 906c66e |
| 6 | 91 — catraca global 90% + gate CI | [OK] 6/6 | thresholds:90 travados nos 6 pacotes (api/ops/app/portal/api-client + adm 90/85/83/90); docs (CONTRIBUTING+fonte-workflow) subidas 80→90 sem exceção — adm destravado pela 87b | ced6d88 + 87b | d37c20f + 87b |

## Log

<!-- [OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver> -->

[OK] 87b + 91 (DESBLOQUEIO 2026-06-27) — **o bloqueio do adm era um diagnóstico errado.** A cobertura do adm.fonte não era "não mensurável por causa do provider v8": a suíte rodava todos os 147 arquivos e passava, mas **nunca encerrava** — um loop de render em `apps/adm.fonte/src/features/houses/components/HouseDialog.tsx` mantinha o event loop do worker do tinypool vivo, e o worker era morto/pendurava no fim. Causa exata: `const { data: staffList = [] } = useStaff(...)` cria uma **nova referência de array a cada render** e `staffList` estava nas deps de um `useEffect` que **nem o usa** → render→effect→`reset()`→render→… (em produção o react-query memoiza `data`, então o loop só disparava no teste, onde o mock devolvia array novo a cada render). Bissecção binária (grupos→arquivo→par→componente) isolou `HouseDialog`; probe com `process.getActiveResourcesInfo()` confirmou o worker morrendo. **Fix de 1 linha** (remover `staffList` das deps — bug real de hook, não só de teste). Depois disso a cov do adm roda em **~100s** (v8 `all:true`, 4 forks). **87b**: 80.02→**90.65% statements** (br 85.88 / fn 83.87 / ln 90.65) com 16 specs novos (StaffServiceSelector, ActivityFilters, Create/EditAssociateDialog, EnrollResidentDialog, CensusReviewModal, MeetingFamiliesModal, ActivityDialog, AuthContext, Create/EditEventDialog, SalesByHouseTable, ContributionSummaryCards, useTheme, useInfiniteScroll). Catraca vitest do adm subida 80→90 (br 83→85 / fn 80→83 / ln 80→90); rodada COM threshold enforçado verde (exit 0). **91**: gate global fecha 6/6 — adm destravado; exceção do adm removida de CONTRIBUTING.md e da skill fonte-workflow. TESTES-ONLY + 1 fix de produção (HouseDialog, bug de hook). — 2026-06-27 — sem bloqueio.

[PARCIAL] 91 — gate de cobertura subido para 90%, parcial. Os thresholds por pacote já tinham sido travados em `statements:90` pelas próprias filhas: api 90/75/87/92 (story 86, jest), ops 90/81/89/93 (88, jest), app 90/81/91/93 (89, jest), portal 90/86/98/99 (90, vitest), api-client 90/99/98/99 (90, vitest) — verificado lendo os 5 configs. Esta story só (a) subiu a documentação do gate de 80→90 em `CONTRIBUTING.md` e na skill `fonte-workflow`, com a **exceção do adm.fonte** explícita, e (b) registrou o estado. **adm.fonte fica em `statements:80`** (não subido) porque a story 87 está BLOQUEADA na medição (ver abaixo) — subir o piso do adm às cegas arriscaria gate vermelho permanente. `pnpm test:cov:all` completo não roda nesta máquina (trava no coverage do adm); os outros 5 pacotes são verdes individualmente no piso de 90 (ops/app/portal medidos neste turno; api na story 86; api-client 99% trivial). DOC-ONLY: nenhuma mudança de código de produção/contrato/endpoint; nenhum threshold baixado. — commit: ced6d88 — merge: d37c20f — 2026-06-27 — **BLOQUEIO PARCIAL**: o piso global de 90 só fecha 100% quando o adm for medido e climbado (depende da story 87). Story 91 NÃO arquivada (fica em stories/ aguardando o adm).

[BLOQUEADO] 87 (atualização do turno 2026-06-27) — confirmada e aprofundada a investigação do bloqueio de medição da cobertura do adm.fonte, agora com **dois providers testados e ambos inviáveis nesta máquina**: (1) **v8 com `all:true`** — degenera no passo de remap (CPU-bound; reproduzido de novo neste turno: ~204 testes em alguns minutos e nunca emite `coverage-summary.json`); (2) **istanbul** (instalado `@vitest/coverage-istanbul@2.1.9` só para o teste e depois revertido do package.json/lock) — em paralelo derruba o worker do tinypool (`Worker exited unexpectedly`, OOM); em **single-fork + 6 GB de heap** roda sem crashar mas é lento demais (~37 de ~130 arquivos em ~30 min → ~1,5 h só de execução, antes do remap). Conclusão: a cobertura do adm **não pode ser medida** num ciclo prático aqui — e como o adm precisa climbar ~1286 statements de 80→90 (o maior denominador do monorepo), o trabalho iterativo medir-escrever-medir é **inviável autonomamente nesta máquina**. O 87a (já mergeado) segue válido: specs que passam só elevam a cobertura acima do baseline 80.02%, então a catraca:80 continua honesta. **Desbloqueio**: medir o adm num ambiente onde o runner conclua (CI Linux ou máquina mais rápida) — aí subir a catraca do adm e fazer 87b–87e + fechar a 91. Nada de produção tocado. — 2026-06-27.

[OK] 90 — testes: portal.fonte unit 93✓ (19 suites), cobertura final 99.16% statements (br 86.99 / fn 98.27 / ln 99.16) — META 90% SUPERADA. **Re-baseline**: App.tsx (shell do roteador — providers + <Routes>, orquestração pura, análogo ao App/AppLayout do adm excluído na story 80) adicionado ao coverage.exclude COM comentário justificando (coberto por E2E Playwright); isso mexeu o baseline de 83.17% (717/862) para 85.86% (717/835) SEM teste novo, registrado antes de contar progresso. Catraca vitest portal subida (só p/ cima): statements 80→90 / branches 77→86 / functions 87→98 / lines 83→99; rodada COM threshold enforçado verde. api-client já em 99.06% (741/748) — apenas subiu thresholds.statements 80→90 (br/fn/ln mantidos 99/98/99), verde com folga, sem teste novo. +5 arquivos de spec com asserts reais (vi.mock de @/lib/api como na story 82): DynamicField (todos os 10 tipos de campo — short_text/long_text/number/date/email/phone/boolean/select/multi_select/file — + required, options vazio, add/remove do multi_select, mensagem de erro), RegistrationFileField (upload→fileKey, "Arquivo enviado.", erro→getErrorMessage+clear, early-return sem arquivo), PixPayment (render QR+copia-e-cola, ausências, copiar via fireEvent→"Copiado!", catch da cópia), formatEventDate (só início / intervalo início–fim), e copy-link de RegistrationSuccess (sucesso→"Link copiado!" / catch). Nota técnica: cópia testada via fireEvent.click + Object.defineProperty(navigator.clipboard) — userEvent.setup() instala clipboard próprio e sobrescreve o mock. — commit: 094370f — merge: 906c66e — arquivo: 4a130db — 2026-06-27 — sem bloqueio. TESTES-ONLY: nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman; só *.test.* + coverage.thresholds/exclude dos dois vitest.config. Exclusões da story 82 mantidas (portal pages/** + sentry.ts; api-client barrel src/index.ts) — NÃO ampliadas além da exclusão justificada do App.tsx. E2E Playwright do portal (precisa docker/API) não rodado aqui — non-gate; DoD = cobertura unit ≥90% verde. Story 90 CONCLUÍDA e arquivada em stories/done/.

[OK] 89 — testes: app.fonte unit 111✓ (21 suites), cobertura final 91.74% statements (br 81.71 / fn 91.66 / ln 93.89) — META 90% ATINGIDA (baseline 83.77 / 76.65 / 82.57 / 86.49). Catraca jest subida (só p/ cima): statements:90 / branches:81 / functions:91 / lines:93; rodada COM threshold enforçado verde (exit 0). +12 specs novos com asserts reais (jest-expo + helper central lib/test/utils.tsx, mock @fonte/api-client via @/lib/api por arquivo, expo-av/expo-image-picker/expo-document-picker mockados): MessageBubble (thumb de imagem com url resolvida + abrir/fechar modal de tela cheia — ImageAttachment), AudioPlayer (retomar playAsync com som já criado, seek na barra de progresso ratio→setPositionAsync, ignora seek sem duração/largura), LoginForm (atalhos __DEV__ de credenciais válidas/inválidas via setValue → submit), ProfileDataForm (atalhos __DEV__ preencher/resetar nome via setValue), useProfile (ramo web do upload de foto: fetch→blob→FormData), useMessages (ramo web do upload de anexo: fetch→blob→File, nome+extensão derivados do mime), auth (ramo catch da hidratação quando AsyncStorage.getItem rejeita). — commit: 9138c02 — merge: bea9e86 — arquivo: 12b8b7b — 2026-06-27 — sem bloqueio. TESTES-ONLY: nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman; só *.test.* + coverageThreshold do jest.config.js. Exclusões de orquestração da story 84 mantidas (app/**, features/**/pages/**, _layout, lib/test/**) — NÃO ampliadas. Residuais deixados justificados: stopRecording/onPressOut do MessageInput (envio de áudio fim-a-fim) seguem p/ E2E Maestro — ciclo onPressIn/onPressOut do Pressable instável no jsdom (recordingRef inacessível no stop, confirmado empiricamente); sentry.ts (0%, wiring de observabilidade sem DOM) e api.ts getToken (1 stmt, fábrica do client) deixados como na 84, sem teste falso. Maestro nativo não rodado (opcional/non-gate). Story 89 CONCLUÍDA e arquivada em stories/done/.

[OK] 88 — testes: ops.fonte unit 513✓ (52 suites), cobertura final 91.3% statements (br 81.12 / fn 89.97 / ln 93.1) — META 90% ATINGIDA (baseline 81.4 / 70.22 / 82.4 / 83.4). Catraca jest subida (só p/ cima): statements:90 / branches:81 / functions:89 / lines:93; rodada COM threshold enforçado verde (exit 0). ~71 specs novos com asserts reais (jest-expo + helper central lib/test/utils.tsx, mock @fonte/api-client via @/lib/api por arquivo, expo-av/expo-image-picker/expo-document-picker mockados): WheelDatePickerModal (scroll/clamp/confirm/cancel), supply-room SupplyRoomFields + utils re-export, activities constants/ActivityCard (transições por papel/status DRAFT→REQUESTED, TODO→DOING, DOING→BLOCKED/DONE, BLOCKED→DOING/DONE, onPress)/AudioPlayer (onStatus/pause/cycleSpeed setRateAsync)/AudioRecorder (parar→onRecorded m4a/webm, falha→Alert, erro start), messages AudioPlayer ciclo (toggle/onStatus/seek/finish) + MessageInput (câmera/galeria/documento/gravar+soltar→envia áudio/cancelar), census AddResidentModal (foto permitir/negar/cancelar, CPF/RG/nacionalidade, erro) + RemoveResidentModal (alta DISCHARGED/evasão EVADED/transferência houseId/sem casas/erro), house-settings HousePhotoGallery (permissão/cancelar/addPhoto/removePhoto), support-groups CreateMeetingModal (submit createMeeting) + QRCodeModal (export SVG nativo → FileSystem+Sharing), ministries CreateMinistryModal (líder staff/sem líder/toggle filhos/contador/cancelar), storeroom+supply-room ItemSearchInput (dropdown/filtrar/selecionar/cadastrar novo/estoque/vazio), residents ResidentPhoto (abrir/fechar modal/fallback thumb). — commit: 727a505 — merge: 71dbc6f — arquivo: 6a6c086 — 2026-06-27 — sem bloqueio. TESTES-ONLY: nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman; só *.test.* + coverageThreshold do jest.config.js. Exclusões de orquestração da story 81 mantidas (app/**, features/**/pages/**, _layout) — NÃO ampliadas; sentry.ts (0%, wiring de observabilidade sem DOM) deixado como na 81, sem teste falso. Maestro nativo não rodado (opcional/non-gate). Story 88 CONCLUÍDA e arquivada em stories/done/.

[PARCIAL] 87a — testes: +19 specs de unidade residents+houses com asserts reais (RTL): HouseDialog, LeaderAutocomplete, AddRule/RemoveRule/RulesTab, CapacityRequestRow/CapacityRequestsTab, EditMinistryLeaderDialog/MinistriesTab/RemoveMinistryDialog, StaffTab/StoreroomTab/SupplyRoomTab, houses/constants, AddRelativeDialog, import/ImportWarnings, residents/tabs/TrackingTab, wizard/FirstPaymentDetails, wizard/WizardSteps. Suíte adm COMPLETA verde (todos os arquivos passam, execução de testes ~40s). Catraca vitest MANTIDA em statements:80 (br 83 / fn 80 / ln 80) — NÃO subida. — commit: bb17540 — merge: 0cc97ea — 2026-06-26 — **BLOQUEIO**: nesta máquina o passo de *remap* de cobertura do v8 com `all:true` está degenerado (CPU-bound, >2,4 CPU-horas sem concluir em 3 tentativas independentes: rodada wedgeada CPU 8666s morta; 2 re-execuções limpas — inclusive com reporters leves `json-summary`/`text` — não emitiram `coverage-summary.json`). Apenas ~282 arquivos-fonte (~1 MB), nenhum arquivo gigante/gerado — slowness é do provider v8, não dos dados. Consequência: o % atingido NÃO pôde ser medido, então a catraca não foi elevada (subir às cegas arriscaria gate vermelho). Adicionar specs que passam só pode ELEVAR a cobertura acima do baseline 80.02% — nunca reduzi-la — logo a catraca:80 segue válida e o checkpoint é durável. TESTES-ONLY: zero mudança de produção/contrato/DTO/endpoint/config (threshold inalterado). Próximo: re-medir quando o remap concluir (ou via runner alternativo) e então subir a catraca + seguir 87b–87e.

[OK] 86 — testes: services/api unit 946✓ (99 suites), cobertura final 90.32% statements (br 75.79 / fn 87.23 / ln 92.52) — META 90% ATINGIDA (baseline 81.69/69.76/78.23/84.10). Catraca jest subida (só p/ cima): statements:90 / branches:75 / functions:87 / lines:92. ~133 statements novos cobertos: guards (roles, must-change-password), interceptors (audit, sensitive-data), schedulers (backup, storeroom-usage, signed-url-cache), jwt.strategy, notification.gateway (socket auth/rooms/emit), MetaWhatsAppClient (mock global.fetch: sucesso/erro-payload/rede/sem-credencial), controllers finos (backup, audit, app-settings, public-associate, associate-charge, public-event-payment, pagarme-webhook) e ramos de service (wishlist, ministry, relative[findMe/updateMe/uploadPhoto], document-template[generatePdf via browser injetado/onModuleDestroy/computeAge], support-group[queries+detail+history], consent[resolveSubjectForUser], supply-room+storeroom[CRUD+findMovements qb], house-capacity-request[getById/listForHouse]). Repos/deps mockados, sem banco/IO/HTTP real. — commit: 4b7022a — merge: 0d7725d — arquivo: 354347b — 2026-06-26 — sem bloqueio. TESTES-ONLY: nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman; só specs + coverageThreshold. E2E não rodado neste disparo (stack de API teste — dev:api:test:3001 + DB teste seedado — fora do ar; docker postgres up mas sem o NODE_ENV=test); por ser tests-only SEM mudança de produção, regressão de e2e é impossível por construção (precedente documentado rodada 77–84). Story 86 CONCLUÍDA e arquivada em stories/done/.

## Resumo final da rodada 85–91 (ENCERRADA 2026-06-27)

Epic **85** (piso de cobertura 90%): **6 stories [OK]** (87 e 91 destravadas em 2026-06-27 — ver
log 87b+91). Todas mergeadas na `main` (`--no-ff`, sem push, branches preservadas).

| Story | Pacote | Status | Cobertura final (stmts) | Catraca (stmt/br/fn/ln) |
| --- | --- | --- | --- | --- |
| 86 | services/api | [OK] | 90.32% | 90/75/87/92 (jest) |
| 87 | adm.fonte | **[OK]** | 90.65% | 90/85/83/90 (vitest) |
| 88 | ops.fonte | [OK] | 91.3% | 90/81/89/93 (jest) |
| 89 | app.fonte | [OK] | 91.74% | 90/81/91/93 (jest) |
| 90 | portal.fonte | [OK] | 99.16% | 90/86/98/99 (vitest) |
| 90 | @fonte/api-client | [OK] | 99.06% | 90/99/98/99 (vitest) |
| 91 | gate global | **[OK]** | 6/6 pacotes no piso 90 | docs 80→90, sem exceção |

### O que passou
- **86/88/89/90**: cobertura subida a ≥90% statements por testes puros (mocks locais; sem tocar
  produção). Catraca de cada pacote travada em `statements:90` (branch/fn/lines no valor atingido).
  Helper central de teste por pacote reusado. Ops 81.4→91.3, app 83.77→91.74, portal 83.17→99.16
  (com re-baseline honesto do App.tsx, orquestração), api-client 99% (só threshold).
- **91**: docs do gate (CONTRIBUTING + skill fonte-workflow) subidas de 80% para 90%, agora **sem
  exceção** — adm destravado. Os thresholds por pacote travados em 90 pelas filhas 86/88/89/90 + 87b.

### O desbloqueio do adm (87b, 2026-06-27)
O "bloqueio de medição" da rodada original foi **mau diagnóstico**: não era o provider v8/istanbul.
A suíte do adm rodava e passava os 147 arquivos, mas **nunca encerrava** — `HouseDialog.tsx` tinha
`useStaff` com default `= []` (ref nova por render) numa dep de `useEffect` que nem usava a var →
loop de render que mantinha o worker do tinypool vivo (morria/pendurava no fim; com 12 forks ainda
dava OOM por pressão). Em produção o react-query memoiza `data`, então o loop só aparecia no teste.
Isolado por bissecção binária + probe `process.getActiveResourcesInfo()`; **fix de 1 linha** (bug
real de hook). Cov do adm passou a rodar em ~100s. Então 87b subiu 80.02→**90.65% statements** com
16 specs e travou a catraca vitest do adm em 90/85/83/90 (rodada COM threshold verde, exit 0). 91
fechou 6/6 e removeu a exceção do adm dos docs.

### Natureza / honestidade
TESTES-ONLY + **1 fix de produção** (HouseDialog, bug de hook — dep instável). Nenhuma mudança de
contrato/DTO/endpoint/migration/Postman. Catraca só sobe, nunca desce.

### Não executado (fora do gate / ambiente)
- E2E (Playwright adm/portal, Maestro ops/app) e o workflow CI real não rodaram (docker/API de
  teste fora do ar; sem runner GitHub local). Stories tests-only + 1 fix isolado → regressão de e2e
  improvável; o fix do HouseDialog é coberto pelo unit (6 specs verdes).

### Reproduzir
6 pacotes no piso 90: `pnpm test:api:cov && pnpm test:api-client:cov && pnpm test:portal:cov &&
pnpm test:ops:unit:cov && pnpm test:app:unit:cov && pnpm --filter adm.fonte test:unit:cov` (todos
verdes; adm 90.65% em ~100s).

---

