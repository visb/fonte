# Plan: carnê de contribuição por acolhimento (filho com 2+ acolhimentos)

## Context

Filho com mais de um acolhimento mostra a aba **Contribuições** errada: aparecem as parcelas do
**primeiro** acolhimento onde deveriam aparecer as do **acolhimento atual**.

### O caso base, conferido em produção

Resident `5f02b5f2-835e-4493-80b3-d52837bef200` (`Marcelo Augusto de Souza`), consultado no banco de
produção nesta sessão:

- **Resident**: `status = ACTIVE`, `entry_date = 2026-07-17`, `house_id = 353162ae…`,
  **`family_investment = NULL`**, `contribution_due_day = NULL`, `contribution_exempt = false`.
- **Admissões (2)**:

  | # | entrada | saída | status | plano | `created_at` |
  |---|---|---|---|---|---|
  | 1 | 2025-08-01 | 2025-02-10 *(saída **anterior** à entrada — dado ruim da planilha)* | `EVADED` | `BASKET_500` | 2026-07-10 |
  | 2 | 2026-07-17 | — | `ACTIVE` | `null` | 2026-07-20 |

- **Carnê**: 6 parcelas, ago/2025 → jan/2026, R$ 500, todas `mandatory = true`, todas `PAID`. É
  exatamente `entry_date` da admissão **1** + os 6 meses obrigatórios no plano `BASKET_500`.
  **Nenhuma** parcela do acolhimento atual. Duas parcelas vieram pagas do import (ago/25, set/25) e
  **quatro têm `paid_at = 2026-08-08` (hoje)** — alguém registrou pagamento em parcela de
  acolhimento **encerrado** achando que era o carnê corrente. É o dano operacional do bug.

> **Nota:** o plano do acolhimento atual do Marcelo foi definido manualmente ainda nesta sessão,
> depois da consulta acima. Com plano, `recalcFuturePending` → `generateSchedule` materializa o carnê
> do acolhimento 2, e a aba passa a exibir as 6 parcelas de 2025 **misturadas** com as de 2026 — a
> causa A em estado puro, sem a causa B mascarando. A tabela acima é o retrato de antes do ajuste; os
> números do caso base nos testes descrevem esse retrato porque é ele que reproduz as duas causas.

### Causas no código

**Causa A — o carnê não conhece acolhimento.** `resident_receivables` só tem `resident_id`
(`resident-receivable.entity.ts:20-25`); não existe `admission_id`. `findByResident`
(`resident-receivable.service.ts:104`) devolve **todas** as parcelas do filho, ordenadas por
`reference_month ASC` — as competências do acolhimento antigo ficam no topo e são indistinguíveis
das do atual. Pior: ficam **acionáveis** (pagar/reabrir/declarar produto), que é como as quatro
parcelas de 2025 foram pagas hoje.

**Causa B — a readmissão sem plano não gera carnê nenhum, em silêncio.** `readmit`
(`resident.service.ts:386-465`) aceita `familyInvestment` opcional e grava `null` no `Resident`.
Depois chama `generateSchedule` (:462), que passa por `startIndex` (:384-391): sem plano →
`null` → **nenhuma parcela é criada**. O acolhimento atual do Marcelo ficou com carnê vazio e a aba
caiu inteira no histórico do primeiro. Nada na UI avisa que falta plano — o `ContributionPlanCard`
mostra "—" e segue.

**Causa C (achado secundário, real mas não é este caso) — "acolhimento atual" resolvido por
`createdAt`.** `ResidentService.update` (:297-300) e `findAdmissions` (:493) ordenam por
`createdAt DESC`. No import em lote, `ImportService.createPreviousAdmissions`
(`import.service.ts:229-255`) grava as admissões **antigas depois** da atual (a atual sai de
`ResidentService.create`, chamado antes) → `createdAt DESC` devolve a **mais antiga**. Editar a
ficha escreveria os campos de acolhimento na admissão errada e o `AdmissionsTab` numeraria
invertido. **No Marcelo isso não se manifesta** (admissão 1 = import em 2026-07-10, admissão 2 =
`readmit` em 2026-07-20, ordem coincide), mas se manifesta em qualquer ficha importada com histórico
de 2+ acolhimentos — e a resolução correta é pré-requisito do vínculo desta story.

