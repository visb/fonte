# Plan: Eventos — campos de formulário de inscrição customizáveis pelo adm

> Estende a feature Eventos. Segunda das 3 fatias do refino: [[67]] (toggle de inscrição — feito
> antes), [[68]] (este), [[69]] (pagamento). Depende de [[67]] (só evento com inscrição ligada tem
> form) e do form público de [[58]].

## Context

Hoje (entregue em [[58]]) o formulário de inscrição pública é fixo: `name`, `contact`, `email?`.
Cada tipo de evento precisa coletar dados diferentes (tamanho de camiseta, restrição alimentar,
nome do acompanhante, comprovante etc.). O admin precisa **montar os campos do formulário por
evento**, sem depender de dev.

### Decisões travadas (do usuário — 2026-06-19)

- **Base fixa + campos custom por cima.** `name` e `contact` continuam **sempre presentes e
  obrigatórios** (necessários p/ contato e p/ o pagamento da [[69]]); `email` segue como base
  opcional. O admin **adiciona campos extras** por cima — não remonta a identificação do zero.
  Reduz risco de inscrição sem como contatar.
- **Conjunto completo de tipos** nesta fatia: `short_text`, `long_text`, `number`, `boolean`
  (sim/não), `select` (lista de opções, escolha única), `multi_select` (múltipla escolha), `date`,
  `email`, `phone`, `file` (upload).
- **Obrigatório por campo**: o admin marca cada campo custom como `required` ou opcional.
  Validação aplicada **no backend e no form público** (zod dinâmico).
- Permissão de edição dos campos: **ADMIN e COORDINATOR** (gestão do evento).

## Desenho

### Modelo dos campos (definição) e das respostas

- **Definição** mora no próprio evento: coluna `events.registration_fields` JSONB not null default
  `'[]'`. Cada item:
  ```
  { id: string (uuid/slug estável), label: string, type: FieldType,
    required: boolean, order: number, options?: string[] (select/multi_select),
    placeholder?: string }
  ```
  `id` estável (gerado na criação do campo) para casar resposta↔campo mesmo se o label mudar.
- **Respostas** na inscrição: coluna `event_registrations.answers` JSONB not null default `'{}'`
  — mapa `{ [fieldId]: value }`. `file` guarda a **storage key** (nunca URL); demais tipos guardam
  o valor primitivo/array.

### Backend — módulo `event`

- **Migration** nova: adiciona `events.registration_fields` JSONB e
  `event_registrations.answers` JSONB (defaults acima). Não editar migrations existentes.
- **Entities**: `Event.registrationFields: RegistrationField[]`,
  `EventRegistration.answers: Record<string, unknown>`.
- **DTOs / validação do schema de campos** (admin, em `Create/UpdateEventDto`):
  - `registrationFields?: RegistrationFieldDto[]` validado com `class-validator` (+
    `@ValidateNested`/`@Type`): `label` min 1, `type` ∈ enum, `required` boolean, `options`
    obrigatório e não-vazio só p/ `select`/`multi_select`, `order` int. Garantir `id` único por
    evento (gerar no backend se vier sem).
- **Validação dinâmica das respostas** (`POST /public/events/:id/register`):
  - construir validação a partir de `registration_fields` do evento: `required` ausente → 400;
    tipo incompatível → 400 (`number` numérico, `date` ISO, `email` formato, `phone` formato
    básico, `select` ∈ options, `multi_select` ⊆ options, `boolean` bool).
  - base fixa (`name`/`contact` obrigatórios, `email?`) validada como hoje.
  - persistir `answers` só com os fieldIds conhecidos (ignorar chaves estranhas).
- **Upload de arquivo (campo `file`)** — endpoint público dedicado, pois o multipart não cabe no
  JSON de register:
  - `POST /public/events/:id/registration-files` (`FileInterceptor('file')`, `ThrottlerGuard` +
    `@Throttle` por IP, mesmas `attachmentOptions`/limites de tamanho e validação de mime do
    módulo `payable`/[[56]] banner). Grava no storage, responde `{ fileKey }`.
    O `register` recebe esse `fileKey` no `answers[fieldId]`.
  - Endpoint admin p/ baixar/visualizar arquivo da inscrição via signed URL
    (`StorageUrlInterceptor`), ADMIN+COORDINATOR.
