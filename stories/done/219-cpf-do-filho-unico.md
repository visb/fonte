# Plan: CPF do filho único (adm + ops, criar e editar)

## Context

Pedido do backlog: *"transformar campo cpf dos filhos como unico, adicionar esta validação no app
adm e no ops ao criar e editar filhos"*.

Hoje `residents.cpf` é `varchar` livre, sem índice: às vezes com máscara (`000.000.000-00`, formato
que o parser de ficha `.docx` gera), às vezes só dígitos (planilha). Só o import em lote recusa CPF
repetido (`ImportService.assertNoCpfConflict`, carrega **todos** os filhos e compara dígitos em
memória). Cadastro e edição pelo `adm` (`POST`/`PATCH /residents`, `PATCH` de identidade) e pela
Contagem do `ops` não checam nada: a mesma pessoa vira dois filhos, e a story 218 (reacolher pela
contagem) depende do CPF como chave confiável.

### Decisões travadas (usuário)

1. **Normalizar + índice único no banco.** CPF gravado **só com dígitos**; a máscara é só de
   exibição/digitação. Índice único parcial `(cpf) WHERE cpf IS NOT NULL AND deleted_at IS NULL`.
   O service checa antes e devolve **409** amigável; o índice é a garantia contra corrida e contra
   a fila offline do `ops`.
2. **Duplicados existentes: a migration limpa o CPF dos repetidos** antes de criar o índice.
3. **Dígito verificador validado só em escrita nova/alterada**: 11 dígitos + DV válido ao criar ou
   mudar o CPF. Ficha legada com CPF inválido continua salvável editando outro campo (mesma postura
   das stories 202/203).

### Decisões de desenho (defaults assumidos)

4. **Quem fica com o CPF no grupo duplicado**: o filho em acolhimento (`ACTIVE`/`DISCIPLINE`…,
   status não terminal) tem prioridade; empate → o de `updated_at` mais recente. Os outros ficam com
   `cpf = NULL`.
5. **Limpeza reversível**: antes de zerar, a migration copia para uma tabela
   `resident_cpf_dedup_log` (`resident_id`, `old_cpf`, `kept_resident_id`, `created_at`). Nada se
   perde; o admin pode consultar e mesclar à mão depois. A migration loga a contagem de grupos e
   filhos afetados. O `down` restaura os CPFs a partir do log e derruba o índice.
6. **Ordem da migration**: (a) normalizar todos os CPFs para dígitos (`regexp_replace(cpf, '\D', '',
   'g')`; vazio → `NULL`); (b) dedup com log; (c) índice único. Normalização vem antes porque
   `123.456.789-09` e `12345678909` são o mesmo CPF.
7. **Soft-deletado não conta**: índice parcial e checagem ignoram `deleted_at`.
8. **Validação compartilhada**: `normalizeCpf()` e `isValidCpf()` em `@fonte/types` (usados no
   backend, no `adm` e no `ops`). Backend: decorator/validator customizado no `class-validator`
   aplicado aos DTOs de create, update, identidade e import (normaliza no `@Transform`, valida DV).
9. **Mensagem de conflito acionável**: *"Já existe um filho com este CPF: <nome> (<status>)."* com
   `conflictResidentId` no corpo do 409 — o `adm` mostra link para o cadastro e a 218 usa para
   oferecer "reacolher". O nome só aparece para quem já pode ler filhos (ADMIN/COORDINATOR/SERVANT da
   rota).
10. **Import**: `assertNoCpfConflict` passa a usar a mesma checagem por query indexada (não carrega
    a tabela inteira). `checkConflict` e `import-match` continuam comparando por dígitos.
11. **`ops.fonte` offline**: o pré-check no cliente só valida formato/DV (não há como checar
    unicidade sem rede). Com a 218, adicionar filho exige rede, então o 409 aparece na hora; se o
    sinal cair depois do envio e o item for para a fila, o 409 vai para a tela de pendências
    (`/sync`) com a mensagem — nunca descartado em silêncio (invariante offline-first).
12. **Postman/LGPD**: o CPF continua mascarado nas respostas para quem não é privilegiado
    (`sensitive-data.interceptor`), agora sobre o valor em dígitos — conferir que a máscara de
    exibição continua certa.