### Decisões travadas (refinadas nesta sessão)

1. **Vínculo explícito**: nova coluna `admission_id` em `resident_receivables`, com **backfill** por
   janela de datas. Filtrar só por `reference_month >= entryDate` do acolhimento atual foi
   descartado — é frágil quando falta `entry_date`, quando há sobreposição, e não resolve a leitura
   do carnê antigo.
2. **Seletor por acolhimento na aba Contribuições**, com o **acolhimento atual selecionado por
   padrão**. O carnê antigo continua consultável (a operação precisa dele para conferir histórico),
   mas nunca é o que abre.
3. **Filho com um único acolhimento não ganha seletor** — a aba fica visualmente idêntica à de hoje.
4. **Acolhimento anterior é somente leitura**: sem "Registrar pagamento", sem "Reabrir", sem
   declarar contribuição em produto, sem "Alterar plano"/"Isentar". É o que impede a repetição do
   que aconteceu hoje com as quatro parcelas de 2025.
5. **`ContributionPlanCard` passa a refletir o acolhimento selecionado** (`familyInvestment` /
   `familyInvestmentAmount` da `Admission`), caindo para os campos do `Resident` quando a admissão
   não tem plano gravado (histórico importado). No acolhimento anterior, o card fica sem ações
   (decisão 4).
6. **Resolução de "acolhimento atual" corrigida nesta story** (causa C): ordenar por
   `entry_date DESC NULLS LAST`, desempate `created_at DESC`, em `ResidentService.update` e
   `findAdmissions`.
7. **Parcela sem admissão resolvível fica com `admission_id = NULL`** (filho sem nenhuma admissão —
   dado legado). Coluna **nullable**, sem `NOT NULL`: migration que quebra em produção por dado
   legado é pior que coluna nullable. Parcelas órfãs são exibidas junto ao acolhimento mais antigo,
   sem grupo extra na UI.
8. **Sem novo endpoint e sem query param.** `GET /residents/:id/receivables` continua devolvendo
   todas as parcelas, agora com `admissionId` no payload; o agrupamento é do frontend, que já busca
   `GET /residents/:id/admissions`. Uma query só, sem invalidação por acolhimento no React Query.
   Como o **response muda**, o `fonte-api.postman_collection.json` é atualizado.
9. **Regra de resolução (uma função só, reusada na escrita e no backfill):** para a competência `M`
   (primeiro dia do mês de referência) do filho R, entre as admissões de R (`deleted_at IS NULL`)
   ordenadas por `entry_date ASC`:
   a. admissão com `entry_date <= M` e (`exit_date IS NULL` **ou** `M <= exit_date`) — **ignorando**
      `exit_date` inválido, isto é, `exit_date < entry_date` (existe em produção: admissão 1 do
      Marcelo). Janela inválida é tratada como janela aberta;
   b. senão, a admissão de maior `entry_date <= M` (competência entre um acolhimento e o seguinte →
      pertence ao que a antecede);
   c. senão (competência anterior à primeira entrada), a admissão mais antiga;
   d. sem admissões → `NULL`.
   No Marcelo: ago/25→jan/26 têm `entry_date` 2025-08-01 `<= M < 2026-07-17` → todas vão para a
   admissão **1**, e o acolhimento atual abre vazio — que é o resultado correto.
10. **Acolhimento atual sem plano definido → estado vazio explícito com CTA** ("Plano de contribuição
    não definido. Defina o plano para gerar o carnê deste acolhimento." + botão "Alterar plano", que
    já existe e já dispara `recalcFuturePending` → `generateSchedule`). **Não** tornar
    `familyInvestment` obrigatório no `readmit`: travar a readmissão de quem ainda não negociou o
    plano é pior que sinalizar na aba. Isso cobre a causa B pela UI, sem mudar o contrato do readmit.
11. **Nada de reprocessar o carnê**: a story **não** cria, cancela nem apaga parcela retroativamente.
    Só vincula, ordena, exibe e sinaliza.
