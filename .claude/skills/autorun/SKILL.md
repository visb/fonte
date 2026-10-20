---
name: autorun
description: Inicia e conduz um run autônomo de implementação de stories no monorepo fonte — executa o protocolo de stories/AUTORUN.md em sequência na própria sessão (o harness retoma sozinho após o reset do limite), dispara o agent fonte-implementer por story, mergeia na main e mantém o ledger (PROGRESS.md). Use quando o usuário invocar /autorun ou pedir para "rodar o autorun", "executar a rodada de stories autônoma", "implementar as stories NN..MM sozinho". NÃO faz push, NÃO abre PR, NÃO pergunta nada durante o run.
---

# /autorun — run autônomo de stories

Skill invocável via `/autorun`. Encapsula o protocolo **`stories/AUTORUN.md`** (fonte de verdade do
"como"): monta a config da rodada e executa as stories **em sequência, nesta sessão**, disparando o
agent `fonte-implementer` por story, mergeando na main e atualizando o ledger. **Não** codifica no
próprio contexto, **não** dá push, **não** abre PR, **não** pergunta nada durante o run.

**Sem `/loop`, sem agendamento.** O Claude Code retoma a sessão sozinho quando o limite de uso
reseta — não há mais `/loop 30m`, `ScheduleWakeup` nem cron para rearmar o run. Basta seguir
trabalhando até esvaziar a fila.

## Argumento

`/autorun <faixa/tema>` — ex.: `/autorun 92 93 94`, `/autorun eventos`, `/autorun stories/PROGRESS.md`.
Define quais stories entram na rodada. Sem argumento: usar o ledger ativo (`stories/PROGRESS.md`) se
houver rodada aberta (retomar); senão, **levantar a faixa com o usuário ANTES de começar** (esta é a
única interação permitida — depois que o run arranca, é autônomo).

## Passo 1 — preparar a rodada (interativo, antes do run)

1. Identificar as stories: ler `stories/NN-*.md` da faixa pedida (ou o tema → casar stories) e a
   ordem/dependências. Confirmar com o usuário se ambíguo.
2. **Montar o ledger** `stories/PROGRESS.md`: copiar o modelo de seção por rodada (do stub) e
   preencher tema, ordem, branch base, deps rígidas, cuidados da rodada (migrations/timestamps,
   contratos, Postman, dependências externas sem credencial, gate de cobertura ≥90) e a tabela de
   fila com tudo `[ ]`. Commitar o ledger (`docs(stories): abre rodada autorun <tema>`).
   Rodada já aberta (retomada) → pular este item.
3. **Bootstrap de serviços** (AUTORUN "Bootstrap"): `pnpm docker:up`, `pnpm test:setup`,
   `pnpm build:types && pnpm build:api-client`, `pnpm dev:api:test` (3001) e `adm dev:test` (5174) em
   background conforme a rodada exigir. Na retomada, só subir o que não estiver de pé.

## Passo 2 — executar a fila (autônomo, em sequência)

Seguir `AUTORUN.md` → "Execução da fila", repetindo até não sobrar story `[ ]`/`in_progress`:
1. Reler ledger + `git log`; pular stories já feitas.
2. Próxima story na ordem → `Agent` (`fonte-implementer`) com plano + branch → recibo:
   OK+verde ⇒ merge na main + arquivar; falha ⇒ `BLOQUEADO`/PARCIAL no ledger.
3. Salvar estado: ledger + tudo commitado (cada story = checkpoint) — e voltar ao item 1.

Limite de uso atingido no meio → nada a fazer: a sessão pausa e o harness retoma sozinho após o
reset; continuar do ledger. Encher a janela de contexto → auto-compactação, segue normal.

## Disciplina de shell (o que mais mata run autônomo)

O gateway do auto mode classifica cada comando Bash; o que ele não analisa vira aprovação manual e o
run para esperando o usuário. Vale para a skill **e** para os agents disparados:

- Arquivo se escreve com `Write`/`Edit` — **nunca** `cat >`/`cat >>`/heredoc/`python - <<EOF`/
  `sed -i` multilinha. O hook `bash-guard` nega esses comandos com a alternativa na mensagem.
- `.env` se lê com `Read` — `grep`/`cat` em `.env` é bloqueado pelo classificador.
- Um comando simples por chamada; sem `cd X && ... | tail`. Allowlist só casa com o comando inteiro,
  e regra que casa **pula o classificador**.
- Comando > ~1500 chars falha com `exceeds the maximum analyzable length`.

**`automode-unavailable` não é bloqueio**: é o classificador fora do ar (`... is temporarily
unavailable`). Não marcar a story como BLOQUEADO por isso — repetir o comando até 2x; persistindo,
seguir para outro passo/story que não dependa dele e voltar depois.

## Encerrar

Todas as stories `[OK]`/`BLOQUEADO` → resumo final no ledger, **arquivar a rodada** em
`stories/done/PROGRESS-NN-MM.md` (restaurar o stub) e terminar o turno com o relatório.

## Proibido

O mesmo de `AUTORUN.md`: push · PR · perguntar durante o run · merge com suíte vermelha ou cobertura
< 90 · inventar segredo · chamar API real · editar migration aplicada · agendar `/loop`/wakeup/cron
para retomar. A skill só orquestra; quem codifica é o `fonte-implementer`.
