# Documentação para IA

Este diretório concentra contexto sob demanda para agentes de IA. O objetivo é evitar que `CLAUDE.md` carregue detalhes demais em todo prompt.

## Como usar

1. Leia `CLAUDE.md` primeiro.
2. Abra apenas o guia relevante para a tarefa.
3. Confirme o código atual antes de alterar comportamento; estes guias são mapas, não fonte única de verdade.

## Guias

- [`project-map.md`](project-map.md) — mapa rápido do monorepo e onde procurar cada tipo de mudança.
- [`backend-guide.md`](backend-guide.md) — padrões do backend NestJS, módulos, guards, migrations e regras de domínio.
- [`frontend-guide.md`](frontend-guide.md) — padrões dos apps `adm.fonte` e `ops.fonte`.
- [`workflow-guide.md`](workflow-guide.md) — comandos, validação e fluxo recomendado para mudanças.

## Princípios para manter estes arquivos leves

- Preferir listas curtas e links para arquivos reais.
- Não duplicar detalhes já documentados em `BUSINESS_RULES.md` ou `CONTRIBUTING.md`.
- Não registrar estado temporário, decisões antigas ou histórico de commits.
- Atualizar o guia quando uma mudança estrutural tornar uma orientação incorreta.
