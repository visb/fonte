# Plan: e2e da aba de anexos do filho, com fixture de templates via API

## Context

Item do BACKLOG: **infra de seed E2E de `document_templates`**. As stories
[[152-documentos-pdf-combinado-impressao]], [[160-template-disponibilidade-por-status]] e
[[161-barra-pdf-combinado-sempre-visivel]] mexeram na aba "anexos" do filho e saíram **sem
cobertura e2e**, porque falta a infraestrutura de dados: nada cria um `document_template` no
ambiente de teste.

Estado verificado:

- `services/api/src/database/seed-test.ts` (298 linhas) **não** insere nada em `document_templates`.
- `apps/adm.fonte/e2e/document-templates.spec.ts` existe, mas cobre só o **editor**
  (`/settings/templates`): fonte, imagem, tabelas, zoom, A4, autocomplete, link. Nada da aba de
  anexos do filho.
- Sem template no banco, `selectableTemplates` (`AttachmentsTab.tsx:53-56`) é sempre vazio: a barra
  do PDF combinado nasce no estado degenerado e o ciclo "marcar todos → gerar PDF combinado →
  seleção limpa" é inatingível por e2e.
- Os helpers atuais (`e2e/helpers/auth.ts`, `e2e/helpers/residents.ts`) só dirigem UI; não há
  helper de chamada direta à API.
- `playwright.config.ts` roda `workers: 1` e `fullyParallel: false` — execução serial, então
  fixture com escopo de arquivo é segura.

**A razão de o item falar em "sem poluir as outras suítes"**: `admissionGate.ts:21`
(`allRequiredDocsSigned`) trava o wizard de acolhimento enquanto existir template obrigatório não
assinado. Um obrigatório permanente no seed global passaria a bloquear `residents.spec.ts`,
`dashboard.spec.ts` e `bible-courses.spec.ts`, que usam `createResidentViaWizard`.

### Decisões travadas (refinadas nesta sessão)

1. **Fixture por spec via API**, não seed global. `beforeAll` cria os templates via
   `POST /document-templates`; `afterAll` remove via `DELETE /document-templates/:id`. Os dados só
   existem durante o arquivo de spec, então nenhuma outra suíte enxerga obrigatório pendente e o
   gate do acolhimento continua como está hoje. Custo aceito: um helper novo de request autenticado.
   Descartado o seed global (exigiria consertar 3 suítes) e a criação pela UI (lenta e acopla o
   teste da aba de anexos ao editor de templates).
2. **Escopo do spec cobre 161 + 160.** Além do ciclo do PDF combinado, o spec cobre o predicado de
   disponibilidade por status — é a story mais fácil de regredir em silêncio, já que sumir da tela
   é a ausência de um elemento.
3. **Cobertura da 160 sem semear filho novo.** Contra o filho ACTIVE já existente no seed
   (`João Testador`), a fixture cria um template `ACTIVE_ONLY` (deve aparecer) e um `INACTIVE_ONLY`
   (deve sumir do card, do menu "Gerar documento" e da seleção). Os dois sentidos do predicado caem
   sobre o mesmo filho, sem inventar resident de outro status.
4. **Arquivo novo**, `e2e/resident-attachments.spec.ts` — não enfiar na `document-templates.spec.ts`
   (que é do editor) nem na `residents.spec.ts` (já grande). O nome diz a tela coberta.
5. **`seed-test.ts` não muda.** A infra pedida pelo backlog é o helper de fixture, não linha nova de
   seed. Se uma story futura precisar de template permanente, aí sim revisita — e terá de resolver
   o gate do acolhimento junto.
6. **Sem mudança de produto.** Story só de teste: nenhum endpoint, entity, migration ou componente é
   alterado ⇒ **sem** atualizar `fonte-api.postman_collection.json`, sem `build:types` /
   `build:api-client`.

## Desenho

### `e2e/helpers/api.ts` (novo — a "infra" do item)

- `loginApi(request)`: `POST /auth/login` com `TEST_ADMIN` (reusar as credenciais de
  `helpers/auth.ts`, não duplicar literal) → devolve `accessToken`.
- `createTemplate(request, token, data)`: `POST /document-templates` com `name`, `content`,
  `isRequired`, `signAtAdmission`, `availableFor`. Devolve o template criado (precisa do `id` para
  o cleanup).
- `deleteTemplate(request, token, id)`: `DELETE /document-templates/:id`, tolerante a 404 (se um
  teste já removeu, o cleanup não pode derrubar a suíte).