### Dependências

- **218** consome o 409 (`conflictResidentId`) para oferecer reacolhimento. Independentes na ordem.
- Antes de rodar em produção: rodar a migration num dump recente (ver skill `fonte-backup`) para
  conferir quantos CPFs serão limpos.

---

## Desenho

### 1. `packages/types`

```ts
export function normalizeCpf(value: string | null | undefined): string | null; // só dígitos; '' → null
export function isValidCpf(digits: string): boolean;                             // 11 dígitos + DV, rejeita repetidos (000…)
export function formatCpf(digits: string): string;                               // 000.000.000-00
```

### 2. Backend (`services/api`)

- Migration nova `UniqueResidentCpf` (decisões 4–6), com `down`.
- Validator `IsCpf` (normaliza + DV) nos DTOs de create/update/identidade/import.
- `ResidentService`: `assertCpfAvailable(cpf, exceptId?)` chamado no create, update e update de
  identidade **só quando o CPF muda**; captura também a violação do índice (`23505`) e converte no
  mesmo 409 (corrida).
- `ImportService.assertNoCpfConflict`: query indexada.
- Busca por CPF (`resident.service.ts:172`) simplifica para comparar dígitos direto.
- **Postman**: exemplos de 400 (CPF inválido) e 409 (CPF em uso) em `POST`/`PATCH /residents` e no
  `PATCH` de identidade.
- `BUSINESS_RULES.md`: CPF do filho é único entre filhos não excluídos, gravado só com dígitos.

### 3. `adm.fonte`

- Schemas zod de cadastro/edição/identidade/import usam `isValidCpf` (mensagem *"CPF inválido."*).
- Input com máscara na digitação; envia dígitos.
- 409: erro no campo CPF + link "Ver cadastro" para `conflictResidentId`.

### 4. `ops.fonte`

- `features/census/lib/addResidentSchema.ts` e o formulário de edição de filho (se existir no ops)
  usam `isValidCpf`; envio em dígitos.
- 409 tratado com `getErrorMessage` no `onFailed`; na fila, aparece em `/sync`.

---

## Validação

### Pacote: `pnpm build:types` + testes do helper

- `normalizeCpf`, `isValidCpf` (válido, DV errado, repetidos `111…`, tamanho errado), `formatCpf`.

### Backend: `pnpm test:api`

- Create/update com CPF de outro filho → 409 com `conflictResidentId`; com CPF de filho
  soft-deletado → ok; update mudando só outro campo de ficha com CPF legado inválido → ok; mudando
  o CPF para inválido → 400.
- Violação `23505` convertida em 409.
- Import recusa CPF em uso (regressão, agora indexado).

### Backend: migration (`pnpm --filter api migration:run:test`)

- Teste da migration (spec dedicado ou e2e de schema): grupo com ativo + arquivado → ativo fica com
  o CPF; empate → `updated_at` mais recente; log gravado; máscaras normalizadas; `down` restaura.

### Backend: `pnpm test:api:e2e`

- `POST /residents` duas vezes com o mesmo CPF (formatos diferentes) → 201 e 409.
- Fixtures próprias, removidas no `afterAll`, limpeza por id (story 182). Conferir se o
  `seed-test.ts` tem CPFs repetidos e corrigir.

### `adm.fonte`: unit (`pnpm test:adm:unit`) + Playwright (`pnpm test:adm`)

- Schemas rejeitam CPF inválido; 409 mostra erro no campo com link.
- E2E: cadastrar filho com CPF já usado por fixture → erro no campo.

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- `addResidentSchema` rejeita CPF inválido; payload em dígitos; 409 vira alerta.

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:api:cov` sem reduzir a cobertura de `resident`;
validator e `assertCpfAvailable` ≥90%. Runners com cobertura de `adm.fonte` e `ops.fonte` para os
arquivos tocados ≥90%. Sem `skip`/`only`/`xfail` sem justificativa explícita no código.

---

## Fora de escopo

- Mesclar cadastros duplicados (o log da decisão 5 é o insumo para isso depois).
- CPF único para staff, familiares ou associados.
- Tela no `adm` para consultar o `resident_cpf_dedup_log`.
- Consulta de CPF na Receita.
