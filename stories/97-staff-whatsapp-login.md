# Plan: Servo — campo "whatsapp" e login por whatsapp

## Context

Bloco do BACKLOG "perfil dos servos": *"Trocar o campo 'telefone' para 'whatsapp'
e usar whatsapp como único campo para login, junto com senha."*

Parte **2/3** do bloco (ver story 96 — campos/abas — e story 98 — anexos).

Situação atual:
- `Staff.phone` (coluna `phone`) guarda o telefone do servo
  (`services/api/src/modules/staff/staff.entity.ts:26`). No form do adm o campo
  aparece como `contactPhone` (`features/staff/lib/staffSchema.ts`).
- **O login já aceita telefone**: `AuthService.resolveUser`
  (`auth.service.ts:43-61`) trata identifier com `@` como e-mail e, senão, como
  dígitos de telefone, resolvendo via
  `UserService.findActiveUserIdsByPhone(digits)`. Essa query
  (`user.service.ts:22`) lê `staff.phone`, `relatives.phone`,
  `residents.contact_phone`. Telefone que casa com >1 usuário = ambíguo →
  rejeitado.

Ou seja: a infra de "login por número" **já existe**. Esta story é
principalmente **renomear `phone`→`whatsapp` no Staff** (semântica + UI) e
**garantir que o whatsapp do servo é o identificador de login**, ajustando a
query de lookup para a coluna renomeada.

### Decisões travadas

- **Renomear a coluna**: migration nova `RENAME COLUMN phone TO whatsapp` em
  `staff` (não dropar+recriar — preserva dados). **Nunca editar migration
  existente.**
- **Escopo do rename = só `Staff`.** `relatives.phone` e
  `residents.contact_phone` **não** mudam aqui (o pedido é sobre servos). A query
  `findActiveUserIdsByPhone` passa a ler `staff.whatsapp` (mantendo
  relatives/residents como estão).
- **Login do servo = whatsapp + senha.** Sem novo mecanismo de auth: o whatsapp
  (dígitos) é o `identifier` que já cai no ramo de telefone do `resolveUser`.
  E-mail continua funcionando para quem tiver (não removemos o ramo de e-mail no
  backend), mas a **UI de cadastro/login do servo** passa a tratar whatsapp como
  o identificador primário.
- **Ambiguidade**: mantém a regra atual (número que casa com >1 usuário ativo é
  rejeitado no login). Idealmente o whatsapp do servo é único; não introduzimos
  constraint de unicidade nesta story (fora de escopo — ver nota).
- **Label/semântica**: todos os rótulos de UI "Telefone" do servo viram
  "WhatsApp"; placeholder/máscara coerentes. Identificadores de código em inglês
  (`whatsapp`), texto em pt-BR só no literal de UI.

## Desenho

### Backend

- Migration `…-StaffPhoneToWhatsapp.ts`: `ALTER TABLE staff RENAME COLUMN phone
  TO whatsapp`.
- `Staff` entity: `phone` → `whatsapp` (coluna `whatsapp`).
- `UserService.findActiveUserIdsByPhone`: ajustar o SELECT de staff para
  `whatsapp AS phone` (mantendo relatives/residents). Método pode manter o nome
  (lookup por número) — só muda a coluna lida.
- DTOs de staff (`create-staff.dto.ts`, `update-staff.dto.ts`,
  `update-staff-me.dto.ts`) e service: `phone` → `whatsapp`. Normalizar dígitos
  ao persistir (coerente com o lookup).
- `@fonte/types`: campo `whatsapp` no tipo Staff (no lugar de `phone`).
- Atualizar `fonte-api.postman_collection.json` (bodies de staff + exemplo de
  login por whatsapp).

### adm.fonte (`features/staff/`)

- `lib/staffSchema.ts`: `contactPhone` → `whatsapp` (na aba Endereço/Contato da
  story 96). Rótulo "WhatsApp".
- Tela de login: rótulo/ajuda deixando claro que servo entra com **WhatsApp** (ou
  e-mail) + senha. Sem mudar o contrato (`identifier` segue aceitando ambos).
- Ajustar telas que exibiam "Telefone" do servo para "WhatsApp"
  (`StaffDetailPage`/`StaffOverviewTab`/`StaffCard`).

### `@fonte/api-client`

- Tipos/DTOs de staff com `whatsapp`. Não duplicar HTTP.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem
`skip`/`only`/`xfail` injustificado. (`pnpm test:api` / `pnpm test:api:cov` +
`pnpm test:api:e2e` + `pnpm test:adm` + cobertura do adm.)

- **Backend**:
  - `findActiveUserIdsByPhone` resolve servo pelo `whatsapp` (dígitos
    normalizados); número de >1 usuário → ambíguo (rejeitado). Regressão:
    relatives/residents continuam resolvendo.
  - e2e de login: servo loga com whatsapp + senha; com e-mail + senha ainda
    funciona; whatsapp inexistente/ambíguo → 401.
  - staff service/controller: criar/atualizar com `whatsapp`; regressão verde.
- **adm.fonte**: schema usa `whatsapp`; tela de login e detalhe exibem rótulo
  WhatsApp; E2E de login por whatsapp.
- **Migration**: aplica em banco de teste sem perda de dados (rename preserva
  valores).
- **Contratos**: `pnpm build:types` / `pnpm build:api-client` verdes.

## Fora de escopo

- Renomear telefone de Relative/Resident (só Staff).
- Constraint de unicidade de whatsapp no banco (mantém regra de ambiguidade no
  login). Pode virar story futura se necessário.
- Remover o ramo de login por e-mail no backend (mantido por compatibilidade).
- Verificação/validação de número via WhatsApp (OTP) — não é objetivo aqui.
