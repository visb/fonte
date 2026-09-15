# Plan: casas com múltiplos coordenadores — lista derivada de Staff + titular como referência

## Context

Hoje "quem coordena a casa" está escrito em **dois lugares que podem divergir**:

1. `staff.house_id` + `staff.role = COORDINATOR` — o vínculo real do operador, o que o `ops.fonte`
   usa para escopo de tela e o que `BUSINESS_RULES.md` exige ("Staff deve ter `house_id`").
2. `houses.coordinator_id` — uuid **único** e nullable → `staff.id` (`house.entity.ts:38`, FK
   `ON DELETE SET NULL`), preenchido por um `<select>` em `HouseFormFields.tsx:60` que hoje lista
   **todo** o staff da organização, sem filtrar por casa nem por role.

Na prática as casas já têm mais de um coordenador — o cadastro é que não representa isso. E como o
select não valida nada, dá para eleger como coordenador de uma casa alguém que é servo de outra.

A story não inventa entidade nova: **a lista de coordenadores passa a ser derivada de `Staff`**, e
`houses.coordinator_id` deixa de significar "o coordenador" para significar **"o coordenador
titular"** — a referência/contato da casa. Nenhuma migration.

O trabalho de verdade aqui **não** é exibir N nomes numa tela: é fechar as brechas em que o titular
apontado deixa de ser coordenador daquela casa (mudou de casa, virou servo, foi desligado) e a
coluna continua apontando para ele, porque `ON DELETE SET NULL` não dispara em soft delete.

### Decisões travadas (usuário)

1. **A lista deriva de `Staff`**, não de tabela de junção:
   `staff WHERE house_id = :houseId AND role = 'COORDINATOR' AND deleted_at IS NULL`. Uma fonte de
   verdade só. Gerir coordenador da casa vira gerir staff — que é o cadastro que o escritório já faz.
2. **Um coordenador coordena uma casa só.** A invariante `staff.house_id` fica como está; esta story
   resolve *N coordenadores por casa*, não a recíproca. Coordenador em duas casas exigiria tabela de
   junção e quebraria o escopo do operador no `ops.fonte` — fora de escopo.
3. **`houses.coordinator_id` é reusado como titular.** Zero migration: a coluna, a FK e o
   `ON DELETE SET NULL` já existem e servem. O que nasce é uma **invariante de service**: o titular
   tem que pertencer à lista da decisão 1.
4. **O titular é referência/contato e destinatário de avisos.** Nenhuma permissão extra: os
   auxiliares fazem exatamente o mesmo que o titular. `house-capacity-request.service.ts:52` já
   aceita qualquer staff da casa (`staff.houseId === houseId || house.coordinatorId === staff.id`) e
   **continua como está** — o titular não vira aprovador.

### Decisões de desenho derivadas (do levantamento no código)

5. **O titular é opcional.** `coordinator_id` continua nullable. Casa sem nenhum coordenador
   cadastrado é estado legítimo (casa nova, coordenador desligado) e não pode travar o cadastro da
   casa. O que **não** é legítimo é titular fora da lista.
6. **Soft delete não limpa a coluna — o service tem que limpar.** `ON DELETE SET NULL` só dispara em
   DELETE físico, e o projeto usa `deleted_at`. Então `StaffService` passa a zerar
   `houses.coordinator_id` nas três transições que tiram o staff da lista: soft delete, troca de
   `house_id` e mudança de `role` para fora de `COORDINATOR`. Sem isso a casa exibe como titular
   alguém que não é mais coordenador dela — que é exatamente o bug que a story existe para fechar.
