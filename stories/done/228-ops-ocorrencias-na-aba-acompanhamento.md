# Plan: ops — ocorrências na aba "Acompanhamento" do filho

## Context

Bloco do BACKLOG: "no app ops, nova ocorrência" (itens 226–230 refinam o mesmo formulário).

A aba **Acompanhamento** da ficha do filho (`ResidentTrackingTab`) mostra só os follow-ups
(admissão, disciplina, nota...). Ocorrências registradas com o filho envolvido não aparecem ali —
o servo precisa ir na lista geral de ocorrências da casa e procurar. A ficha deve contar a
história completa do filho.

Decisões travadas (refino com o usuário):

- **Mesclar na timeline**, intercalado por data com os follow-ups, item próprio com badge
  "Ocorrência". Descartado: seção separada e backend gerando follow-up tipo INCIDENT (duplica dado).
- **Sem tela de detalhe:** o item já mostra a descrição completa, severidade, responsável e os
  **outros filhos envolvidos** (decisão da story 227: mostrar todos). Toque não faz nada.
- Somente leitura: o botão "Registrar" da aba continua criando follow-up, não ocorrência.
- **Offline-first:** a ficha abre sem sinal; as ocorrências também têm que abrir.

Dependências: **depende da story 227** (`Incident.residents[]` + filtro `?residentId=` via join).
Stories 229 (tipo positivo/negativo) e 230 (categoria) acrescentam campos ao item — se entrarem
antes, o item já exibe; se depois, elas atualizam o `IncidentTrackingItem`.

## Desenho

### Dados (ops.fonte)

- `queryKeys.incidents.byResident(residentId)` → `['incidents', 'resident', residentId]`
  (prefixo `incidents` já está na allowlist de persistência em `lib/offline/constants.ts` —
  conferir que a nova chave casa; senão incluir explicitamente).
- Hook `useResidentIncidents(residentId)` em `features/incidents/hooks/useIncidents.ts`:
  `api.incidents.list({ residentId })` — pega também ocorrências de casa anterior (filho
  transferido). `placeholderData`: filtrar o cache `incidents.byHouse(houseId)` por
  `residents.some(r => r.id === residentId)` — cobre primeira abertura offline (byHouse já é
  prefetchado) e mostra ocorrências pendentes na fila (otimistas) na hora.
- Invalidação: o `onSuccess`/replay de `incidents/create` já invalida `incidents.all` — o
  prefixo cobre `byResident`.

### UI

- `ResidentTrackingTab`: combina `useResidentFollowUps` + `useResidentIncidents` numa lista
  única ordenada por `date` desc, desempate `createdAt` desc. Extrair a fusão para função pura
  (`mergeTrackingTimeline`) em `features/residents/` para testar isolada.
- Loading/erro: erro só das ocorrências **não** derruba a aba — mostra os follow-ups e um aviso
  discreto ("Não foi possível carregar as ocorrências"). Estados vazios com `EmptyState`.
- `IncidentTrackingItem` (novo, `features/residents/components/`): mesmo layout de
  `TrackingEventItem` (ícone em círculo + título + texto + rodapé), ícone `alert-circle-outline`,
  cor da severidade (`SEVERITY_CONFIG`), título "Ocorrência · <severidade>", descrição completa,
  rodapé "data · responsável", linha "Com: <outros filhos>" quando houver mais de um, e
  `PendingBadge` se for item da fila.
- Componentes ≤150 linhas; a aba só orquestra.

## Validação

- **Unit ops (jest):**
  - `mergeTrackingTimeline`: ordem por data/createdAt, empate entre tipos, listas vazias.
  - `useResidentIncidents`: chama `list({ residentId })`; placeholder filtra `byHouse` por filho;
    item otimista da fila aparece.
  - `IncidentTrackingItem`: severidade, descrição, "Com: ..." só com >1 filho (sem repetir o
    próprio), `PendingBadge`.
  - `ResidentTrackingTab`: timeline mesclada; erro só em ocorrências mantém follow-ups + aviso.
  - Persistência: `persister.test.ts` confirma que `incidents.byResident` é persistida.
- **E2E web offline (Playwright `e2e-web/`):** ampliar `offline-resident-store.spec.ts` — criar
  ocorrência de fixture com o filho, abrir a ficha sem rede e ver a ocorrência na aba.
  Fixture própria, removida no `afterAll` (story 182).
- **E2E Maestro:** `incidents.yaml` ou `residents.yaml` — registrar ocorrência com filho e
  conferir na aba Acompanhamento.
- **Gate de cobertura:** código novo sem teste não fecha a story. `pnpm test:ops:unit` com
  cobertura (≥90% do escopo tocado). Sem `skip`/`only`/`xfail` injustificado.

## Fora de escopo

- Tela de detalhe da ocorrência.
- Ocorrências na ficha do filho no `adm.fonte` (adm ainda não consome incidents).
- Criar ocorrência a partir da aba Acompanhamento.
- Mudanças de backend (cobertas pela 227).
