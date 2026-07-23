# Plan: Detalhes do filho — esconder seção "Acesso Digital" (app resident.fonte não em prod)

## Context

Bloco **App adm → Detalhes do filho** do BACKLOG.

Na tela de detalhe do filho, a aba Visão Geral (`OverviewTab`) mostra a seção "Acesso Digital" com
o botão "Gerar Acesso". O app dos filhos (`resident.fonte`) ainda não está em produção — o kiosk
dedicado nem foi scaffoldado (ver contexto de roles ativas). O botão só gera confusão para os
operadores.

Levantamento do planning:

- Seção fica em `apps/adm.fonte/src/features/residents/components/tabs/OverviewTab.tsx:174-196`
  ("Acesso Digital"): ramo `resident.userId` → "Resetar Senha"; ramo sem `userId` → "Sem acesso
  gerado" + botão "Gerar Acesso" (`GenerateResidentAccessDialog`).
- É o acesso do **interno** (RESIDENT). O acesso de **familiar** (RELATIVE) é outra coisa
  (`GenerateRelativeAccessDialog`, aba Familiares) e o `app.fonte` está em produção — **não tocar**.

Decisões travadas com o usuário:

- Esconder a **seção inteira** "Acesso Digital" do filho (título + "Sem acesso gerado" + botão
  "Gerar Acesso" + "Resetar Senha"), não só o botão.
- Esconder via **flag de feature reativável** (ex: `RESIDENT_APP_ENABLED`, default `false`), para
  religar quando o `resident.fonte` entrar em produção — sem reescrever o bloco.

## Desenho

1. Definir a flag num ponto de config do `adm.fonte` (ex: `src/config` / constants de features).
   Default desligado. Nome sugerido: `RESIDENT_APP_ENABLED = false`.
2. Em `OverviewTab`, envolver toda a seção "Acesso Digital" (do `<SectionTitle>` até o fim do bloco
   dos dialogs `GenerateResidentAccessDialog`/`ResetResidentPasswordDialog`) num guard pela flag:
   render só quando ligada.
3. Manter o código dos dialogs e do hook intactos (só deixam de ser renderizados) — reativação é
   flipar a flag. Nada de acesso de familiar é afetado.

Escopo frontend-only (`adm.fonte`). Sem mudança de backend/contrato.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** (`pnpm --filter adm.fonte test:cov` verde, cobertura ≥90 do código tocado).

- **adm unit** (`OverviewTab.test.tsx`): com a flag desligada (default), a seção "Acesso Digital"
  não renderiza — nem "Gerar Acesso", nem "Resetar Senha", nem o título — para filho com e sem
  `userId`.
- **adm unit**: com a flag ligada, a seção volta a renderizar (protege a reativação futura).
- Ajustar/rever os testes existentes que exercitam "Gerar Acesso" nessa aba
  (`GenerateAccessDialogs.test.tsx`, `OverviewTab.test.tsx`) para não quebrarem com a seção oculta
  por default.

## Fora de escopo

- Acesso de familiar (RELATIVE) / `GenerateRelativeAccessDialog` — permanece como está.
- Scaffold ou lançamento do `resident.fonte`.
- Remover backend de acesso do interno (login/sessão do RESIDENT continua existindo).
