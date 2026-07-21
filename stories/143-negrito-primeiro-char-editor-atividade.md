# Plan: Negrito (e marks da toolbar) não pega no 1º caractere no editor de descrição de atividade

## Context

Falha e2e **pré-existente** descoberta na story 132 e reconfirmada na retomada de 133/134
(2026-07-21). Diferente da story 142 (drift de data), esta expõe um **bug de produto real** no editor
WYSIWYG de descrição de atividade.

`apps/adm.fonte/e2e/activities.spec.ts:188` ("edita a descrição com WYSIWYG markdown (ADMIN, story
72)") falha de forma **determinística** (14× reproduzido):

```
Locator: ...activity-description-editor').locator('strong')
Expected substring: "forte1784669337581"
Received string:    "orte1784669337581"   ← o "f" ficou FORA do <strong>
```

O teste: foca o editor, clica **"Negrito"** na toolbar, digita `forte<ts>`. Esperado: a palavra
inteira em negrito. Observado: o **primeiro caractere** ("f") sai **sem** negrito; só "orte…" fica em
`<strong>`.

### Causa raiz (investigada)

- Editor: `src/features/activities/components/ActivityDescriptionEditor.tsx`. O `ToolbarButton`
  (componente local, linha ~28) é um `<button type="button">` com `onClick` mas **sem
  `onMouseDown` com `preventDefault`**.
- Fluxo do clique em "Negrito" (`onClick={() => editor.chain().focus().toggleBold().run()}`):
  o **mousedown** no botão tira o foco do `contenteditable` e colapsa a seleção; o `onClick`
  posterior faz `.focus()` (refoca) + `.toggleBold()` (stored mark em seleção vazia). Nessa ida-e-
  volta de foco, o **stored mark do TipTap não é aplicado ao 1º caractere** digitado — só a partir do
  2º. Resultado: "f" sem negrito.
- É o padrão clássico do TipTap: **botões de toolbar devem `preventDefault` no `mousedown`** para o
  editor **nunca perder foco/seleção**, de modo que `toggleBold()` fixe o stored mark e o **próximo
  caractere já saia em negrito**.
- **Impacto real (não só o teste):** qualquer ADMIN que clique Negrito/Itálico com o cursor vazio e
  comece a digitar perde a formatação no 1º caractere. Bug de UX legítimo.

### Decisões / diretrizes

1. **É bug de produto — corrigir no editor, não no teste.** O e2e está certo; o comportamento é que
   está errado.
2. **Fix padrão TipTap:** adicionar `onMouseDown={(e) => e.preventDefault()}` ao `ToolbarButton` (ou
   ao `<button>` interno), para todos os botões de mark/nó da toolbar (negrito, itálico, listas,
   link) — mantém foco/seleção no editor. Não trocar o `onClick`.
3. **Não usar hack de timing no teste** (ex.: `waitForTimeout` antes de digitar) para "passar" — isso
   esconderia o bug real. O fix no editor é que faz o e2e passar honestamente.
4. **Verificar consistência com o outro editor.** O editor de templates
   (`features/settings/components/TemplateEditor.tsx`) tem um `ToolbarButton` próprio; conferir se
   sofre do mesmo problema e, se sim, aplicar o mesmo `preventDefault` (evita dívida gêmea). Se já
   estiver correto lá, só alinhar o de atividades.

## Desenho

- **`src/features/activities/components/ActivityDescriptionEditor.tsx`**
  - `ToolbarButton`: adicionar `onMouseDown={(e) => e.preventDefault()}` no `<button>` (preserva
    foco/seleção do editor). Aplicar a todos os botões que usam `editor.chain().focus()…`.
- **(Condicional) `src/features/settings/components/TemplateEditor.tsx`**
  - Se o `ToolbarButton` de lá tiver o mesmo defeito, aplicar o mesmo `preventDefault`. Se já estiver
    ok, não tocar.

## Validação

Gate: **código de produção tocado → precisa de teste** (unit + e2e), cobertura ≥90 do ramo tocado,
sem `skip`/`only`/`xfail` injustificado.

- **E2E — `activities.spec.ts:188`**: passa a ficar **verde** — `<strong>` contém a palavra
  **inteira** (`forte<ts>`, com o "f"). Rodar 2× provando determinismo.
- **Unit — editor de atividade**: teste do `ToolbarButton`/editor afirmando que o `mousedown` no
  botão de negrito chama `preventDefault` (o foco/seleção não é perdido). Se viável, um teste que
  simula toggle-bold-em-cursor-vazio + input e verifica que o 1º char entra no mark (pode ser via
  unit do editor com jsdom/TipTap; se o ambiente unit não suportar bem contenteditable, cobrir o
  `preventDefault` no handler e deixar o comportamento fim-a-fim provado pelo e2e).
- **Regressão**: demais testes de `activities.spec.ts` verdes; se tocar o TemplateEditor, a suíte de
  document-templates (unit + e2e) segue verde.
- **Suíte e2e adm** sem regressão.

## Fora de escopo

- Falha e2e de `payables.spec.ts` (drift de vencimento) — é a **story 142**.
- Redesenhar a toolbar do editor ou adicionar novos marks — só o fix de foco.
- Sanitização/markdown do conteúdo (já coberto pela story 72).