12. **Correção do dado sujo fica fora** — as quatro parcelas pagas hoje em acolhimento encerrado são
    ajustadas manualmente pela UI depois que o carnê do acolhimento atual existir.

## Desenho

### Backend — `services/api`

**Migration** `services/api/src/database/migrations/<timestamp>-AddAdmissionToReceivables.ts`
(timestamp acima de `1783037000000`, a mais recente hoje):

1. `ALTER TABLE resident_receivables ADD COLUMN admission_id uuid NULL`, FK →
   `admissions(id) ON DELETE SET NULL`, índice `(resident_id, admission_id)`.
2. Backfill em SQL puro implementando a decisão 9 (`LATERAL` sobre `admissions` do mesmo
   `resident_id` com `deleted_at IS NULL`, ordenando por `entry_date <= reference_month DESC,
   entry_date DESC`, com fallback para a mais antiga). O predicado de janela precisa neutralizar
   `exit_date < entry_date` (9a).
3. `down`: derruba índice, FK e coluna.

**`resident-receivable.entity.ts`**

4. `@ManyToOne(() => Admission, { nullable: true })` + `@Column({ name: 'admission_id', type:
   'uuid', nullable: true }) admissionId: string | null`.

**`resident-receivable.service.ts`**

5. Novo helper `resolveAdmissionId(residentId, referenceMonth, manager?)` implementando a decisão 9;
   em lote (`markImportedPayments` resolve N competências), carrega as admissões **uma vez** e
   resolve em memória.
6. `materializeUpTo` grava `admissionId` nas parcelas criadas — na prática a admissão atual, mas
   pelo mesmo resolver para não divergir.
7. `markImportedPayments`: parcela criada já paga recebe o `admissionId` resolvido **pela
   competência**; parcela existente que vira `PAID` não tem vínculo sobrescrito se já tiver um.
8. `ResidentReceivableView` ganha `admissionId: string | null`; `toView` propaga.
9. `findByResident`: mantém `reference_month ASC`; sem filtro no backend (decisão 8).
10. `recalcFuturePending` / `cancelFuturePending` / `cancelAfterExit`: passam a agir **apenas** nas
    parcelas da admissão atual (`admissionId = <atual>` **ou** `NULL`). Hoje
    `where: { residentId, status: PENDING }` alcançaria parcela pendente de acolhimento antigo.

**`resident.service.ts`**

11. Novo helper `findCurrentAdmission(residentId, manager?)` com a ordenação da decisão 6, usado por
    `update` (:297) e exposto ao receivable service por um método explícito
    (`getCurrentAdmissionId(residentId)`) — contrato claro, não query solta em outro módulo.
12. `findAdmissions` (:493) usa a mesma ordenação. TypeORM `order` não expressa `NULLS LAST` de
    forma portátil → `createQueryBuilder` com `ORDER BY entry_date DESC NULLS LAST, created_at DESC`.
13. `readmit` (:407) e `create` (:223) seguem criando a admissão como hoje; a única diferença é o
    vínculo do carnê gerado em seguida. `familyInvestment` continua opcional no readmit (decisão 10).

**Contratos**

14. `packages/api-client/src/types.ts`: `ResidentReceivable` ganha `admissionId: string | null`.
    Corrigir de passagem `Admission.houseId` para `string | null` (:576) — a entity é nullable desde
    `AllowNullResidentHouse` e o tipo mente hoje.
15. `fonte-api.postman_collection.json`: response de `GET /residents/:id/receivables` (novo campo) e
    de `GET /residents/:id/admissions` (ordem documentada).

### Frontend — `apps/adm.fonte`

**`features/residents/components/tabs/ContributionsTab.tsx`** (hoje 122 linhas; decompor —
CLAUDE.md ~150 linhas)

16. Busca `useResidentAdmissions(resident.id)` junto de `useResidentReceivables`. A ordem vem
    correta do backend (item 12): índice 0 = acolhimento atual.
