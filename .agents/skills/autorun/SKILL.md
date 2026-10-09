---
name: autorun
description: Inicia e conduz um run autônomo de implementação de stories no monorepo fonte — segue o protocolo de stories/AUTORUN.md, implementa uma story por vez (subagente fonte-implementer quando disponível), mergeia na main e mantém o ledger (PROGRESS.md). Use quando o usuário invocar $autorun ou pedir para "rodar o autorun", "executar a rodada de stories autônoma", "implementar as stories NN..MM sozinho". NÃO faz push, NÃO abre PR, NÃO pergunta nada durante o run.
---

# $autorun — run autônomo de stories (Codex)

Encapsula o protocolo **`stories/AUTORUN.md`** (fonte de verdade do "como"): monta a config da
rodada, e percorre a fila story a story — implementa, valida, mergeia na main e atualiza o ledger.
**Não** dá push, **não** abre PR, **não** pergunta nada depois que a rodada começa.

## Argumento

`$autorun <faixa/tema>` — ex.: `$autorun 92 93 94`, `$autorun eventos`, `$autorun stories/PROGRESS.md`.
Sem argumento: usar o ledger ativo (`stories/PROGRESS.md`) se houver rodada aberta; senão, **levantar
a faixa com o usuário ANTES de começar** (única interação permitida).

## Passo 1 — preparar a rodada (interativo, antes de começar)

1. Identificar as stories: ler `stories/NN-*.md` da faixa pedida (ou o tema → casar stories) e a
   ordem/dependências. Confirmar com o usuário se ambíguo.
2. **Montar o ledger** `stories/PROGRESS.md`: copiar o modelo de seção por rodada (do stub) e
   preencher tema, ordem, branch base, deps rígidas, cuidados da rodada (migrations/timestamps,
   contratos, Postman, dependências externas sem credencial, gate de cobertura ≥90) e a tabela de
   fila com tudo `[ ]`. Commitar o ledger (`docs(stories): abre rodada autorun <tema>`).
3. **Bootstrap de serviços** (AUTORUN "Bootstrap"): `pnpm docker:up`, `pnpm test:setup`,
   `pnpm build:types`, `pnpm build:api-client`, `pnpm dev:api:test` (3001) e
   `pnpm --filter adm.fonte dev:test` (5174) em background conforme a rodada exigir.

## Passo 2 — executar a fila

O Codex não tem `/loop` de intervalo fixo. A rodada roda **nesta sessão, em sequência**, até esvaziar
a fila. Se a sessão cair (limite, crash, contexto), basta abrir nova sessão e invocar `$autorun`
de novo: o estado é **git log + ledger**, e a retomada é automática.

Para cada story, na ordem (respeitando deps rígidas):

1. Reler ledger + `git log`; pular stories já feitas (commit `feat(story-NN)` existe).
2. **Implementar:** se subagentes estiverem disponíveis, delegar ao agente `fonte-implementer`
   (`.codex/agents/fonte-implementer.toml`) com plano + branch — um por story, contexto limpo.
   Senão, executar o protocolo do `fonte-implementer` no próprio contexto, uma story por vez.
3. **Recibo OK + suíte verde (cobertura ≥90)** ⇒ `git switch main`,
   `git merge --no-ff <branch> -m "merge: story NN — <título>"`, `git mv` do plano para
   `stories/done/` + commit. Falha ⇒ registrar `BLOQUEADO`/PARCIAL no ledger e seguir.
4. Dep externa sem credencial: implementar atrás de interface com mocks, marcar PENDENTE-MANUAL, seguir.
5. **Salvar estado:** ledger atualizado + tudo commitado (cada story = checkpoint).

## Disciplina de shell

- Arquivo se escreve com **`apply_patch`** (ou a tool de edição do harness), não com
  `cat >`/heredoc/`python - <<EOF`/`sed -i` multilinha.
- Um comando simples por chamada; sem cadeias longas de `&&` e pipes decorativos.
- `.env` nunca é impresso no terminal (ver AGENTS.md → produção).

## Encerrar

Todas as stories `[OK]`/`BLOQUEADO` → resumo final no ledger, **arquivar a rodada** em
`stories/done/PROGRESS-NN-MM.md` (restaurar o stub) e parar.

## Proibido

O mesmo de `AUTORUN.md`: push · PR · perguntar durante o run · merge com suíte vermelha ou cobertura
< 90 · inventar segredo · chamar API real · editar migration aplicada.