7. **A validação do titular mora no `HouseService`**, em `create` e `update`: `coordinatorId` não
   nulo → carregar o staff e exigir `role === COORDINATOR`, `houseId === house.id`,
   `deletedAt === null`. Falhou → **400** com mensagem acionável (*"O coordenador titular precisa ser
   um coordenador lotado nesta casa."*), não 404 — o staff existe, o vínculo é que está errado.
8. **Ordem no create.** Criar casa já passando `coordinatorId` é impossível de satisfazer pela
   decisão 7: o staff só pode ter `house_id` da casa **depois** que ela existe. Então no `create` o
   campo é **recusado** quando vier preenchido (400, *"Defina o coordenador titular depois de
   cadastrar a casa e lotar o coordenador nela."*). O dialog de criação deixa de mostrar o campo.
9. **O detalhe da casa devolve as duas coisas**: `coordinator` (titular, relação que já é carregada
   em `house.service.ts:87`) e `coordinators: Staff[]` (a lista derivada). Sem endpoint novo — a
   lista já é obtenível por `GET /houses/:id/staff`, mas devolvê-la no detalhe evita que o dialog do
   titular precise de um segundo request só para popular um `<select>`.
10. **A listagem de casas não muda.** `HouseCard` continua mostrando **o titular** — é o papel dele.
    Contar coordenadores por card exigiria agregação no `findAll` para um dado que ninguém pediu.
11. **O `<select>` do titular passa a listar só os coordenadores da casa**, não `useStaff()` inteiro
    (`HouseDialog.tsx:27`). É a correção de front que espelha a decisão 7 — a UI para de oferecer
    opção que o backend vai recusar.

---

## Desenho

### 1. Banco

**Nenhuma migration** (decisão 3). `houses.coordinator_id` permanece `uuid NULL` com
`FK_houses_coordinator ... ON DELETE SET NULL`. Migration nesta story = desenho mal lido.

### 2. `packages/types`

`House` ganha o campo derivado no contrato do detalhe:

```ts
export interface House {
  // ...
  coordinatorId: string | null;   // titular (já existe)
  coordinator?: Staff | null;     // titular resolvido (já existe)
  coordinators?: Staff[];         // NOVO — lista derivada, só no detalhe
}
```

Opcional de propósito: `findAll` não popula (decisão 10).

### 3. `HouseService`

```
findOne(id)
  → carrega house (relations: coordinator, photos, como hoje)
  → coordinators = staffRepository.find({
        houseId: id, role: COORDINATOR, deletedAt: IsNull()
      }) ordenados por name
  → devolve { ...house, coordinators }

create(dto)
  → dto.coordinatorId preenchido → 400 (decisão 8)

update(id, dto)
  → dto.coordinatorId === undefined → não mexe
  → dto.coordinatorId === null → limpa (decisão 5)
  → senão → assertEligibleTitular(staffId, houseId) → 400 se falhar (decisão 7)
```

`assertEligibleTitular` é um método privado único, usado pelo `update` — a mesma checagem não pode
existir em dois lugares com duas mensagens diferentes.

### 4. `StaffService` — as três transições (decisão 6)

Ponto central da story. Ao **soft-deletar**, ao **trocar `house_id`** e ao **mudar `role` para fora
de `COORDINATOR`**, se aquele staff for o `coordinator_id` de alguma casa, a coluna é zerada na
mesma transação da alteração do staff.

```ts
// chamado dentro da transação, depois de persistir a mudança no staff
private async clearTitularIfIneligible(staffId: string, manager: EntityManager) {
  await manager.update(House, { coordinatorId: staffId }, { coordinatorId: null });
}
```

Disparado só quando a transição de fato tira o staff da lista — trocar o telefone do coordenador não
pode derrubar o titular. Mudança de casa zera o titular da casa **antiga** (a coluna aponta para lá).

### 5. API

Nenhuma rota nova. Mudanças de comportamento:

| rota | mudança |
|---|---|
| `GET /houses/:id` | resposta passa a trazer `coordinators: Staff[]` |
| `POST /houses` | `coordinatorId` preenchido → **400** (decisão 8) |
| `PATCH /houses/:id` | `coordinatorId` fora da lista → **400** com a mensagem da decisão 7 |
| `GET /houses/:id/staff` | inalterada |
| `POST /houses/:id/capacity-requests` | inalterada (decisão 4) |

`fonte-api.postman_collection.json` atualizado: novo campo na resposta do detalhe e os dois 400 novos
documentados (regra do CLAUDE.md).

### 6. `adm.fonte`

- **`HouseDialog` / `HouseFormFields`**: o `<select>` de titular deixa de consumir `useStaff()` e
  passa a receber a lista de coordenadores **daquela casa** (decisão 11). Rótulo vira
  *"Coordenador titular"*, opção vazia vira *"Sem titular"*. No modo **criação** o campo não é
  renderizado (decisão 8), com a nota *"Defina o titular depois de lotar os coordenadores na casa."*
- **`OverviewTab`**: bloco *"Coordenadores"* listando os nomes, com o titular marcado por badge.
  Casa sem coordenador → `EmptyState` (*"Nenhum coordenador lotado nesta casa."*), nunca lista em
  branco.
- **`StaffTab`**: nada de novo — já lista o staff da casa. Não duplicar a gestão ali.
- **`HouseCard`**: inalterado (decisão 10), só o rótulo passa a dizer titular.
- Erros dos dois 400 exibidos via `getErrorMessage` (CLAUDE.md), nunca cast manual.

### 7. `ops.fonte`

Inalterado. O escopo do operador já é `staff.house_id` — um segundo coordenador na casa sempre
funcionou ali. Se alguma tela do `ops` exibir "coordenador da casa" como nome único, passa a exibir o
titular; não há mudança de comportamento.

---

## Validação

### Backend — `pnpm test:api`

- **`HouseService.findOne`**: devolve `coordinators` com os staff `COORDINATOR` da casa, ordenados
  por nome; **exclui** servo da mesma casa, coordenador de **outra** casa e coordenador
  soft-deletado; casa sem nenhum → array vazio (não `undefined`); titular presente aparece **também**
  dentro de `coordinators` (é coordenador da casa, não uma categoria à parte).
- **`update` (decisão 7)**: titular que é coordenador da casa → 200; staff de outra casa → 400;
  staff `SERVANT` da própria casa → 400; staff soft-deletado → 400; `coordinatorId: null` → limpa sem
  erro; `coordinatorId` ausente no dto → coluna **intacta** (teste de regressão do `undefined` vs
  `null`).
- **`create` (decisão 8)**: `coordinatorId` preenchido → 400 e **nenhuma** casa criada; sem o campo →
  201 com `coordinatorId` nulo.
- **`StaffService`, as três transições (decisão 6)** — cada uma com o staff sendo titular de uma casa:
  soft delete → `coordinator_id` da casa vira null; troca de `house_id` → o titular da casa **antiga**
  é zerado e a casa nova **não** ganha titular automático; `role` de `COORDINATOR` para `SERVANT` →
  zerado. E o negativo que protege contra zelo excessivo: alterar telefone/nome/e-mail do titular
  **não** mexe na coluna.
- **Staff que não é titular de ninguém**: as mesmas três transições não disparam update em `houses`.
- **`house-capacity-request` (decisão 4)**: os specs existentes passam **sem alteração de
  expectativa** — coordenador auxiliar (não titular) da casa continua podendo abrir/aprovar pelo
  ramo `staff.houseId === houseId`. Spec novo prova explicitamente o caso do auxiliar.

### Backend — `pnpm test:api:e2e`

- `GET /houses/:id` para ADMIN e COORDINATOR: `200` com `coordinators` populado; casa com dois
  coordenadores traz os dois.
- `PATCH /houses/:id` com titular inelegível → `400` com a mensagem da decisão 7; com titular válido
  → `200` e o detalhe subsequente reflete o titular.
- `POST /houses` com `coordinatorId` → `400`.
- Fluxo completo da decisão 6 por HTTP: criar casa → lotar dois coordenadores → eleger titular →
  `PATCH` no staff titular mudando de casa → `GET /houses/:id` mostra `coordinator: null` e o outro
  coordenador ainda na lista.
- Fixtures conforme a story 182: criadas pela suíte via API, removidas no `afterAll`, limpeza por id
  acumulado — **nunca** `DELETE FROM houses`/`staff`, que o `seed-test.ts` popula.

### Migration

**Nenhuma** (decisão 3). Validação negativa e explícita: `pnpm migration:run:test` verde **sem
migration nova no diff da story**.

### Contratos

`pnpm build:types` e `pnpm build:api-client` (campo `coordinators` no `House`).
`fonte-api.postman_collection.json` atualizado conforme a seção 5.

### `adm.fonte` — unit (Vitest/RTL)

- `HouseFormFields`: em edição, o `<select>` lista **só** os coordenadores recebidos e não o staff
  geral; em criação, o campo **não** é renderizado.
- `HouseDialog`: submit de edição envia `coordinatorId: null` quando a opção vazia é escolhida (e não
  `''`), preservando o `constants.ts:36` que já faz essa normalização.
- `OverviewTab`: lista os coordenadores com o titular badgeado; sem coordenadores renderiza
  `EmptyState`; com coordenadores mas sem titular, nenhum badge aparece e nada quebra.
- Erro 400 do backend chega como a frase do backend via `getErrorMessage`, não como erro de axios.

### `adm.fonte` — e2e (Playwright)

Estender o spec de casas: abrir casa com dois coordenadores → aba Visão geral mostra os dois →
eleger o titular pelo dialog → badge migra para o eleito → tentar eleger um servo (opção não deve
sequer existir no select).

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. Rodar `pnpm test:api:cov` e `pnpm test:adm:unit` com
cobertura; **não reduzir** a cobertura dos módulos `house` e `staff` do backend nem da feature
`houses` do `adm.fonte`. Os caminhos da decisão 6 (as três transições + o negativo) e da decisão 7
(cada motivo de recusa) são os que precisam estar 100% cobertos — é onde a story pode falhar em
silêncio. Sem `skip`/`only`/`xfail` sem justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Coordenador em mais de uma casa** (decisão 2) — exigiria tabela de junção e mudaria o escopo do
  operador no `ops.fonte`.
- **Permissão diferenciada para o titular** (decisão 4): nada de "só o titular aprova". O
  `house-capacity-request` fica exatamente como está.
- **Roteamento de avisos para o titular.** Hoje não existe fluxo de "aviso do escritório para a
  casa": `message.service.ts` endereça **todo** o staff por `house_id` (linhas 375-376, 447-449).
  Marcar o titular como destinatário preferencial é o *motivo* de manter o campo, mas a mudança no
  módulo de mensagens é story própria — esta não toca em `message`.
- **Gestão de coordenadores por dentro da tela da casa** (adicionar/remover staff pelo detalhe da
  casa). Continua sendo o cadastro de Staff; a aba de casa só exibe.
- **Contagem de coordenadores na listagem de casas** (decisão 10).
- **`support_groups.coordinator_id`** — coordenador de grupo de apoio é outro domínio e outra coluna;
  não é tocado.
- **Histórico de quem foi titular** da casa ao longo do tempo.
