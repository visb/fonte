# Plan: lista de filhos do `ops.fonte` ordenada por data de entrada

## Context

A lista de filhos do `ops` (`features/residents/pages/ResidentsPage.tsx`) mostra os filhos na
ordem em que chegam do cache. As duas fontes, `GET /houses/:id/residents` e o snapshot offline
`findPresentByHouse` (story 177), ordenam por **nome**. O operador procura com frequência quem
chegou por último na casa e, numa casa cheia, precisa rolar ou buscar pelo nome.

Pedido do usuário (BACKLOG): a lista de filhos deve ser ordenada pela data de entrada, os mais
recentes primeiro.

### Decisões travadas (usuário)

1. **Só o `ops` muda.** O `adm` já tem seletor de ordenação `name`/`entryDate` (story 129) e
   mantém o default atual.
2. **A ordenação é feita no cliente.** Uma função pura aplicada sobre a lista em cache vale igual
   online e offline e não depende da ordem do snapshot nem do merge do delta (`since`). O backend
   não muda.
3. **A ordem é fixa**, sem seletor na tela: entrada mais recente primeiro.

### Decisões de desenho (defaults assumidos no refino)

4. **Desempate e nulos:** `entryDate` desc. Filho sem `entryDate` vai para o fim (mesma regra
   `NULLS LAST` do `adm`, story 129). Datas iguais desempatam por nome (`localeCompare` `pt-BR`),
   e depois por `id`, para a ordem ser estável entre renders.
5. **A ordenação vem antes de busca e filtro de status** e não muda o comportamento deles. A busca
   continua filtrando a lista já ordenada.
6. **`entryDate` é `YYYY-MM-DD`.** A comparação é de string, sem `new Date()`, para não sofrer com
   fuso.

---

## Desenho

### `ops.fonte` (`features/residents/`)

```
lib/sortResidents.ts        ← novo; sortResidentsByEntryDesc(list) — pura, não muta a entrada
pages/ResidentsPage.tsx     ← filtered = sortResidentsByEntryDesc(residents).filter(...) (via useMemo)
```

- `sortResidentsByEntryDesc` recebe `Pick<Resident, 'id' | 'name' | 'entryDate'>[]` e devolve uma
  cópia ordenada.
- Se a lógica de busca + filtro + ordenação passar de uma linha legível na page, extrair para um
  hook `useVisibleResidents(residents, search, statusFilter)` em `hooks/`. A page só orquestra.

---

## Validação

### `ops.fonte`: unit (`pnpm test:ops:unit`)

- **`sortResidentsByEntryDesc`**:
  - datas diferentes → mais recente primeiro;
  - `entryDate` nulo/ausente → fim da lista;
  - datas iguais → desempate por nome com acento (`pt-BR`), depois por `id`;
  - não muta o array de entrada; lista vazia → vazia.
- **`ResidentsPage`**: com cache em ordem alfabética, a lista renderiza em ordem de entrada desc;
  busca e filtro de status continuam funcionando sobre a lista ordenada.
- Atualizar testes existentes da page que dependem da ordem por nome.

### `ops.fonte`: Maestro (`pnpm test:ops`, `e2e/residents*.yaml`)

- Se algum fluxo seleciona o filho pela posição na lista, trocar para seleção por texto/`testID`.
  Não criar fluxo novo só para a ordem: o unit cobre.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente. Código novo sem teste não fecha a story.
Rodar a cobertura de `pnpm test:ops:unit`, **sem reduzir** a cobertura de `features/residents`.
`lib/sortResidents.ts` em 100%. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).
Backend não muda.

---

## Fora de escopo

- Mudar o default ou o seletor de ordenação do `adm` (decisão 1).
- Mudar o `ORDER BY` de `/houses/:id/residents` ou do snapshot offline (decisão 2).
- Seletor de ordenação na tela do `ops` (decisão 3).
- Outras listas de filhos do `ops` (seletores em contribuição, contagem, ministérios).
