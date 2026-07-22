# Plan: editor de templates — descrição da variável sempre visível no drawer

## Context

Bloco de backlog **"Editor de templates"** (adm.fonte, `features/settings`). Antes de o
`VariablesPanel` virar o drawer fixo colapsável à direita (story 139/140), cada variável exibia
sua **descrição** junto do rótulo. Hoje o `VariablesPanel.tsx` mostra por item só **label + key**;
a `description` (que já existe em `VARIABLES[]`, linha 17) ficou só como `title` nativo (tooltip
hover, linha 110). O usuário quer a descrição **de volta e visível**, sem depender de hover.

Decisão do usuário no planning: **sempre visível, como 3ª linha do item** (label / key /
descrição). Não é tooltip nem expansível.

### Decisões travadas

- **Layout do item:** três linhas empilhadas — `label` (destaque), `key` (mono, primary),
  `description` (texto pequeno, `text-muted-foreground`, leading apertado). O item vira um pouco
  mais alto; a lista já é rolável (`overflow-y-auto`), então tudo bem.
- **Remover o `title` nativo** do botão (linha 110): a descrição passa a estar impressa; o tooltip
  vira redundante e causaria eco. Manter só o feedback "✓ inserido" atual (que troca a linha da key
  ao clicar) — inalterado.
- **Fonte única:** a `description` continua vindo de `VARIABLES[]` (mesma lista que a story 144
  consome). Nenhuma descrição nova/reescrita — usar exatamente os textos já presentes.
- **Só o drawer:** o autocomplete inline (story 144) pode ou não mostrar descrição — **fora do
  escopo desta story**; aqui é só o `VariablesPanel`.

### Dependências

- Toca o MESMO arquivo da story 144 (`VariablesPanel.tsx`). Sem dep rígida de ordem, mas se as duas
  forem em paralelo haverá conflito de merge no corpo do item/lista — resolver trivialmente
  (mudanças ortogonais: 144 mexe em estado `open`/import da lista; 145 mexe no JSX do item). Se
  possível, implementar em sequência.

## Desenho

1. **`VariablesPanel.tsx`** — no `.map` da lista (linha ~106): adicionar uma 3ª linha ao botão do
   item com `{description}` (`<span>` pequeno, `text-[11px]`/`text-[10px]`, `text-muted-foreground`,
   `leading-tight`, quebra normal). Ordem: label → key (com o toggle "✓ inserido") → description.
2. **Remover** o atributo `title={description}` do botão (agora redundante).
3. Ajustar o espaçamento vertical do item se necessário (`gap`/`py`) para as 3 linhas respirarem.
4. Sem mudança na lista `VARIABLES`, sem mudança de estado, sem nova prop.

## Validação e gate de cobertura

Frontend-only (adm.fonte), puramente de apresentação. **Gate: código novo sem teste não fecha a
story.**

- **Component (Vitest + Testing Library)** em `VariablesPanel.test.tsx` (já existe):
  - renderiza e afirma que a **descrição** de pelo menos uma variável aparece como texto visível no
    documento (ex: `getByText('Nome completo do acolhido')`) — não só como atributo `title`.
  - afirma que o botão do item **não** tem mais `title` com a descrição (ou que a descrição está no
    corpo, não só no atributo) — prova a remoção do tooltip redundante.
  - o teste de clique→`onInsert` existente continua verde (feedback "✓ inserido" intacto).
- **E2E:** opcional — o fluxo visual é coberto pelo component test. Se `document-templates.spec.ts`
  já abre o drawer, adicionar uma asserção leve de que a descrição está visível; não obrigatório.
- **Gate de cobertura:** `pnpm --filter adm.fonte vitest run --coverage` — `VariablesPanel.tsx`
  segue coberto (é componente testável em jsdom, sem ProseMirror). Ramo tocado ≥90%. Sem
  `skip`/`only`/`xfail` injustificado.
- Contrato/Postman: inalterados (não toca `packages/types`, `api-client` nem backend).

## Fora de escopo

- Descrição no popup de autocomplete inline (story 144).
- Reescrever/adicionar textos de `description` em `VARIABLES`.
- Mudança de comportamento de clique/arraste/feedback do item.
- Colapsar/expandir descrição sob demanda (decisão foi "sempre visível").
