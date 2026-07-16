# Plan: Painel de sugeridos — selecionar/deselecionar todos e abrir filho em nova aba

> **Status: PLANEJAMENTO.** Implementar só após aprovação do usuário.

## Context

Refino do painel de sugestões de matrícula entregue pela story [[99]] (`done/`). Ao usar o painel na
criação de turma, faltaram duas ações práticas:

1. Com a lista toda marcada por padrão, o coordenador que quer matricular **poucos** precisa
   desmarcar um por um. Falta um controle de "todos / nenhum".
2. Antes de decidir matricular, o coordenador quer **conferir a ficha do filho** (histórico, tempo de
   casa, situação) — hoje teria que sair da turma e perder a seleção feita.

Story **frontend-only**: nenhuma mudança de backend, contrato ou Postman.

### Estado atual (o que já existe)

- `EligibleResidentsPanel` (`apps/adm.fonte/src/features/bible-courses/components/`) busca elegíveis
  via `useEligibleResidents`, mantém `selected: Set<string>` e **marca todos por padrão** sempre que
  a lista muda (`useEffect` em `[data]`). Botão "Matricular selecionados (N)" chama `useEnrollBulk`.
- `EligibleResidentRow` renderiza foto, nome, casa e tempo de casa dentro de um **`<label>` que
  envolve a linha inteira** — clicar em qualquer ponto da linha alterna o checkbox.
- O painel é renderizado na `BibleClassDetailPage` apenas quando `klass.enrollments.length === 0`.
- Rota da ficha do filho: `/residents/:id` (`App.tsx:91`), restrita a `ADMIN` e `COORDINATOR` — as
  mesmas roles que já acessam o painel, então não há caso novo de permissão.

### Decisões travadas

1. **Toggle é um checkbox no cabeçalho do painel**, não dois botões separados. Estado
   **tri-state**: marcado (todos), desmarcado (nenhum), `indeterminate` (seleção parcial). Clicar
   quando está marcado/indeterminado → desmarca todos; quando desmarcado → marca todos.
2. **O default continua "todos marcados"** (comportamento da story 99, não regride).
3. **O link abre em nova aba** (`target="_blank"` + `rel="noopener noreferrer"`), preservando a
   seleção em andamento no painel — esse é o motivo de ser nova aba e não navegação normal.
4. **Sai o `<label>` que envolve a linha.** Hoje a linha inteira é um `<label>`, então qualquer
   clique dentro dela — inclusive no link novo — alterna o checkbox. Em vez de contornar com
   `stopPropagation`, **remover o `<label>` de wrapper**: a linha vira `<div>`, o checkbox é
   controlado explicitamente e a área de conteúdo (foto + nome) chama `onToggle` no `onClick`. O
   link fica fora dessa área e não precisa de tratamento especial. O teste dessa regressão é
   obrigatório (ver Validação).
5. **Ícone `ExternalLink`** (lucide, já usado no app) como ação da linha, com `title`/`aria-label`
   "Abrir ficha de <nome> em nova aba" — a linha é densa e não comporta rótulo textual.

## Desenho

### `EligibleResidentsPanel.tsx`

- Cabeçalho ganha checkbox "Selecionar todos" à esquerda do título:
  - `checked` = `selected.size === eligible.length && eligible.length > 0`;
  - `indeterminate` (via `ref`, prop não declarativa no DOM) = `selected.size > 0 && selected.size < eligible.length`;
  - `onChange` → `setSelected(allChecked ? new Set() : new Set(eligible.map((r) => r.id)))`.
- Mostrar contagem "N de M selecionados" ao lado (o botão já mostra N; o cabeçalho dá o denominador).
- Componente está em ~90 linhas; cabe o acréscimo sem estourar o limite de ~150 (CLAUDE.md). Se
  passar, extrair `EligibleResidentsHeader`.

### `EligibleResidentRow.tsx`

- **Trocar o `<label>` de wrapper por `<div>`**, mantendo o visual atual da linha (borda, hover,
  gap). Estrutura: `<div>` [ checkbox | área clicável (foto + nome + subtítulo) | link ].
- Checkbox: continua controlado (`checked`, `onChange={() => onToggle(id)}`); como perde o `<label>`
  implícito, ganha `aria-label` com o nome do filho (ex: "Selecionar <nome>").
- Área de conteúdo: `onClick={() => onToggle(resident.id)}` + `cursor-pointer`. Sem `<label>`, o
  clique no link não borbulha para o checkbox.
- Link: `<a href={`/residents/${resident.id}`} target="_blank" rel="noopener noreferrer">` com
  `<ExternalLink size={14} />`. Usar `<a>` puro (não `<Link>` do router) — nova aba não precisa do
  roteador e evita interceptação de navegação.

### Fora do painel

Nada. Sem hook novo, sem query key nova, sem mudança em `packages/types` ou `api-client`.

## Validação

Story frontend-only → sem `test:api`/`test:api:cov`, sem build de contratos, sem Postman.

- **`pnpm test:adm:unit`** — estender `EligibleResidentsPanel.test.tsx`:
  - default mantém todos marcados e o checkbox do cabeçalho vem `checked`;
  - clicar no cabeçalho com todos marcados → seleção vazia; botão "Matricular selecionados (0)" fica
    `disabled`;
  - clicar de novo → todos marcados; botão volta a habilitar com a contagem certa;
  - desmarcar **um** filho → cabeçalho fica `indeterminate` (nem `checked` nem vazio);
  - a partir do estado parcial, clicar no cabeçalho → marca todos (não desmarca).
- **`pnpm test:adm:unit`** — estender `EligibleResidentRow.test.tsx`:
  - renderiza link com `href="/residents/<id>"`, `target="_blank"` e `rel` contendo `noopener`;
  - **clicar no link NÃO chama `onToggle`** (regressão da decisão 4 — o `<label>` saiu);
  - clicar no nome/foto continua chamando `onToggle` com o id;
  - clicar no checkbox chama `onToggle`; checkbox tem `aria-label` com o nome do filho.
- **`pnpm test:adm`** (Playwright, estender `e2e/bible-courses.spec.ts`): na turma sem matrículas,
  usar "selecionar todos" para desmarcar tudo → confirmar botão desabilitado → marcar todos →
  matricular → matrículas aparecem na turma.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:adm:unit:cov`; **não reduzir** a
cobertura de `features/bible-courses`. Sem `skip`/`only`/`xfail` sem justificativa no código
(CLAUDE.md).

## Fora de escopo

- Botão "já fez" / dispensa permanente da sugestão — story [[127]].
- Mudar a regra de elegibilidade (DROPPED, tempo mínimo, status) — comportamento atual está correto
  e permanece.
- Exibir o painel quando a turma já tem matrículas (hoje só aparece com `enrollments.length === 0`).
- Preview da ficha do filho em modal/drawer dentro da turma — decidido nova aba.
- Filtro/busca dentro da lista de sugeridos.
