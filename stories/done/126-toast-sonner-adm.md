# Plan: Adotar toast (sonner) no adm.fonte — infra, padrão e curso bíblico

> **Status: PLANEJAMENTO.** Implementar só após aprovação do usuário.

## Context

O `adm.fonte` **não tem sistema de toast**. Não há `sonner` nem componente de toast nas
dependências, e nenhum arquivo em `src/` referencia `toast`. O `toast.error(getErrorMessage(...))`
citado no `CLAUDE.md` é guidance genérico do monorepo — não existe implementação no app. Hoje todo
feedback de mutation é **texto inline** (`<p className="text-xs text-destructive">…`), o que:

- some da vista quando o componente/dialog fecha depois do sucesso (sucesso não tem feedback nenhum);
- não comporta **ação no feedback** (ex: "Desfazer").

O gatilho é a story [[127]] ("já fez" nos sugeridos): ela precisa de um **desfazer imediato** logo
após uma ação permanente. Decidiu-se não embutir a adoção do toast dentro dela — infra
cross-cutting não pega carona em story de feature. Esta story vem antes e **destrava a 127**.

### Decisões travadas

1. **Biblioteca: `sonner`.** É a opção que o shadcn/ui (padrão de `components/ui/` do app) adota
   hoje; traz `toast.<tipo>()` imperativo e suporte nativo a **ação no toast** (`action: { label,
   onClick }`), que é o requisito da 127.
2. **Escopo de adoção = infra + padrão + `features/bible-courses`.** Migrar os ~63 arquivos que hoje
   usam `getErrorMessage` fica **fora**: é varredura grande, arriscada, e o app migra
   oportunisticamente conforme cada feature for tocada. O curso bíblico entra porque é o consumidor
   imediato (127).
3. **Erro de campo de formulário NÃO vira toast.** `errors.<campo>.message` (react-hook-form/zod)
   continua inline, ao lado do campo — validação pertence ao campo. Toast é para **resultado de
   ação** (mutation). Essa fronteira é o que separa os ~166 `text-destructive` do app: a maioria é
   erro de campo e fica como está.
4. **O toast mora nos hooks, não nas pages/components.** `onSuccess`/`onError` das mutations em
   `features/bible-courses/hooks/useBibleCourses.ts` disparam o toast, então todo consumidor ganha
   feedback uniforme e os componentes deixam de renderizar erro de mutation inline.
5. **Erro sempre via `getErrorMessage(error, fallback)`** (regra do CLAUDE.md) — o helper de toast
   encapsula isso para não sobrar cast manual em lugar nenhum.

## Desenho

### Infra

- Adicionar `sonner` às dependências de `apps/adm.fonte`.
- `apps/adm.fonte/src/components/ui/sonner.tsx` — wrapper no padrão shadcn dos demais `components/ui/`,
  exportando `<Toaster />` já com as classes do tema do app.
- Montar `<Toaster />` uma única vez na árvore de providers do `App.tsx` (junto do
  `QueryClientProvider`/`AuthContext`), fora das rotas — assim toast sobrevive à navegação.

### Padrão (`src/lib/toast.ts`)

Wrapper fino, para o app não importar `sonner` direto e o padrão não derivar:

- `toastSuccess(message: string)` → `toast.success(message)`.
- `toastError(error: unknown, fallback: string)` → `toast.error(getErrorMessage(error, fallback))`.
- `toastAction(message: string, action: { label: string; onClick: () => void })` → toast com ação;
  é o que a [[127]] usa para "Desfazer".

Documentar no wrapper (comentário curto) a fronteira da decisão 3: **mutation → toast; campo →
inline**.

### Adoção em `features/bible-courses`

Nos hooks de `useBibleCourses.ts`, cada mutation ganha `onSuccess` (toast de sucesso) e `onError`
(`toastError` com fallback específico), mantendo os `invalidateQueries` atuais:

| Hook | Sucesso | Fallback de erro |
|---|---|---|
| `useCreateBibleClass` | "Turma criada." | "Erro ao salvar turma." |
| `useUpdateBibleClass` | "Turma atualizada." | "Erro ao salvar turma." |
| `useDeleteBibleClass` | "Turma excluída." | "Erro ao excluir turma." |
| `useEnrollBulk` | "N filho(s) matriculado(s)." | "Erro ao matricular." |
| `useEnrollResident` | "Filho matriculado." | "Erro ao matricular." |
| `useUpdateEnrollment` | "Matrícula atualizada." | "Erro ao atualizar matrícula." |
| `useRemoveEnrollment` | "Matrícula removida." | "Erro ao remover matrícula." |

Componentes da feature perdem o markup de erro de mutation (o de campo permanece):

- `BibleClassDialog.tsx:127-130` — remover o `<p>` de `mutationError`; manter `errors.*` inline.
- `EligibleResidentsPanel.tsx:72-76` — remover o `<p>` de `enrollMutation.error`.
- `BibleCourseClassPhotoGallery.tsx` — erro **de mutation** vira toast; `clientError` (validação
  local de arquivo: tipo/tamanho) **fica inline**, pela decisão 3.

### Sem backend

Nenhuma mudança em `services/api`, `packages/types`, `api-client` ou Postman.

## Validação

Story frontend-only → sem `test:api`/`test:api:cov`, sem build de contratos, sem Postman.

- **`pnpm test:adm:unit`** — novo `lib/toast.test.ts` (mockando `sonner`):
  - `toastSuccess` chama `toast.success` com a mensagem;
  - `toastError` chama `toast.error` com o texto de `getErrorMessage` (erro de API com
    `response.data.message`) e com o **fallback** quando o erro não tem mensagem;
  - `toastAction` repassa `label`/`onClick` para a ação do toast.
- **`pnpm test:adm:unit`** — estender `useBibleCourses.test.tsx` (mockando
  `@/lib/toast`): cada mutation da tabela acima dispara `toastSuccess` no sucesso e `toastError`
  (com o fallback certo) no erro, sem quebrar os `invalidateQueries` já cobertos.
- **`pnpm test:adm:unit`** — atualizar `BibleClassDialog.test.tsx` e
  `EligibleResidentsPanel.test.tsx`: asserções de erro de mutation inline saem e viram asserção de
  `toastError`; **asserções de erro de campo continuam passando inalteradas** (prova da decisão 3).
- **`pnpm test:adm`** (Playwright, `e2e/bible-courses.spec.ts`): criar turma → toast de sucesso
  visível; forçar erro de mutation (rota interceptada com 500) → toast de erro visível.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:adm:unit:cov`; **não reduzir** a
cobertura de `features/bible-courses` nem de `lib/`. Sem `skip`/`only`/`xfail` sem justificativa no
código (CLAUDE.md).

## Fora de escopo

- **Migrar as outras ~60 features** que usam `getErrorMessage` inline — migração oportunista, quando
  cada feature for tocada.
- Converter erro de campo de formulário em toast (decisão 3 — não é para virar).
- Toast em `ops.fonte` / `app.fonte` (React Native, outra stack de UI).
- Substituir `ErrorState`/`EmptyState`/`LoadingState` — são estados de tela, não feedback de ação.
- Fila/histórico de notificações persistente (isso é a story [[19]], já em `done/`).
- O botão "já fez" em si — story [[127]].
