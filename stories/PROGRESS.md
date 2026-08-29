# PROGRESS — ledger ativo

**Nenhuma rodada aberta.** Rodadas encerradas ficam em `stories/done/PROGRESS-NN-MM.md`.

Ao abrir uma rodada de autorun (`/autorun <faixa/tema>`), preencher este arquivo com o modelo
abaixo e commitar (`docs(stories): abre rodada autorun <tema>`). O protocolo do "como" é
`stories/AUTORUN.md` — não duplicar aqui.

---

## Modelo de seção por rodada

```markdown
Rodada de autorun **NN–MM** — aberta em AAAA-MM-DD.

## Config da rodada

- **Tema:** <uma frase>
- **Ordem:** NN → ... → MM
- **Branch base:** `main` (cada branch parte da `main` já com o merge da story anterior).
- **Deps rígidas:** <A → B, com o motivo; se A bloquear, B bloqueia junto>
- **Escopo técnico por story:** <o que cada uma toca: migration, packages/types, api-client,
  Postman, app x/y>
- **Cuidados da rodada:** <contratos, migrations/timestamps, Postman, dependências externas sem
  credencial, invariantes do app tocado, gate de cobertura ≥ 90>

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | NN — <título> | [ ] | | | |

## Log

​```
[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data>
     <bloqueio/PENDENTE-MANUAL e no máx. 1 nota crítica — máx. ~3 linhas por entrada>
​```

## Resumo final

<vazio até o fim da rodada>
```
