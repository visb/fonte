# Plan: barra do PDF combinado sempre visível, com marcar/desmarcar todos

## Context

Bloco do BACKLOG: **aba "anexos" do filho**. Três ajustes na barra de seleção criada pela
[[152-documentos-pdf-combinado-impressao]] (`CombinedPdfBar.tsx`), todos na mesma tela e no mesmo
componente — por isso uma story só.

Comportamento de hoje:

- A barra **só existe quando há pelo menos um card marcado** (`CombinedPdfBar.tsx:14`,
  `if (count === 0) return null`). Ela aparece e some conforme a seleção, empurrando toda a lista de
  documentos para baixo — o layout dá um salto a cada clique, e quem chega na aba não descobre que a
  impressão em lote existe.
- Marcar vários documentos exige um clique por card: não há "marcar todos".
- Existe um botão **"Limpar seleção"** (`:28-30`) que ocupa espaço permanente para uma ação rara.

Depois desta story a barra é **fixa**, o botão "Gerar PDF combinado" nasce **desabilitado** até
haver seleção, e um checkbox de cabeçalho marca/desmarca tudo — que é o substituto natural do botão
removido.

### Decisões travadas (refinadas nesta sessão)

1. **Barra sempre visível**, inclusive quando **não existe nenhum documento selecionável** (filho sem
   template obrigatório nem de assinatura). Interface estável vale mais que economizar a linha: a
   aba passa a ter sempre o mesmo esqueleto, sem salto de layout. Nesse caso o botão **e** o checkbox
   ficam desabilitados.
2. **Botão desabilitado com 0 selecionados**, não escondido — o usuário vê a ação existir e entende o
   que falta fazer. O `disabled` já existia para o estado `generating`; passa a ser
   `generating || count === 0`.
3. **"Limpar seleção" sai.** O checkbox de cabeçalho desmarca tudo em um clique e o faz no lugar
   onde o olho já está (junto da contagem). `clearSelection` (`useDocumentGeneration.ts:115`) fica
   sem chamador na UI e é **substituído** por `toggleAll` — não fica código morto.
4. **Checkbox tri-estado**: vazio com 0 marcados, marcado com todos, **indeterminate** com seleção
   parcial. Clicar em indeterminate → marca todos. É a convenção de tabela com seleção; sem o
   indeterminate o checkbox mentiria sobre o estado.
5. **Escopo do "todos" = os `selectableTemplates`** já calculados em `AttachmentsTab.tsx:43-46`
   (obrigatórios + assinatura no acolhimento, deduplicados). Não inclui os templates opcionais do
   `GenerateDocumentMenu` nem os "outros anexos" — eles não têm card com checkbox.
6. **A seleção limpa sozinha após gerar o PDF combinado.** Muda o comportamento atual (a seleção
   ficava marcada). Com o botão "Limpar seleção" fora, deixar a seleção presa depois do download
   faria a barra parecer travada; o download é o fim natural do fluxo. Regerar exige remarcar —
   aceito, é o caso raro.
7. **Checkbox nativo com `accent-primary`**, igual ao dos cards (`DocumentCard.tsx:38-40`). O
   `adm.fonte` não tem componente `Checkbox` no `components/ui/`; esta story **não** introduz um.
   O `indeterminate` não é atributo JSX — precisa de `ref` + efeito setando `el.indeterminate`.
8. **Frontend puro.** Nenhuma mudança de contrato, endpoint, entity ou migration ⇒ sem
   `build:types` / `build:api-client`, **sem atualização do
   `fonte-api.postman_collection.json`**.

Independente da [[160-template-disponibilidade-por-status]], mas as duas tocam
`AttachmentsTab.tsx`: se as duas forem implementadas na mesma rodada, a 160 filtra
`selectableTemplates` **antes** e o "todos" desta story opera sobre a lista já filtrada — o
comportamento correto cai de graça, sem coordenação extra.

## Desenho

### `CombinedPdfBar.tsx` (o grosso da mudança)

1. Props novas: `total: number`, `allSelected: boolean`, `someSelected: boolean`,
   `onToggleAll: () => void`. Sai `onClear`.
2. Remover o `if (count === 0) return null` (decisão 1). O componente passa a renderizar sempre.
3. Lado esquerdo vira `<label>` clicável com o checkbox + a contagem:
   - `checked={allSelected}`, `ref` + `useEffect` setando `indeterminate = someSelected && !allSelected`
     (decisão 4/7);
   - `disabled={generating || total === 0}`;
   - texto: `Nenhum documento selecionado` / `1 documento selecionado` /
     `N documentos selecionados` — a pluralização atual (`:18-20`) ganha só o caso zero.
