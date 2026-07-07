# Plan: Import em lote — visualizar o detalhe dos alertas

> **Status: PLANEJAMENTO.** Melhoria pós-epic [[100]] (import em lote). Frontend-only.

## Context

Na fila de import em lote ([[104]]), cada card mostra apenas a **contagem** de alertas
(`importWarningsSummary(warningsCount)` em `ImportItemCard`), mas não há como ver **quais** são os
alertas nem o que dizem. O dado já chega no front: `preview.warnings` é `Record<campo, mensagem>`.
O componente `ImportWarnings` já existe, mas só é usado no import individual (`ImportResidentPage`).

### Decisões travadas

- **Popover no card + seção no modal**: a contagem de alertas no `ImportItemCard` vira gatilho de
  um popover listando campo → mensagem; o `ImportFichaModal` ([[105]]) ganha uma seção de alertas
  no topo. Visível sem abrir a ficha e completo dentro dela.
- **Reusar `ImportWarnings`** como base da listagem (adaptar se a apresentação divergir entre
  popover e modal) — não criar componente duplicado.
- Sem mudança de backend nem de contrato: os warnings já vêm no `ImportPreviewResult`.

## Desenho

### Frontend (`adm.fonte`, feature `residents`)

- **`ImportItemCard`**: quando `warningsCount > 0`, a contagem vira gatilho (Popover do shadcn/ui)
  que renderiza a lista de warnings (campo → mensagem). Com zero alertas, comportamento atual.
- **`ImportFichaModal`**: seção de alertas no topo (abaixo do alerta de conflito, se houver),
  renderizada só quando existir warning.
- **`ImportWarnings`**: extrair/ajustar para aceitar o shape `Record<string, string>` usado no
  import em lote, mantendo o uso existente no import individual funcionando.
- Labels de campo legíveis (reusar mapeamento de labels já existente na feature, se houver).

## Validação

Gate: **código novo sem teste não fecha a story** (runner de cobertura do `adm.fonte`; sem
`skip`/`only`/`xfail` injustificado).

- **Unit (Vitest/RTL)**:
  - `ImportItemCard`: com warnings, popover abre e lista campo → mensagem; sem warnings, sem
    gatilho.
  - `ImportFichaModal`: seção de alertas renderiza com warnings e some sem warnings.
  - `ImportWarnings`: continua passando nos testes existentes após o ajuste de shape.
- **`pnpm test:adm`** (Playwright) se o spec do fluxo de import existente for afetado — atualizar
  o spec para cobrir a abertura do popover de alertas.

## Fora de escopo

- Mudanças no backend/parse que geram os warnings ([[101]]/[[102]]).
- Resolver/dispensar alertas (marcar como lido etc.) — só visualização.
- Histórico de contribuição no modal (story própria).
- Abas da fila (story própria).
