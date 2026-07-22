# PROGRESS — rodada autorun 142–143 (arquivada)

Rodada autorun **142–143** — correção das duas falhas e2e pré-existentes do adm.fonte
(descobertas na story 132, reconfirmadas na retomada 133/134 em 2026-07-21). **Encerrada 2026-07-21.**

## Config da rodada

- **Tema:** consertar as duas falhas e2e crônicas do adm.fonte — drift de data (142) e bug de
  foco do editor WYSIWYG (143).
- **Ordem:** 142 → 143 (independentes; sem dep rígida).
- **Branch base:** `main`.
- **Deps rígidas:** nenhuma. Stories tocaram arquivos disjuntos.
- **Cuidados:** sem migrations, sem contrato, Postman inalterado. 142 e2e-only; 143 toca produção
  (unit + e2e, cobertura ≥90 do ramo).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 142 — e2e payables drift de vencimento | [OK] | e2e 8/8 (2×) | 050cc21 | 76904d7 |
| 2 | 143 — negrito não pega no 1º char (editor atividade) | [OK] | unit 1335/1335, e2e 20/20 (2×) | ca374ab | 0821f91 |

## Log

[OK] 142 — teste-only: `createPayable` gera vencimento relativo ao now (hoje+30d) via `dueDateFromNow`; fim do drift. e2e payables 8/8 verde 2× — commit 050cc21 — merge 76904d7 — 2026-07-21

[OK] 143 — bug de produto: `onMouseDown={e=>e.preventDefault()}` no `ToolbarButton` (ActivityDescriptionEditor + TemplateEditor gêmeo). Negrito pega o 1º char. unit 1335/1335 + novo test do editor; e2e activities 20/20 verde 2× (inclui :188); doc-templates 12/12 — commit ca374ab — merge 0821f91 — 2026-07-21

## Resumo final

**Ambas as stories [OK] e mergeadas na main. Nenhum bloqueio, nada PENDENTE-MANUAL.**

- **142 (teste-only):** a falha era uma data literal de vencimento (`2026-06-20`) que envelheceu e
  passou a nascer OVERDUE ("Vencida" em vez de "Em aberto"). Fix: `createPayable` computa o
  vencimento relativo ao `now` (`dueDateFromNow`, hoje+30d, componentes locais p/ evitar drift de
  fuso). Sem mudança de produto. e2e payables 8/8 verde em 2 execuções.
- **143 (bug de produto):** `ToolbarButton` do editor WYSIWYG não fazia `preventDefault` no
  `mousedown`, então o clique em Negrito colapsava a seleção do contenteditable e o stored mark do
  TipTap perdia o 1º caractere. Fix aplicado no `ActivityDescriptionEditor` **e** no `TemplateEditor`
  (mesmo defeito gêmeo). Unit novo cobre o contrato do `preventDefault`; o arquivo do editor fica na
  exclusão de cobertura (jsdom não roda contenteditable real) e o comportamento fim-a-fim é provado
  pelo e2e — determinismo confirmado (activities 20/20 em 2 execuções, inclui o `:188`).

**Reproduzir os gates** (serviços de pé: docker + `pnpm dev:api:test` 3001 + `pnpm --filter adm.fonte dev:test` 5174):
```
pnpm test:setup
pnpm --filter adm.fonte vitest run            # unit — 1335/1335
pnpm test:adm -- payables.spec.ts             # 8/8
pnpm test:adm -- activities.spec.ts           # 20/20
pnpm test:adm -- document-templates.spec.ts   # 12/12
```

**Branches** (preservadas, sem push): `test/story-142-payables-drift`, `fix/story-143-negrito-primeiro-char`.
