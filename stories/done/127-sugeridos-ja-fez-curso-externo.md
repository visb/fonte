# Plan: Marcar "já fez" nos sugeridos — conclusão do curso bíblico fora do sistema

> **Status: PLANEJAMENTO.** Implementar só após aprovação do usuário.

## Context

O painel de sugestões de matrícula (story [[99]]) insiste em sugerir filhos que **já fizeram o curso
bíblico antes do sistema existir**. Como não têm matrícula registrada, nada os exclui da lista — e o
coordenador precisa lembrar, turma após turma, quem já passou pelo curso.

### Por que só esse caso sobrou

O item do BACKLOG "ignorar na listagem filhos q já passaram pelo curso bíblico" **já está atendido
pelo código atual** para todo mundo que tem matrícula registrada — a query de elegíveis exclui quem
tem enrollment com `status <> 'DROPPED'`, ou seja, `ENROLLED` e `COMPLETED` não aparecem
(`bible-course.service.ts:269-276`). Verificado também que as duas regras de desistência já valem
hoje, sem código novo:

- **desistente que continuou na casa volta a ser sugerido** (só `DROPPED` passa no filtro — é o
  desejado, ele pode refazer o curso);
- **desistente que saiu e voltou** só reaparece após o tempo mínimo, porque `readmit()` reseta
  `entry_date` e `status` para `PRE_ADMISSION` (`resident.service.ts:397-405`), e a sugestão exige
  `status IN (ACTIVE, DISCIPLINE)` + `entry_date <= hoje − 3 meses`.

Logo o único furo é o **histórico pré-sistema**, e o botão "já fez" é o que o fecha. Por isso o item
do BACKLOG foi colapsado nesta story.

### Decisões travadas

1. **Semântica = fato histórico do filho, não "esconde da lista".** "Já fez" afirma que ele
   **concluiu o curso fora do sistema**. Por isso aparece na ficha dele, e não só some da sugestão.
2. **Vale para sempre e atravessa acolhimentos.** O fato é do filho, não do acolhimento — sobrevive
   a alta/evasão/readmissão. Ele não volta a ser sugerido nem depois de reintroduzido.
3. **Tabela própria no módulo `bible-course`:** `bible_course_external_completions`. Mantém a
   persistência dentro do módulo dono do domínio (CLAUDE.md proíbe tocar tabela de outro módulo),
   dá **auditoria de quem/quando** de graça, o desfazer vira `deleted_at` (soft delete, convenção do
   repo) e a query de elegíveis só ganha mais um `NOT EXISTS`. Trade-off aceito: a ficha do filho faz
   1 request extra em vez de ler colunas já embutidas no response do resident.
4. **Permissão: `ADMIN` e `COORDINATOR`** — mesmas roles do painel de sugeridos e da ficha do filho.
   Nenhum caso novo de permissão.
5. **Dois caminhos de desfazer:** toast com ação **"Desfazer"** logo após o clique (engano na hora) e
   ponto permanente na **ficha do filho** (engano descoberto depois). Depende do toast da [[126]].
6. **Marcar é idempotente.** Clique repetido (duplo clique, corrida) não cria segunda marcação nem
   estoura erro — devolve a marcação existente.

### Dependências

- **[[126]]** (toast/sonner) — a ação "Desfazer" do toast não existe sem ela. **Implementar depois
  da 126.**
- **[[125]]** — mexe no mesmo `EligibleResidentRow.tsx` (remove o `<label>`, adiciona o link). Fazer
  depois evita conflito.

## Desenho

### Backend (`services/api`, módulo `bible-course`)

**Migration** (nova, nunca editar existente) — `src/database/migrations/`, seguindo o padrão
`<timestamp>-BibleCourseExternalCompletions.ts`:

```
bible_course_external_completions
  id           uuid pk default gen_random_uuid()
  resident_id  uuid not null → residents(id) on delete cascade
  marked_by    uuid null     → users(id) on delete set null
  marked_at    timestamptz not null default now()
  created_at / updated_at / deleted_at
```

- **Índice único parcial** `(resident_id) WHERE deleted_at IS NULL` — no máximo uma marcação ativa
  por filho; desmarcar e marcar de novo cria linha nova (histórico preservado).
- `marked_by` é `SET NULL` (não `CASCADE`): staff desligado não apaga o fato de que o filho fez o
  curso.

**Entity** `BibleCourseExternalCompletion` + registrar em `TypeOrmModule.forFeature([...])` no
`bible-course.module.ts`.

**Service** (`BibleCourseService`):

- `markExternalCompletion(residentId, userId)` — valida que o filho existe (query no padrão já usado
  em `findEligibleResidents`; 404 se não); se já houver marcação ativa, **devolve a existente**
  (decisão 6); senão cria com `markedBy = userId`.
- `unmarkExternalCompletion(residentId)` — soft delete da marcação ativa; 404 se não houver.
- `findExternalCompletion(residentId)` — devolve `{ markedAt, markedBy: { id, name } | null }` ou
  `null`.
- **`findEligibleResidents`** ganha mais um filtro na query:
  ```sql
  AND NOT EXISTS (
    SELECT 1 FROM bible_course_external_completions x
    WHERE x.resident_id = r.id AND x.deleted_at IS NULL
  )
  ```

**Controller** (`bible-course.controller.ts`, guard `ADMIN`/`COORDINATOR`):

- `POST   /bible-course/residents/:residentId/external-completion` → 201, marcação (usa o usuário do
  JWT como `markedBy`).