- **`GET /events/:id/registrations`** (admin, já previsto em [[58]]) passa a devolver `answers`
  (com signed URL p/ campos `file`).
- **`GET /public/events/:id`** devolve `registrationFields` p/ o portal renderizar o form.
- Atualizar `fonte-api.postman_collection.json`.

### Tipos / api-client

- `@fonte/types`: `RegistrationField`, `FieldType` (enum), `EventRegistration.answers`,
  `EventPublic.registrationFields`. `RegisterToEventInput` ganha `answers`. `pnpm build:types`.
- `@fonte/api-client`: `events` (admin) propaga `registrationFields` em create/update; recurso
  público ganha `uploadRegistrationFile(eventId, file)`; `register` envia `answers`.
  `pnpm build:api-client`.

### Frontend adm.fonte — construtor de campos

- `components/RegistrationFieldsBuilder.tsx` dentro da seção de inscrição do `EventForm`
  ([[67]]): lista editável de campos (adicionar/remover/reordenar), cada um com label, tipo,
  obrigatório e (p/ select/multi_select) opções. Extrair item como componente
  (`RegistrationFieldRow`) — nunca item inline complexo (regra CLAUDE.md).
- react-hook-form + zod (`useFieldArray` p/ a lista). Sem `useState` de campo.
- Visualização das inscrições recebidas (`GET /events/:id/registrations`) mostrando as respostas
  custom + link p/ arquivos (signed URL). Componentes acima de ~150 linhas → quebrar.

### Portal público (`portal.fonte`) — form dinâmico

- `EventRegistrationForm` ([[58]]) passa a renderizar os campos base **+** os
  `registrationFields` do evento, montando um **schema zod dinâmico** a partir das definições
  (`required`, tipo). Um componente por tipo de campo (`DynamicField` que despacha por `type`).
- Campo `file`: faz `uploadRegistrationFile` antes/junto do submit e manda o `fileKey` no
  `answers`. Estados Loading/Error; erros via `getErrorMessage`.

## Validação

- `pnpm test:api` — unit: validação de schema de campos (options obrigatório p/ select; ids
  únicos); validação dinâmica de respostas (required ausente → 400; tipo errado → 400;
  `select`/`multi_select` fora das options → 400); answers persiste só fieldIds conhecidos; upload
  grava key e devolve fileKey.
- `pnpm test:api:e2e` — register com campos custom (sucesso); required faltando (400); upload de
  arquivo público (throttle/mime); `GET /events/:id/registrations` (ADMIN) devolve answers + signed
  URL; público vê `registrationFields` em `GET /public/events/:id`.
- `pnpm test:adm:unit` — schema do builder (select exige opções; pelo menos label+tipo).
  `pnpm test:adm` — Playwright: admin adiciona campos custom, salva; inscrição aparece com as
  respostas.
- `pnpm test:portal` — unit do form dinâmico (schema zod por tipo; required); e2e: inscrever com
  campos custom mockando endpoints.
- Builds `adm.fonte` / `portal.fonte` verdes. `build:types`/`build:api-client` ok. Postman
  atualizado.
- **Gate de cobertura (trava a story):** todo caminho novo ou alterado por esta story tem teste
  correspondente — nenhum código novo entra sem teste. Cobrir explicitamente **cada tipo de
  campo** (validação por tipo no backend e no form dinâmico). Rodar `pnpm test:api:cov` + runners
  de cobertura de `adm.fonte` e `portal.fonte`; **não reduzir** a cobertura dos módulos tocados.
  Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Pagamento da inscrição → [[69]].
- Lógica condicional entre campos (mostrar campo B se A = X) — fora desta fatia.
- Reuso/template de conjuntos de campos entre eventos (cada evento define os seus).
- Edição de campos depois que já há inscrições respondidas (assumir append/edição cuidadosa;
  `id` estável mitiga, mas migração de respostas antigas não entra aqui).
- Telas de eventos no `ops.fonte`/`app.fonte`.
