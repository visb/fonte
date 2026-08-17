# Backlog

## Achados da rodada de autorun 182–184 (2026-08-17)

Detalhe e evidência em `stories/done/PROGRESS-182-184.md` → "Resumo final".

- **Suíte Maestro do ops.fonte não é 100% estável em execução seguida.**
  Numa batelada, `census` e `dashboard` falharam em ~7s cada (11/13) e passaram isolados e na batelada
  seguinte sem qualquer edição — hiccup de launch do driver, não asserção. Investigar retry/espera de
  launch antes de considerar a suíte confiável em CI.
