# Plan (EPIC): Declaração de contribuição — valor monetário + produtos

> **Status: PLANEJAMENTO.** Epic. Filhas: [[111]] (refactor catálogo), [[112]] (backend contribuição-produtos),
> [[113]] (adm), [[114]] (ops). Implementar na ordem 111 → 112 → 113/114.

## Context

Hoje a declaração de pagamento da contribuição mensal (`RegisterPaymentDialog` no adm, sobre
`ResidentReceivable`) só captura **valor monetário** (`paidAmount` + `paidFamilyInvestment`, story
[[15]]). O requisito: ao declarar a contribuição mensal, informar **separadamente** o pagamento em
**valor monetário** e a contribuição em **produtos**.

- **adm**: declara ambos os tipos (valor + produtos).
- **ops**: declara a contribuição de **produtos**, com área para informar qual produto e quantidade.
- Os produtos declaráveis são os **mesmos cadastrados na dispensa (`supply_room`) e no almoxarifado
  (`storeroom`)**.

### Decisões travadas (epic)

- **Unificar os inventários primeiro** ([[111]]): `storeroom` (almoxarifado) e `supply_room`
  (dispensa) são quase idênticos (name/unit/house_id/current_quantity + movements IN/OUT). Uma
  **story de refactor separada ANTES** unifica os dois num catálogo compartilhado (tabela única com
  discriminador de tipo + movimentos unificados), isolando o risco do refactor num commit próprio.
  As stories de contribuição referenciam o catálogo unificado — um único lugar de produtos.
- **Dois modos de linha de contribuição-produto** ([[112]]):
  - **Item do catálogo** (`itemId` do catálogo unificado + quantidade) → lança **movimento de
    entrada (IN)** no estoque do item (`current_quantity` sobe), como qualquer doação, com **vínculo
    contribuição ↔ movimento** para rastreio. Correção segue a regra do domínio (sem estorno; novo
    lançamento — `BUSINESS_RULES.md`).
  - **Descrição livre / avulsa** (ex: "cesta básica", texto + quantidade/unidade opcional) → **não**
    é item do catálogo e **não gera movimento de estoque** na declaração. Fica registrada na
    contribuição marcada como **pendente de detalhamento**; a logística abre a cesta depois e faz o
    input manual dos produtos individuais no estoque, num outro momento/fluxo (input manual já
    existente nos inventários). O epic **não** faz o distrinchamento automático.
- **Amarra ao `ResidentReceivable`**: tanto valor quanto produtos são declarados contra a parcela do
  filho (mesma âncora nos dois apps). Ops declara produtos contra a parcela do filho da casa.
- **Permissão**: ops (SERVANT) pode declarar contribuição de **produtos**; declaração de **valor**
  segue restrita como hoje (ADMIN/COORDINATOR). Confirmar/ajustar guardas na [[112]].

## Desenho (visão de epic)

1. **[[111]] Refactor catálogo** — unifica storeroom + supply-room num catálogo compartilhado
   (backend + migração/backfill + telas ops/adm dos dois inventários).
2. **[[112]] Backend contribuição-produtos** — modela itens de contribuição em produto ligados à
   parcela, gera movimento IN no catálogo unificado, expõe endpoints (adm: valor+produtos;
   ops: produtos), atualiza relatórios/agregações e Postman.
3. **[[113]] adm** — `RegisterPaymentDialog` passa a declarar valor **e** produtos (linhas
   produto+quantidade a partir do catálogo).
4. **[[114]] ops** — tela/fluxo para declarar contribuição de produtos do filho (produto+quantidade).

## Validação (visão de epic)

Cada filha traz sua própria Validação com **gate de cobertura** (código novo sem teste não fecha).
No fecho do epic: `pnpm test:api` + `pnpm test:api:e2e` verdes, `pnpm test:adm` cobrindo o fluxo
adm, runner do ops cobrindo o fluxo ops, `build:types`/`build:api-client` compilando, Postman
atualizado.

## Fora de escopo

- Precificar produtos / converter produto em valor monetário no relatório de arrecadação (produtos
  contam como contribuição em espécie, não somam em R$).
- Alterar a lógica de geração das parcelas (`ResidentReceivable`).
- Novos catálogos além de dispensa/almoxarifado.