4. Botão: `disabled={generating || count === 0}` (decisão 2). Ícone e rótulo inalterados.
5. Botão "Limpar seleção" removido (decisão 3).
6. Componente segue sem estado próprio e sem fetch — recebe tudo por prop, como hoje.

### `useDocumentGeneration.ts`

7. Trocar `clearSelection` por
   `toggleAll(ids: string[])`: se **todos** os `ids` já estão em `selectedIds` → esvazia; senão →
   `new Set(ids)` (decisão 4: parcial vira tudo marcado).
8. Após o download do PDF combinado concluir com sucesso, esvaziar `selectedIds` (decisão 6). Ponto
   certo é o fim do `downloadCombinedPdf` (`:104`), **só no caminho de sucesso** — erro mantém a
   seleção para o usuário tentar de novo.

### `AttachmentsTab.tsx`

9. Calcular a partir do `selectableTemplates` que já existe (`:43-47`):
   `total = selectableTemplates.length`, `count = selectedTemplates.length`,
   `allSelected = total > 0 && count === total`, `someSelected = count > 0`.
10. Passar as props novas para a `CombinedPdfBar` e trocar `onClear={gen.clearSelection}` por
    `onToggleAll={() => gen.toggleAll(selectableTemplates.map((t) => t.id))}` (decisão 5).

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. **Gate: código novo sem teste não
fecha a story** — `pnpm --filter adm.fonte test:unit:cov` verde, com cobertura ≥90 do código tocado
e sem reduzir a de `features/residents`. Frontend puro (decisão 8) ⇒ `pnpm test:api`,
`build:types` / `build:api-client` e `migration:run:test` não são exigidos.

- **Unit `CombinedPdfBar`** (spec novo, o componente não tem um hoje):
  - com `total = 0` → barra **renderiza** (regressão direta da decisão 1) e botão + checkbox saem
    `disabled`;
  - `count = 0`, `total = 3` → texto `Nenhum documento selecionado`, botão `disabled`, checkbox
    desmarcado e **não** indeterminate;
  - `count = 1` de 3 → checkbox `indeterminate` (assertar a propriedade do elemento, não um
    atributo), botão habilitado, texto no singular;
  - `count = 3` de 3 → checkbox `checked`, sem indeterminate;
  - `generating` → botão e checkbox `disabled`, spinner no lugar do ícone;
  - clicar no checkbox chama `onToggleAll`;
  - **o texto "Limpar seleção" não existe em nenhum estado** (decisão 3).
- **Unit `useDocumentGeneration`**:
  - `toggleAll` com seleção vazia → marca todos os ids; com todos marcados → esvazia; com seleção
    **parcial** → marca todos (decisão 4);
  - `toggleAll` com ids repetidos/duplicados → `Set` sem duplicata;
  - download combinado com sucesso → `selectedIds` esvazia (decisão 6);
  - download combinado que **falha** → `selectedIds` permanece e o `error` é setado;
  - `clearSelection` **não é mais exportado** (trava a decisão 3 contra código morto).
- **Unit `AttachmentsTab.test.tsx`** (já existe):
  - marcar/desmarcar todos pelo checkbox da barra reflete nos checkboxes dos cards;
  - o "todos" ignora os templates **opcionais** (que só existem no `GenerateDocumentMenu`) —
    decisão 5;
  - template que está em `isRequired` **e** `signAtAdmission` conta **uma vez** no `total`
    (regressão da dedupe da [[152-documentos-pdf-combinado-impressao]]);
  - a barra aparece na primeira renderização, sem nenhum card marcado.
- **E2E `apps/adm.fonte/e2e/`** (spec da aba de anexos, se existir; senão o caso entra no spec de
  residents): abrir a aba mostra a barra com o botão desabilitado; marcar todos habilita; gerar
  baixa o PDF e a barra volta a "Nenhum documento selecionado". É o único ponto que prova o ciclo
  completo com download real.

## Fora de escopo

- **Reordenar os documentos** do PDF combinado (arrastar cards) — a ordem segue sendo a da tela.
- **Selecionar os templates opcionais** do `GenerateDocumentMenu` ou os "outros anexos" (decisão 5).
- **Componente `Checkbox` compartilhado** em `components/ui/` (decisão 7) — se um dia entrar, os
  checkboxes desta tela migram junto.
- **Barra sticky/fixa no topo ao rolar** — "sempre visível" aqui significa "sempre renderizada", não
  `position: sticky`.
- **Persistir a seleção** entre visitas à aba ou entre filhos.
- `ops.fonte` / `app.fonte` — a aba de anexos é do `adm.fonte`.
