# Plan: Associados — app público `associados` (página de pagamento)

> Filha do epic [[36]]. Depende de [[37]] (token/dados) e [[38]] (endpoints públicos de checkout).
> O link enviado por [[39]] aponta para este app.

## Context

Fatia de frontend público do epic [[36]]. Um **novo app** `associados` hospeda a página onde o
associado, vindo do link do WhatsApp, confirma o valor e **adere à contribuição recorrente** com
cartão. Sem login: o acesso é pelo `payment_token` na URL.

### Decisões travadas (do epic)

- **Novo app `associados`** (não embutir no `adm.fonte`, que é gestão interna autenticada).
- **Público, acesso por `payment_token`** na rota (ex.: `/p/:token`).
- **Valor pré-preenchido e editável** — default = `contribution_amount` do cadastro.
- **Cartão tokenizado direto no AbacatePay** — PAN nunca passa pelo nosso backend (PCI/LGPD).
- Pagamento cria **assinatura recorrente** ([[38]]); a UI deve deixar claro que é mensal recorrente.

### Stack do novo app

`apps/associados/` — **React + Vite** (mesma base do `adm.fonte`, é web público). Reusar o
`@fonte/api-client` (recurso público de [[38]]) e `@fonte/types`. Registrar no workspace pnpm +
script `dev:associados` no root (espelhar `dev:adm`). Build/deploy próprio (`APP_ASSOCIADOS_URL`).

## Desenho

- **Rota** `/:token` (ou `/p/:token`) carrega `GET /public/associates/:token` ([[38]]):
  - token inválido/expirado → tela de erro amigável.
  - válido → mostra nome, mensagem da Fonte, campo de **valor** pré-preenchido editável.
- **Resumo de valores:** ao informar o valor de contribuição, exibir o **valor que será cobrado**
  (contribuição + taxa do cartão = gross-up de [[38]]) de forma transparente, deixando claro que
  a Fonte recebe o valor cheio e que a cobrança é **mensal recorrente**.
- **Cartão:** componente de tokenização do AbacatePay (SDK/iframe do gateway). Receber o
  `cardToken`; **nunca** enviar dados do cartão ao nosso backend.
- **Submit:** `POST /public/associates/:token/subscribe` com `{ contributionAmount, cardToken }`
  ([[38]]). Sucesso → tela de confirmação ("contribuição mensal ativada"). Erro → mensagem clara
  via `getErrorMessage`.
- Padrões do `fonte-frontend`: react-hook-form + zod para o valor; estados Loading/Empty/Error;
  página fina orquestrando hooks/componentes; sem fetch direto na page.
- Acessível e mobile-first (a maioria abre pelo WhatsApp no celular).

## Validação

- Build do novo app: `pnpm --filter associados build` sem erro.
- Lint do app verde.
- Fluxo manual em **sandbox AbacatePay** (cartão de teste): abrir link → ajustar valor → ver
  gross-up → pagar → confirmação → assinatura criada (cruzar com [[38]]). Registrar na story.
- E2E Playwright opcional (espelhar `test:adm`) do caminho feliz se couber.

## Fora de escopo

- Autenticação/portal do associado (cancelar, trocar cartão, histórico) — só a página de adesão.
- PIX / outros métodos — só cartão recorrente.
- App mobile nativo — é web.
- Envio do link (é da [[39]]) e criação da assinatura no gateway (é da [[38]]).
