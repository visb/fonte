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
| 1 | 133 — e2e Playwright de preferências / filtros persistidos | [ ] | | | |
| 2 | 134 — LGPD: inventariar `staff.signature_url` (docs) | [ ] | | | |

## Log

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

## Resumo final

<pendente — rodada em andamento>