17. Estado `selectedAdmissionId`, inicializado com a admissão atual. Lista =
    `receivables.filter(r => r.admissionId === selectedAdmissionId)`; parcelas com
    `admissionId == null` entram no grupo da admissão **mais antiga** (decisão 7).
18. Novo `ContributionAdmissionSelector`: não renderiza com `admissions.length <= 1` (decisão 3);
    com 2+, seletor com rótulo `Acolhimento N — <entrada> a <saída|"em aberto">` e sufixo
    **"(atual)"** no vigente.
19. `isCurrent = selectedAdmissionId === admissions[0]?.id`. Quando `false`: `canManage` efetivo vira
    `false` para as linhas (`ReceivableRow` sem pagar/reabrir/produto) e o `ContributionPlanCard`
    perde "Alterar plano"/"Isentar" (decisão 4), com aviso curto "Acolhimento encerrado — somente
    leitura" acima da lista.
20. `ContributionPlanCard` recebe `admission?: Admission` e lê plano/valor dela com fallback no
    `resident` (decisão 5); `canManage` segue controlando as ações.
21. **Estados vazios distintos** (decisão 10), no acolhimento atual sem parcela:
    - plano **não definido** (`familyInvestment == null` e não isento) → "Plano de contribuição não
      definido. Defina o plano para gerar o carnê deste acolhimento." + botão "Alterar plano" (abre o
      `ChangeContributionPlanDialog` já existente) — **é o caso do Marcelo**;
    - plano SOCIAL ou isento → mensagem atual ("Plano social ou acolhido isento não geram parcelas.");
    - acolhimento **anterior** sem parcela → "Nenhuma parcela neste acolhimento.", sem CTA.
    O seletor continua visível em todos eles.
22. `RegisterPaymentDialog` e o fluxo de produto continuam recebendo `houseId` do `resident` — a
    decisão 4 garante que só o acolhimento atual chega lá.

## Validação

