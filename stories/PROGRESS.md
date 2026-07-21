# PROGRESS — stories 133–134 (dívidas retomadas: e2e preferências + LGPD assinatura)

Ordem: 133 → 134. Fonte de verdade: esta seção + git log. Retoma as duas deferidas da rodada
131–134 (ver `done/PROGRESS-131-134.md`), agora que 131 está mergeada (dep 133→131 satisfeita) e a
rodada 135–141 fechou.

**Config da rodada**

- **Branch base:** `main` (cada branch parte da main ATUAL).
- **Prefixo de branch:** `feat/story-NN-<slug>`.
- **Deps rígidas:** 133→131 (JÁ satisfeita — 131 mergeada em 33f4482). 134 independente.
- **Cuidados da rodada:**
  - **133 é e2e-only:** novo `e2e/preferences.spec.ts` com `afterEach` limpando
    `DELETE /preferences/residents.filters` (isolamento é o ponto central — o DB de teste é
    compartilhado). 3 cenários (filtrar→reload→volta; querystring vence preferência; outro usuário
    não herda). Rodar a suíte e2e inteira depois + rodar o spec 2× pra provar determinismo. Sem
    código de produção novo, salvo se o e2e revelar bug real (aí unit + e2e). Gate: e2e verde e
    determinístico, sem skip/only/xfail injustificado.
  - **134 é docs-only + PENDENTE-REVISÃO-HUMANA:** base legal LGPD é decisão de compliance — o
    implementer PROPÕE o texto (inventário em `DIAGNOSTICO_LGPD.md` + gap no `ROADMAP_LGPD.md`);
    marcar **PENDENTE-REVISÃO-HUMANA** no merge. Sem gate de cobertura (não há código).
    **ATUALIZAÇÃO pós-rodada 135–141:** a story 138 adicionou remoção self-service da assinatura
    (`DELETE /staff/me/signature` via botão "Redefinir") — isso É a rotina de eliminação que o gap de
    retenção mencionava; refletir no texto (não registrar como gap aberto de "não há rotina", e sim
    apontar 138). A 137 removeu a role do bloco impresso (não muda o dado inventariado). A 135 serve a
    assinatura como data URI só em dev local; em prod segue canônica + assinada-na-leitura.
  - **SEM migration** em nenhuma. **Contratos/Postman:** não mudam (133 não toca produção; 134 docs).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 133 — e2e Playwright de preferências / filtros persistidos | [OK] | preferences 3/3 · determinismo 6/6 · suíte e2e 160/2 (2 pré-existentes) · unit 1333/1333 · cov ≥90 | a94e940 | (merge na main) |
| 2 | 134 — LGPD: inventariar `staff.signature_url` (docs) | [OK] PENDENTE-REVISÃO-HUMANA | docs-only, sem gate | ceee8c4 | (merge na main) |

## Log

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

[OK] 133 — testes: preferences.spec 3/3 · determinismo 6/6 (--repeat-each=2) · preferences+residents 32/32
(não-vazamento) · suíte e2e adm 160 passed/2 failed (só pré-existentes activities+payables) · unit 1333/1333
· cov adm ≥90 — commit: a94e940 — merge: (main --no-ff) — 2026-07-21. Novo `e2e/preferences.spec.ts` (3
cenários) + helper `resetResidentsFilters` (DELETE via API) + afterEach de limpeza. **Pegou bug REAL de
produção:** hidratação sob StrictMode — guard `didSyncSearch` por ref era marcado no duplo-mount e a sync de
`q` sobrescrevia o `status` hidratado; fix = guard por VALOR (só sincroniza `q` quando difere da URL),
regressão unit sob `<StrictMode>` provada via stash. `residents.spec` ganhou limpeza + asserts de URL
tolerantes (sancionado pelo plano). Bug de isolamento no afterEach (URL relativa → 404 → não limpava)
corrigido com URL absoluta.

[OK] 134 — docs-only (sem gate de teste) — commit: ceee8c4 — merge: (main --no-ff) — 2026-07-21 —
**PENDENTE-REVISÃO-HUMANA**. `DIAGNOSTICO_LGPD.md`: nova §2.1 (assinatura funcional do staff) + linha na
tabela §2 (categoria P) + base legal §5. Base legal PROPOSTA: legítimo interesse / execução de contrato de
trabalho (art. 7 II/IX), não consentimento — sujeita a revisão jurídica. `ROADMAP_LGPD.md` Fase 4: eliminação
sob demanda pelo titular JÁ existe (story 138, `DELETE /staff/me/signature`); gap remanescente = eliminação
AUTOMÁTICA no offboarding. Reflete estado pós-135–141 (137 removeu role impressa; 135 data URI só dev-local,
prod segue canônico+assinado).

## Resumo final

**Rodada 133–134 CONCLUÍDA — 2/2 [OK]** (134 com PENDENTE-REVISÃO-HUMANA na base legal). 2026-07-21.
Retomou as duas deferidas da rodada 131–134.

- 133 — e2e Playwright de preferências (3 cenários + isolamento via afterEach). Pegou e corrigiu bug real de
  hidratação sob StrictMode em `ResidentsPage`. preferences 3/3 · determinismo 6/6 · suíte e2e 160/2 (2
  pré-existentes) · unit 1333/1333 · cov ≥90. `a94e940`.
- 134 — inventário LGPD de `staff.signature_url` (docs). Base legal proposta (legítimo interesse) →
  **revisão humana pendente**. `ceee8c4`.

**Ações humanas pendentes:** (1) revisar/ratificar a base legal LGPD da assinatura (134). (2) Dívida ainda
aberta fora desta rodada: 2 falhas e2e adm pré-existentes em `activities` (WYSIWYG) e `payables` (status) —
descobertas na 132, não são regressão; candidatas a story própria.

**Serviços deixados de pé:** docker, API teste (3001), adm teste (5174). **Sem push, sem PR.**