- Base URL da API vem do ambiente de teste (API em `localhost:3001`), não do `baseURL` do
  Playwright (que é o front em `5174`). Centralizar essa constante no helper.
- `name` do template é `unique` na entity (`document-template.entity.ts:9`) ⇒ sufixar com
  `Date.now()` como as suítes existentes já fazem, para reexecução não colidir.

### `e2e/resident-attachments.spec.ts` (novo)

`beforeAll` cria três templates com conteúdo mínimo e `afterAll` remove todos:

| template | `isRequired` | `signAtAdmission` | `availableFor` | papel |
|---|---|---|---|---|
| A | `true` | `false` | `ALL` | obrigatório, entra na seleção |
| B | `false` | `true` | `ACTIVE_ONLY` | assinatura no acolhimento, entra na seleção do filho ACTIVE |
| C | `true` | `false` | `INACTIVE_ONLY` | obrigatório que **não** vale para ACTIVE — deve sumir |

Casos:

1. **Estado inicial da barra (story 161)** — abrir a aba de anexos de `João Testador`: a barra está
   visível com 0 selecionados, o botão "Gerar PDF combinado" **desabilitado** e o checkbox de
   cabeçalho desmarcado.
2. **Marcar todos** — clicar no checkbox de cabeçalho marca A e B (2 selecionáveis), a contagem vira
   o texto plural e o botão habilita.
3. **Ciclo completo** — com todos marcados, clicar em "Gerar PDF combinado", capturar o
   `download` (`page.waitForEvent('download')`) e confirmar que **a seleção fica limpa** depois do
   sucesso (contagem zera, botão volta a desabilitado). É a decisão 6 da story 161, hoje sem rede.
4. **Desmarcar todos** — do estado "todos marcados", clicar no checkbox de cabeçalho esvazia a
   seleção.
5. **Disponibilidade por status (story 160)** — o template C (`INACTIVE_ONLY`) não aparece na lista
   de cards, não aparece no menu "Gerar documento" e não é contado nos selecionáveis; o B
   (`ACTIVE_ONLY`) aparece.

Notas de implementação:

- Reusar `login` e `openResidentFromList` dos helpers existentes; não recriar navegação.
- Se faltar seletor estável na barra/nos cards, adicionar `data-testid` mínimo nos componentes
  (`CombinedPdfBar.tsx`, `DocumentCardList.tsx`) em vez de amarrar em classe Tailwind — é a única
  mudança de código de produção admitida por esta story.
- O caso 3 depende de o backend gerar o PDF combinado no ambiente de teste; se a geração exigir
  assinatura do staff (`me.signatureUrl`) ou abrir o `MissingFieldsDialog`, tratar isso **no
  desenho do teste** (usar template sem variáveis obrigatórias e conferir o estado da assinatura do
  admin no seed) — não relaxar a asserção nem marcar `skip`.

## Validação

Gate: **código novo sem teste não fecha a story.** Aqui o entregável *é* o teste — o gate vira
"o spec roda verde e as suítes vizinhas continuam verdes". Sem `skip`/`only`/`xfail` sem
justificativa explícita no código.

- `pnpm test:adm` — a suíte **inteira**, não só o arquivo novo. É a asserção central da decisão 1:
  `residents.spec.ts`, `dashboard.spec.ts`, `bible-courses.spec.ts` e `document-templates.spec.ts`
  precisam continuar passando com a fixture no ar.
- Rodar `pnpm test:adm` **duas vezes seguidas sem recriar o banco** — prova que o `afterAll` limpa
  de verdade e que o sufixo de nome evita colisão de `unique`.
- Pré-requisitos: `pnpm test:setup` + `pnpm dev:api:test` + `pnpm --filter adm.fonte dev:test`
  (porta 5174).
- `pnpm test:adm:unit` — só se um `data-testid` for adicionado a componente já coberto por unit
  test (`AttachmentsTab.test.tsx`, `useDocumentGeneration.test.tsx`), para confirmar que nada
  quebrou.
- `pnpm test:api` — não deve ser afetado; rodar como rede de segurança se qualquer arquivo de
  `services/api` for tocado (o esperado é nenhum).

## Fora de escopo

- Semear `document_templates` no `seed-test.ts` global.
- Consertar o gate do acolhimento para conviver com obrigatório permanente.
- Cobrir o editor de templates (`/settings/templates`) — já tem spec.
- E2E de upload de "outros anexos", do `MissingFieldsDialog` e do fluxo de assinatura
  (`SignatureDialog`).
- Cobertura equivalente no `ops.fonte`/`app.fonte` — a aba de anexos é tela do `adm.fonte`.