Sem `skip`/`only`/`xfail` injustificado.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` e
`pnpm --filter adm.fonte test:unit:cov` com cobertura ≥90 do código tocado e **sem reduzir** a
cobertura de `resident-receivable`, `resident` (backend) e `features/residents` (adm.fonte).

Contratos e schema mudaram: `pnpm build:types`, `pnpm build:api-client`,
`pnpm migration:run:test` (up **e** revert) e Postman atualizado (item 15).

- **Unit backend `resident-receivable.service.spec.ts`** (existe — estender):
  - `resolveAdmissionId`: competência dentro de `entry→exit` cai na admissão certa; competência
    **entre** dois acolhimentos cai no que a antecede (9b); competência anterior à primeira entrada
    cai na mais antiga (9c); filho sem admissão → `null` (9d); admissão em aberto captura tudo a
    partir da entrada; **admissão com `exit_date < entry_date` é tratada como janela aberta** (9a —
    caso real do Marcelo); admissão com `deleted_at` é ignorada.
  - `materializeUpTo`/`generateSchedule`: parcela nova nasce com `admissionId` da admissão atual.
  - `markImportedPayments`: com 2 acolhimentos, competência antiga vincula ao **primeiro** e a
    recente ao **atual**; parcela já `PAID` com vínculo não é sobrescrita.
  - `recalcFuturePending`/`cancelFuturePending`/`cancelAfterExit`: parcela PENDING de acolhimento
    **anterior** não é alterada nem cancelada; a do atual e a de `admissionId NULL` continuam sendo.
  - `findByResident`: view devolve `admissionId`.
  - **Cenário Marcelo, ponta a ponta no service**: filho com admissão 1 (2025-08-01, `BASKET_500`,
    saída inválida 2025-02-10) + admissão 2 (2026-07-17, plano `null`) e 6 parcelas ago/25→jan/26 →
    todas as 6 vinculadas à admissão 1 e **nenhuma** à admissão 2.
- **Unit backend `resident.service.spec.ts` / `resident.service.extra.spec.ts`** (existem —
  estender):
  - `update` com campo de admissão escreve na admissão de **maior `entry_date`** mesmo quando ela é
    a de `created_at` mais antigo (regressão da causa C);
  - admissão sem `entry_date` não ganha da que tem (`NULLS LAST`);
  - empate de `entry_date` desempata por `created_at DESC`;
  - `findAdmissions` devolve do mais recente ao mais antigo por `entry_date`;
  - `readmit` **sem** `familyInvestment` continua permitido e não cria parcela (comportamento
    preservado — a sinalização é na UI, decisão 10).
- **Unit backend `import.service.spec.ts`** (existe — estender): commit de ficha com 2 acolhimentos +
  histórico de contribuição cobrindo os dois → parcelas distribuídas entre as duas admissões.
- **E2E backend (`pnpm test:api:e2e`)**: `GET /residents/:id/receivables` responde com `admissionId`
  preenchido; `GET /residents/:id/admissions` ordenado por entrada decrescente.
- **Migration**: `migration:run:test` + `migration:revert` limpos; o backfill é exercitado por um
  filho de 2 acolhimentos no `seed-test.ts` (criar se não houver), replicando o formato do caso base
  — inclusive a saída anterior à entrada.
- **Unit adm.fonte `ContributionsTab.test.tsx`** (existe — estender):
  - filho com 1 acolhimento: **nenhum** seletor, lista igual à de hoje (decisão 3);
  - filho com 2 acolhimentos: abre no **atual** e mostra só as parcelas dele — regressão direta do
    bug relatado;
  - **caso Marcelo**: acolhimento atual sem parcela e sem plano → CTA "Alterar plano" visível e
    **nenhuma** parcela do acolhimento antigo renderizada (decisão 10);
  - trocar para o acolhimento anterior mostra as parcelas antigas, o aviso de somente leitura e
    nenhum botão de pagar/reabrir/alterar plano/isentar (decisão 4);
  - parcela com `admissionId: null` aparece no grupo do acolhimento mais antigo (decisão 7);
  - plano SOCIAL/isento mantém a mensagem atual (não vira CTA);
  - resident sem `houseId` continua no empty state atual.
- **Unit adm.fonte `ContributionAdmissionSelector.test.tsx`** (novo): rótulo com número, datas e
  sufixo "(atual)"; `onChange` emite o id escolhido; não renderiza com ≤1 admissão.
- **Unit adm.fonte `ContributionPlanCard.test.tsx`** (existe — estender): plano vem da admissão
  selecionada; admissão sem plano cai no plano do resident (decisão 5); sem ações fora do
  acolhimento atual.
- **Unit adm.fonte `AdmissionsTab.test.tsx`** (existe — estender): com a nova ordem, "Acolhimento 2"
  é o mais recente e "Acolhimento 1" o mais antigo.
- **E2E adm.fonte (`pnpm test:adm`)**: ficha de filho com 2 acolhimentos (seed) → aba Contribuições →
  abre no acolhimento atual; trocar o seletor troca a lista.

## Fora de escopo

- **Corrigir os pagamentos já lançados em parcela de acolhimento encerrado** (as quatro de 2025 com
  `paid_at = 2026-08-08`) e qualquer varredura equivalente em produção — decisão 12, ajuste manual
  pela UI depois.
- **Corrigir valores/competências do histórico importado** (parcela com valor errado, mês faltando) —
  decisão 11.
- **Editar carnê de acolhimento encerrado** (pagar, reabrir, declarar produto, mudar plano) —
  decisão 4.
- **Tornar `familyInvestment` obrigatório no `readmit`** — decisão 10.
- **Sanear `exit_date` inválido** (saída anterior à entrada) nas admissões importadas: a story
  **tolera** o dado (9a), não o conserta.
- **`NOT NULL` em `admission_id`** e limpeza das parcelas órfãs — decisão 7.
- **`getLastPaidDates`** (badge "próxima cobrança" da listagem/`FilhosPage`) continua olhando o
  máximo global do filho.
- **`ops.fonte` / `app.fonte` / `portal.fonte`** — a aba Contribuições é do `adm.fonte`.
- **Vincular follow-ups (`FollowUpType.CONTRIBUTION`) ao acolhimento** — mesma mistura, outra tabela
  e outra tela; story separada.
