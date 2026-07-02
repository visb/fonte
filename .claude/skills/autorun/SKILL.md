---
name: autorun
description: Inicia e conduz um run autônomo de implementação de stories no monorepo fonte — encapsula o protocolo de stories/AUTORUN.md num /loop de intervalo fixo, dispara o agent fonte-implementer por story, mergeia na main e mantém o ledger (PROGRESS.md). Use quando o usuário invocar /autorun ou pedir para "rodar o autorun", "executar a rodada de stories autônoma", "implementar as stories NN..MM sozinho". NÃO faz push, NÃO abre PR, NÃO pergunta nada durante o run.
---

# /autorun — run autônomo de stories

Skill invocável via `/autorun`. Encapsula o protocolo **`stories/AUTORUN.md`** (fonte de verdade do
"como"): monta a config da rodada, inicia um `/loop` de intervalo fixo e, a cada disparo, dispara o
agent `fonte-implementer` por story, mergeia na main e atualiza o ledger. **Não** codifica no próprio
contexto, **não** dá push, **não** abre PR, **não** pergunta nada durante o run.

## Argumento

`/autorun <faixa/tema>` — ex.: `/autorun 92 93 94`, `/autorun eventos`, `/autorun stories/PROGRESS.md`.
Define quais stories entram na rodada. Sem argumento: usar o ledger ativo (`stories/PROGRESS.md`) se
houver rodada aberta; senão, **levantar a faixa com o usuário ANTES de iniciar o loop** (esta é a
única interação permitida — depois que o loop arranca, é autônomo).

## Passo 1 — preparar a rodada (interativo, antes do loop)

1. Identificar as stories: ler `stories/NN-*.md` da faixa pedida (ou o tema → casar stories) e a
   ordem/dependências. Confirmar com o usuário se ambíguo.
2. **Montar o ledger** `stories/PROGRESS.md`: copiar o modelo de seção por rodada (do stub) e
   preencher tema, ordem, branch base, deps rígidas, cuidados da rodada (migrations/timestamps,
   contratos, Postman, dependências externas sem credencial, gate de cobertura ≥90) e a tabela de
   fila com tudo `[ ]`. Commitar o ledger (`docs(stories): abre rodada autorun <tema>`).
3. **Bootstrap de serviços** (AUTORUN "Bootstrap"): `pnpm docker:up`, `pnpm test:setup`,
   `pnpm build:types && pnpm build:api-client`, `pnpm dev:api:test` (3001) e `adm dev:test` (5174) em
   background conforme a rodada exigir.

## Passo 2 — iniciar o loop (colar e sair)

Iniciar com `/loop` **intervalo fixo** (não auto-pacing) — o harness redispara sozinho, sobrevive ao
limite de sessão. Colar (ajustar faixa/ordem):

```
/loop 30m Modo autônomo. Siga stories/AUTORUN.md à risca, sem me perguntar nada. A cada disparo: releia stories/PROGRESS.md + git log e continue da próxima story NÃO concluída na ordem da rodada. Se a sessão estiver no limite, não faça nada e aguarde o próximo disparo. Para cada story, dispare o agent fonte-implementer (plano + branch); ao receber recibo OK e suíte verde (cobertura ≥90), merge --no-ff na main + arquive em done/ e siga; senão registre BLOQUEADO/PARCIAL no ledger. Dep externa sem credencial: implementar atrás de interface com mocks, marcar PENDENTE-MANUAL, seguir. Sem push, sem PR. Quando todas estiverem done ou blocked, escreva o resumo final em PROGRESS.md, arquive a rodada em done/PROGRESS-NN-MM.md e encerre o loop.
```

## Passo 3 — a cada disparo (o que a skill/loop executa)

Seguir `AUTORUN.md` → "A cada disparo do loop":
1. Reler ledger + `git log`; pular stories já feitas.
2. Limite de sessão → encerrar o turno sem ação (o loop retoma após o reset).
3. Senão: próxima story na ordem → `Agent` (`fonte-implementer`) com plano + branch → recibo:
   OK+verde ⇒ merge na main + arquivar; falha ⇒ `BLOQUEADO`/PARCIAL no ledger. Várias por turno se
   houver orçamento.
4. Salvar estado: ledger + tudo commitado (cada story = checkpoint).

## Encerrar

Todas as stories `[OK]`/`BLOQUEADO` → resumo final no ledger, **arquivar a rodada** em
`stories/done/PROGRESS-NN-MM.md` (restaurar o stub), e **encerrar o loop** (não reagendar).

## Proibido

O mesmo de `AUTORUN.md`: push · PR · perguntar durante o run · merge com suíte vermelha ou cobertura
< 90 · inventar segredo · chamar API real · editar migration aplicada. A skill só orquestra; quem
codifica é o `fonte-implementer`.
