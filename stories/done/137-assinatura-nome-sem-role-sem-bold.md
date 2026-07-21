# Plan: Abaixo da assinatura, mostrar só o nome (sem role, sem bold)

## Context

Bloco do BACKLOG **"Assinatura nos documentos"** — 3º item (1º→story 135, 2º→story 136; resta o
botão "redefinir" no perfil).

Hoje `buildSignatureBlock` (`document-template.service.ts`) imprime, abaixo da linha da assinatura,
**duas** informações:

- o **nome** do signatário, em **negrito** (`.doc-signature-name{font-weight:600}`);
- a **role** do usuário (`.doc-signature-role`, label PT via `ROLE_LABEL_PT`).

Pedido: **remover a role** (não precisa aparecer) e **tirar o bold do nome** — abaixo da assinatura
fica só o nome, peso normal.

### Decisões travadas

1. **Remover a renderização da role** do bloco de assinatura: sai o `<div class="doc-signature-role">`.
2. **Nome sem negrito:** `.doc-signature-name` deixa de ter `font-weight:600` (peso normal, herdado
   do corpo).
3. **Limpeza de plumbing morto.** Com a role fora do bloco, o campo `role` de `DocumentSigner`, o
   uso de `ROLE_LABEL_PT` e a leitura de `staff.user.role` em `resolveSigner` ficam sem uso **para
   este fim**. Remover o que ficar órfão **desde que não seja usado em outro lugar** (verificar
   `ROLE_LABEL_PT` e a relação `['user']` do `staffRepo.findOne` — se a relation só servia à role,
   pode sair; se serve a outra coisa, manter). Sem remoção arriscada: na dúvida, manter o campo e só
   parar de renderizar.
4. **Sem mudança de comportamento no resto do bloco:** imagem da assinatura + linha (`_`×25)
   continuam; alinhamento (story 136) e URL local (story 135) não são afetados.

## Desenho

- **`services/api/src/modules/document-template/document-template.service.ts`**
  - `buildSignatureBlock`: remover a montagem/emissão do `<div class="doc-signature-role">`; manter
    apenas img + linha + nome.
  - CSS em `wrapPage`: remover a regra `.doc-signature-role`; alterar `.doc-signature-name` para não
    aplicar `font-weight:600` (remover a regra ou setar `font-weight:normal`).
  - Se `DocumentSigner.role` / `ROLE_LABEL_PT` / relation `['user']` ficarem órfãos após a remoção,
    limpar; caso contrário, deixar como está.
- **Sem migration, sem contrato (`packages/types`/`api-client`), sem frontend, sem Postman.**

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem `skip`/`only`/`xfail`
injustificado. `pnpm test:api:cov` cobrindo o código tocado (≥90% do escopo novo).

- **Unit — `document-template.service.spec.ts`:**
  - HTML renderizado com assinatura contém o **nome** do signatário e **não** contém a role
    (nem o label PT da role, nem o `<div class="doc-signature-role">`).
  - CSS emitido por `wrapPage` **não** aplica `font-weight:600` a `.doc-signature-name` (e não traz
    mais a regra `.doc-signature-role`).
  - Bloco segue com img (quando há assinatura) e linha `_`×25; sem assinatura, só linha + nome.
  - Ajustar/expectativas de testes existentes que afirmavam a presença da role, se houver.

## Fora de escopo

- URL quebrada da assinatura no PDF local (story 135).
- Alinhamento da assinatura no PDF (story 136).
- Botão "redefinir" assinatura no perfil — próximo item do bloco, story própria.
- Qualquer mudança em telas/perfil do adm relacionada a role (a role segue existindo no sistema; só
  não é impressa abaixo da assinatura).
