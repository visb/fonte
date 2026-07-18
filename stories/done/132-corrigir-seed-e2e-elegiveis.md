# Plan: Corrigir o seed de teste para não pular os e2e de elegíveis ao curso

## Context

Dois testes e2e do `adm.fonte` vivem **permanentemente pulados** (`skip`) por um defeito do **seed do
banco de teste**, não do código de produção. A ressalva foi levantada na story 125 e reconfirmada na
127: o seed cria um filho com `entry_date` = **hoje**, mas a regra de negócio de "sugerir matrícula
no curso bíblico" exige **acolhimento há ≥ 3 meses**. Resultado: `GET .../eligible-residents` volta
`[]`, o painel de sugeridos **não renderiza**, e os specs que dependem dele não têm o que exercitar.

Durante a story 125 o agent **retrodatou o seed temporariamente, viu os 2 testes passarem de verdade,
e restaurou o banco** — ou seja, o fluxo funciona; o que falha é o **dado semeado**. A suíte
versionada segue pulando porque consertar exige mexer no seed, o que estava fora do escopo daquelas
stories.

### Testes afetados (hoje `skip`)

- O(s) spec(s) do painel de **sugeridos/elegíveis ao curso bíblico** (story 99 — "curso: sugerir
  matrícula a elegíveis") e o caso correlato tocado pela **story 125** (selecionar todos + abrir filho
  em nova aba), que só renderiza quando `eligible-residents` devolve ≥1 filho.

### Decisões / diretrizes

1. **Consertar o dado, não afrouxar a regra.** A regra dos 3 meses é de negócio e está correta; o
   seed é que precisa refletir um cenário realista. Adicionar/ajustar no seed **pelo menos um filho
   elegível** — `entry_date` retrodatada além do limite (ex.: 4+ meses atrás), `ACTIVE`, com casa,
   **e ainda não matriculado** no curso (senão deixa de ser "elegível/sugerido").
2. **Não quebrar os outros testes do seed.** O seed é compartilhado por toda a suíte e2e; adicionar um
   filho não pode alterar contagens que outros specs assumem (listagens por casa, dashboards,
   ordenação da 129, etc.). Preferir **um filho novo dedicado** a mutar um existente — e conferir os
   specs que contam residentes.
3. **Datas determinísticas e relativas ao "agora".** Retrodatar via cálculo relativo à data de
   execução (ex.: `now - 4 meses`), não uma data fixa que expira. Assim o elegível continua elegível
   daqui a um ano.
4. **Remover os `skip`.** Ao fim, os 2 testes rodam de verdade na suíte versionada — sem `skip`, sem
   `only`, sem retrodatação temporária em runtime.

## Desenho

- **Seed de teste** (`services/api` — script/seed usado por `pnpm test:setup`): incluir um filho
  **elegível ao curso** (retrodatado ≥3 meses, `ACTIVE`, com casa, não matriculado). Ajustar
  quaisquer fixtures que dependam de contagem total de residentes.
- **`adm.fonte` e2e**: remover o `skip` dos 2 casos; ajustar seletores/asserts se o novo dado exigir.
- **Sem mudança de regra de negócio, sem migration, sem contrato.**

## Validação

- **`pnpm test:setup`** roda limpo e semeia o filho elegível novo.
- **`pnpm test:adm`** (Playwright): os 2 casos antes pulados **passam de verdade**, sem `skip`. Rodar
  a suíte e2e **inteira** para provar que o filho novo **não regrediu** nenhum outro spec (contagens
  por casa, dashboard, ordenação da 129, painel de elegíveis).
- Se algum unit/e2e do backend assumir a composição do seed: **`pnpm test:api:e2e`** verde.
- Conferir que `GET /.../eligible-residents` devolve ≥1 no ambiente de teste (o painel renderiza).

> **Gate de cobertura (trava a story):** o objetivo é **remover skips**, não adicionar código de
> produto — nenhum caminho de produção novo entra. Não deixar nenhum `skip`/`only`/`xfail` novo nem
> manter os antigos sem justificativa (CLAUDE.md). Rodar os runners de e2e afetados e confirmar verde.

## Fora de escopo

- Os 4 erros de `tsc` e os 6 e2e de `residents.spec.ts` — é a **story 131**.
- Alterar a regra dos 3 meses ou a lógica de elegibilidade.
- Redesenhar o seed inteiro — só adicionar o dado que destrava os 2 casos, sem colateral.
