# Plan: Atividades — editor WYSIWYG na descrição (links + formatação, markdown)

## Context

Follow-up do módulo Atividades (story 48), do modal de detalhes (story 62) e da story 71
(descrição fora do board). Item 2 do BACKLOG: **a descrição deve aceitar links e formatação por um
editor WYSIWYG.**

Hoje a descrição é um `Textarea` de texto puro (no `ActivityDetailsDialog` do adm e na edição do
ops). O adm.fonte **já tem TipTap** (`@tiptap/*` 3.22.5) em produção no `TemplateEditor`
(`features/settings/`), com toolbar de link (`LinkToolbar`/`LinkBubbleMenu`). **Reusar essa stack**
— não trazer outro editor.

### Decisões travadas

- **Formato de armazenamento: Markdown.** A descrição passa a guardar **markdown** na mesma coluna
  `description` (`text`) — sem migration. Descrições antigas em texto puro já são markdown válido
  (renderizam como parágrafo). Markdown é portátil (adm web + ops mobile + futuros exports) e não
  prende a renderização ao ProseMirror.
- **Edição (adm): TipTap com ponte markdown.** O editor parseia markdown → doc ProseMirror ao abrir
  e serializa doc → markdown ao salvar (extensão `tiptap-markdown` ou equivalente community).
  Toolbar mínima: **negrito, itálico, lista (bullet/ordenada) e link** (reusar o padrão de link do
  `TemplateEditor`). Headings opcionais se baratos.
- **Render (adm, read-only): Markdown → HTML → sanitizado.** Converter MD→HTML (ex.: `marked`, com
  **HTML bruto desabilitado**) e sanitizar com **DOMPurify** antes de injetar; restringir protocolos
  de link a `http/https/mailto`.
- **Render (ops.fonte): HTML formatado.** ops mostra a descrição **renderizada** (negrito, listas,
  links clicáveis), read-only — converte o markdown e exibe com `react-native-render-html` (ou
  `react-native-markdown-display`, equivalente que renderiza markdown direto; escolher na
  implementação a que evita o passo MD→HTML no device). Edição rica **fica só no adm** nesta story.
- **Sanitização defesa-em-profundidade (segurança):** o **backend é a autoridade** — ao salvar a
  descrição (`create`/`update`), sanitizar o markdown: remover blocos de **HTML bruto** embutido e
  rejeitar/limpar links com protocolo perigoso (`javascript:`, `data:`, `vbscript:`). O **front**
  também sanitiza no render (DOMPurify no adm; render lib com HTML desabilitado no ops). Stored-XSS
  fechado nas duas camadas.
- **Escopo de texto: só a descrição da atividade.** Comentários seguem texto puro (story 65). Os
  itens 3 (anexos) e 4 (áudio) são stories próprias.

## Desenho

### Backend (`services/api/src/modules/activity/`)

- `activity.service.ts`: na escrita da descrição (`create` e `update`, onde hoje faz
  `dto.description ?? null`), passar o markdown por um sanitizador `sanitizeMarkdown(md)`:
  - remove HTML bruto (tags `<...>`) do markdown;
  - neutraliza links com protocolo fora de `http/https/mailto`.
  - implementar como helper isolado/testável (pode usar `marked` + `DOMPurify` server-side via
    `isomorphic-dompurify`, ou regex allowlist simples — decidir na implementação, com spec cobrindo
    os vetores).
- A janela de edição da descrição (`canEditDescription`, story 62) **não muda** — só o conteúdo
  agora é markdown sanitizado.
- `activity.service.spec.ts`: cobrir sanitização — `<script>`/HTML bruto removido; link
  `javascript:` neutralizado; markdown legítimo (negrito, lista, link http) preservado.
- Contrato HTTP igual (string em `description`). Atualizar a nota no Postman: descrição é markdown.

### packages/types / api-client

- `Activity.description` segue `string | null` (agora markdown). Adicionar comentário no tipo
  documentando o formato. Sem mudança de método. `pnpm build:types` se o comentário/tipo exigir.

### Frontend adm.fonte (`apps/adm.fonte/src/features/activities/`)

- Novo componente de edição rica reutilizável — `components/ActivityDescriptionEditor.tsx` (TipTap
  + ponte markdown + toolbar bold/itálico/lista/link). Integra ao `react-hook-form` do
  `DescriptionSection` (valor = markdown string; sem `useState` solto).
- Novo componente de leitura — `components/ActivityDescriptionView.tsx`: MD→HTML→DOMPurify, render
  read-only. Usado no ramo `!editable` do `ActivityDetailsDialog`.
- `ActivityDetailsDialog.tsx`: trocar o `Textarea`/`<p>` plano por esses componentes. Manter os
  estados (`LoadingState`/`ErrorState`) e `getErrorMessage`.
- Dependências novas se necessárias (`tiptap-markdown`, `marked`, `dompurify`) — adicionar ao
  `adm.fonte`.

### Frontend ops.fonte (`apps/ops.fonte/features/activities/`)

- Na tela/modal de detalhes, renderizar a descrição markdown formatada (read-only) com a lib
  escolhida (`react-native-markdown-display` recomendado por evitar o passo MD→HTML). Edição da
  descrição no ops, se existir hoje, volta a texto puro **ou** sai de cena (não oferecer edição
  rica no mobile nesta story).

## Validação

- Backend: `pnpm test:api` verde, incluindo spec de `sanitizeMarkdown` (vetores XSS barrados +
  markdown legítimo preservado).
- `pnpm build:types` / `pnpm build:api-client` se o tipo mudar.
- **adm**: `pnpm --filter adm.fonte build`. Smoke: editar descrição com negrito/lista/link → salva
  markdown; reabrir mostra formatado; colar `<script>`/link `javascript:` não executa (barrado no
  save e/ou no render).
- **ops**: typecheck/compila. Smoke (se emulador): detalhe mostra a descrição formatada e links
  clicáveis; sem edição rica.
- **Gate de cobertura (trava a story):** todo caminho novo/alterado tem teste — nenhum código novo
  sem teste. Backend: `sanitizeMarkdown` (XSS + preservação). Frontend adm: editor (serializa
  markdown) e view (sanitiza HTML perigoso) — testar que `<script>`/`javascript:` não passam.
  Rodar `pnpm test:api:cov` + runner de cobertura do `adm.fonte`; **não reduzir** a cobertura do
  módulo `activity` nem da feature `activities`. Sem `skip`/`only`/`xfail` injustificado (CLAUDE.md).

## Fora de escopo

- Formatação rica em **comentários** (story 65 = texto puro) — eventual story futura.
- Anexos (item 3 / story 73) e áudio (item 4 / story 74).
- Edição rica da descrição no `ops.fonte` (mobile fica read-only formatado).
- Imagens/tabelas embutidas na descrição (toolbar limitada a texto/lista/link).
- Mudança nas regras de permissão de edição da descrição (story 62) ou de status (story 48).