- `DELETE /bible-course/residents/:residentId/external-completion` → 204 (desfazer).
- `GET    /bible-course/residents/:residentId/external-completion` → marcação ou `null` (ficha).

`:residentId` validado como UUID v4 (`ParseUUIDPipe`).

### Contratos

- `packages/types`: `BibleCourseExternalCompletion { residentId, markedAt, markedBy: { id, name } | null }`.
- `packages/api-client` (`modules/bible-course.ts`): `markExternalCompletion(residentId)`,
  `unmarkExternalCompletion(residentId)`, `getExternalCompletion(residentId)`.
- **Postman**: adicionar os 3 endpoints em `fonte-api.postman_collection.json`.

### Frontend (`adm.fonte`)

**Hooks** (`features/bible-courses/hooks/useBibleCourses.ts`) + query keys em `lib/queryKeys.ts`
(nunca literal):

- `useResidentExternalCompletion(residentId)` — query da ficha.
- `useMarkExternalCompletion()` / `useUnmarkExternalCompletion()` — invalidam a query de elegíveis
  **e** a da ficha. Toast pelos hooks, no padrão da [[126]].

**Painel de sugeridos:**

- `EligibleResidentRow` ganha ação "Já fez" (ícone `GraduationCap`, `aria-label` "Marcar <nome> como
  já fez o curso"), ao lado do link de nova aba da [[125]].
- Ao marcar: a linha some (invalidate dos elegíveis) e sobe toast **com ação "Desfazer"** →
  `toastAction('<nome> marcado como já fez o curso.', { label: 'Desfazer', onClick: unmark })`. O
  desfazer reinvalida e a linha volta, se ainda elegível.
- O filho marcado sai de `selected` — não pode ser matriculado pelo botão em lote logo depois.

**Ficha do filho** (`features/residents/components/tabs/OverviewTab.tsx`):

- Linha "Curso bíblico": quando há marcação, "Concluído fora do sistema · marcado por <nome> em
  <data>"; quando não há, a linha não aparece (não inventa "não fez").
- Ação "Remover marcação" visível só para `canManage` (ADMIN/COORDINATOR) — é o desfazer permanente
  da decisão 5.
- **Sem aba nova** — a ficha já foi enxugada na [[96]]; isso é um campo, não uma seção.

## Validação

- **`pnpm test:api`** (unit `BibleCourseService`):
  - `markExternalCompletion`: cria com `markedBy` do usuário; **idempotente** — segunda chamada não
    cria linha nova e devolve a existente (decisão 6); 404 se o filho não existe; após desmarcar,
    marcar de novo cria linha nova.
  - `unmarkExternalCompletion`: soft delete (`deleted_at` preenchido, linha preservada); 404 se não
    há marcação ativa.
  - `findExternalCompletion`: devolve `markedAt`/`markedBy`; `null` quando não marcado; `null` quando
    a marcação está soft-deleted.
  - `findEligibleResidents`: **exclui** filho com marcação ativa; **volta a incluir** após desmarcar;
    marcação **não afeta** os demais filtros já cobertos (DROPPED, tempo mínimo, status).
- **`pnpm test:api:e2e`** (estender `test/bible-courses.e2e-spec.ts`):
  - `POST` marca → filho some de `GET /classes/eligible-residents`; `DELETE` → volta a aparecer;
  - `GET` da marcação devolve quem marcou;
  - **403** para role sem permissão (`SERVANT`) nos três endpoints; **404** para `residentId`
    inexistente; **400** para `residentId` não-UUID.
  - **Atravessa acolhimento (decisão 2):** filho marcado, com alta e readmitido, com `entry_date`
    antigo o bastante, **não** volta à lista de elegíveis.
- **`pnpm test:adm:unit`**:
  - `useBibleCourses.test.tsx`: mark/unmark invalidam elegíveis **e** ficha; disparam o toast certo;
  - `EligibleResidentRow.test.tsx`: botão "Já fez" chama o mutate com o id; não dispara `onToggle`
    (mesma regressão da [[125]]);
  - `EligibleResidentsPanel.test.tsx`: marcar remove o filho de `selected` (contagem do botão cai);
    toast de sucesso traz ação "Desfazer" que chama unmark;
  - `OverviewTab.test.tsx`: linha aparece com "marcado por/em"; some quando não há marcação; "Remover
    marcação" só com `canManage` e chama unmark.
- **`pnpm test:adm`** (Playwright, `e2e/bible-courses.spec.ts`): marcar "já fez" no painel → filho
  some da lista → "Desfazer" no toast → filho volta.
- **`pnpm build:types && pnpm build:api-client`** (mexeu em contratos) e
  **`pnpm --filter api migration:run:test`** (migration nova aplica limpa).

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` + `pnpm test:adm:unit:cov`; **não
reduzir** a cobertura do módulo `bible-course` nem de `features/bible-courses` e
`features/residents`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- **Backfill** de quem já fez o curso fora do sistema (marcação em massa/importação) — a marcação é
  feita à mão, conforme aparece na sugestão.
- Registrar **quando/onde** o filho fez o curso externo (ano, turma, local) — só o fato + auditoria
  de quem marcou.
- Relatório/listagem de "quem já fez o curso" e filtro por isso na lista de filhos.
- Marcar "já fez" fora do painel de sugeridos (ex: em lote pela lista de filhos).
- Mudar a regra de elegibilidade (DROPPED, tempo mínimo, status) — comportamento atual está correto.
- Expor a marcação no `ops.fonte`/`app.fonte`.
