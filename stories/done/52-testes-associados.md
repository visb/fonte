# Plan: Testes do app associados (Vitest + Playwright) — filha do epic 49

## Context

Filha do epic [49](49-cobertura-testes-epic.md). O app `associados` (React/Vite, página pública de
pagamento por token) **não tem nenhum teste**. É o app mais descoberto. Tem lógica sensível: gross-up
preview, `cardTokenizer` (stub em dev), schema do form, estados de token inválido/já-assinante.

Decisões travadas (epic): Vitest + RTL (unit) e Playwright (e2e web), do zero. Tokenizer fica no
modo stub (`dev_tok_*`) nos testes — gateway externo nunca é chamado.

## Desenho

### Tooling unit (espelha o que a story 51 padroniza)

- `pnpm --filter associados add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`.
- `vitest.config.ts` jsdom + setup jest-dom. Scripts `test:unit` no app + `test:associados` na raiz.

### Unit baseline

- `src/lib/money.ts` e o preview de gross-up (`AmountSummary` lógica) — fórmula bate com a da
  story 38 (`contribuição + taxa`).
- `src/lib/cardTokenizer.ts` — em dev (sem `VITE_ABACATEPAY_PUBLIC_KEY`) devolve `dev_tok_*`;
  com chave + sem SDK lança o erro esperado.
- `src/lib/errors.ts` (`getErrorMessage`).
- schema zod do `SubscribeForm` (valor mínimo, campos do cartão).
- `StateScreens` / `InvalidLinkPage` — render do estado de erro.

### Tooling + e2e web (Playwright)

- `pnpm --filter associados add -D @playwright/test`; `playwright.config.ts` espelhando o do
  `adm.fonte` (baseURL apontando ao dev server do associados; `webServer` opcional para subir o
  Vite). Pasta `e2e/`.
- Specs do fluxo público:
  - token **inválido** → tela de erro amigável (`InvalidLinkPage`).
  - token **válido** → mostra nome + valor editável pré-preenchido + `AmountSummary` com gross-up.
  - **submit** com tokenizer stub → tela de confirmação ("contribuição mensal ativada").
  - Endpoints públicos (`/public/associates/:token`) **mockados** via `page.route` (não depender da
    API real nesta suíte) — ou rodar contra a API de teste se já no ar; decidir na implementação,
    default = mock de rede.
- Script raiz `test:associados:e2e`.

## Validação

- `pnpm test:associados` (unit) verde.
- `pnpm test:associados:e2e` verde (Playwright headless).
- `pnpm --filter associados build` sem regressão.

## Fora de escopo

- Integração real do SDK de tokenização AbacatePay (segue stub — pendência da story 40).
- Testar o webhook/back-end (coberto em api / story 38).
