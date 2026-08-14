# Plan: ops.fonte — modal de detalhes do filho na contagem + foto em tela cheia

## Context

Na contagem (`CensusPage`), a linha de cada filho (`CensusListItem`) mostra uma thumb de 40px, o
nome e dois botões (confirmar / remover). **Nada mais é tocável**: o operador que bate o olho na
thumb e fica na dúvida — *"é esse o João mesmo?"* — não tem para onde ir sem sair da contagem,
perder as confirmações já marcadas (`confirmedIds` é estado local da página) e abrir a ficha em
Filhos. É o pior momento possível para navegar para fora: a contagem é uma passada única no pátio.

Pedido do backlog: abrir um **modal com detalhes do filho**, e **tocar diretamente na foto** expande
para **tela cheia**.

### A restrição que manda no desenho

`GET /houses/:id/residents` (`HouseService.findResidents`, query crua) devolve **seis campos**:

```
id, name, status, entryDate, photoUrl, photoThumbUrl
```

Não tem ministério, nascimento, telefone nem saúde. A ficha completa vem de `GET /residents/:id`
(`useResidentById`), cuja query key `['resident', id]` **está** na allowlist de persistência
(`lib/offline/constants.ts`) — mas **não é aquecida**: `prefetch.ts` só esquenta
`residents.byHouse`, storeroom, supply-room, incidents e activities. Quem coloca a ficha no
dispositivo é a [[177]] (snapshot da casa) consumida pela [[175]] (SQLite) — nenhuma das duas
implementada.

E contagem acontece **no pátio, sem sinal** — invariante offline-first do ops.fonte (CLAUDE.md).
Um modal que dependa de rede é um modal quebrado justamente na hora em que é usado.

### Decisões travadas (usuário)

1. **Conteúdo híbrido, com degradação graciosa.** O modal abre **imediatamente** com o que a
   listagem da contagem já tem em mãos (foto, nome, status, data de entrada) e **enriquece** com
   `useResidentById` quando o dado existir — em cache persistido ou por rede. Sem sinal e sem cache,
   o modal mostra o essencial e **não** mostra erro nem spinner bloqueante: o dado extra
   simplesmente não aparece. Quando a [[177]] aquecer a ficha, o modal fica rico **sem alterar uma
   linha desta story**.
   - Descartado engordar `GET /houses/:id/residents`: cresceria o payload de toda a casa e faria
     dado de **saúde** trafegar numa tela que não precisa dele (LGPD).
   - Descartado depender só de `useResidentById`: criaria dependência de bloqueio na [[175]]/[[177]]
     e um modal vazio no pátio.
2. **Gestos, como o backlog descreve**: toque **na foto** → foto em **tela cheia**, direto (um
   toque); toque no **resto da linha** → modal de detalhes. Os botões de confirmar e remover não
   mudam de comportamento nem de área.
3. **Modal é só leitura**, com um link **"Ver ficha completa"** que navega para `/residents/[id]`
   (rota que já existe). Confirmar e remover seguem **exclusivamente** nos botões da linha: um
   caminho por ação, sem duplicar a lógica de contagem nem sincronizar dois gatilhos com o
   `confirmedIds` da página.

### Decisões de desenho derivadas

4. **Reusar o expansor de foto que já existe.** `ResidentPhoto`
   (`features/residents/components/ResidentPhoto.tsx`) já faz thumb → `Modal` transparente com
   `resizeMode="contain"`, fundo preto, botão de fechar e nome embaixo. O que ele **não** faz é
   separar o avatar do expansor — os dois estão colados no mesmo componente, com o tamanho
   `w-24 h-24` fixo. Extrair o expansor (`ResidentPhotoViewer`) e deixar `ResidentPhoto` consumi-lo,
   para a contagem usar o mesmo visualizador a partir de uma thumb de 40px. Refatoração sem mudança
   de comportamento na ficha.
5. **Foto grande offline pode não existir.** `photoThumbUrl` foi renderizada na lista (e o RN a tem
   no cache de imagem do SO), mas `photoUrl` — a versão cheia — pode nunca ter sido baixada. O
   visualizador usa `onError` para **cair na thumb** em vez de mostrar retângulo vazio: melhor uma
   foto pixelada que serve para reconhecer um rosto do que nada. Sem nenhuma das duas, o expansor
   não abre (o toque na foto não faz nada), como já é hoje no `ResidentPhoto` (`disabled={!fullUrl}`).

---

## Desenho

### 1. `ResidentPhotoViewer` (extração, `features/residents/components/`)

```tsx
interface Props {
  visible: boolean;
  name: string;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
  onClose: () => void;
}
```

Modal transparente, fundo `bg-black/90`, imagem `resizeMode="contain"`, botão de fechar, nome
embaixo — o markup que hoje vive dentro do `ResidentPhoto`, movido. Novo em relação ao original: o
`onError` da `Image` troca a fonte para a thumb (decisão 5).

`ResidentPhoto` passa a ser só o avatar circular + estado `open` + `<ResidentPhotoViewer/>`. A ficha
do filho continua idêntica — quem prova isso é o `ResidentComponents.test.tsx` existente.

### 2. `CensusListItem` — dois alvos de toque

- A `View` da thumb vira `TouchableOpacity` com `accessibilityLabel={`Ver foto de ${name}`}`,
  chamando `onOpenPhoto()`. Desabilitada quando não há foto alguma.
- O bloco central (nome + badge) vira `TouchableOpacity` com
  `accessibilityLabel={`Detalhes de ${name}`}`, chamando `onOpenDetails()`.
- Botões de confirmar/remover: **inalterados**. Não envolver a linha inteira num `Touchable` — o
  toque escaparia para o alvo errado ao mirar nos botões, e confirmar presença por engano é o tipo
  de erro que estraga a contagem.

Props novas: `onOpenDetails: () => void` e `onOpenPhoto: () => void`.

### 3. `ResidentDetailModal` (`features/census/components/`)

```tsx
interface Props {
  visible: boolean;
  // O que a listagem da contagem já tem — sempre presente.
  resident: { id: string; name: string; status: string; entryDate: string | null;
              photoUrl?: string | null; photoThumbUrl?: string | null } | null;
  onClose: () => void;
}
```

- Chama `useResidentById(resident?.id, { enabled: visible })` — fetch condicional pelo padrão de
  `options?: { enabled }` do CLAUDE.md, para o modal fechado não puxar nada.
- Renderiza **sempre** o bloco base a partir de `resident`: avatar (tocável → `ResidentPhotoViewer`),
  nome, status, data de entrada.
- Renderiza o bloco **extra** apenas com `data` do `useResidentById`: ministério, nascimento/idade,
  telefone de contato. **Sem** `LoadingState` e **sem** `ErrorState` — `isLoading`/`error` aqui não
  são falha, são "ainda não temos" (invariante offline-first: erro de rede não é erro na cara do
  operador). Nada de saúde/CPF no modal: identificação é o objetivo, e o que passa disso está na
  ficha.
- Rodapé: **"Ver ficha completa"** → `router.push(`/residents/${id}`)` e fecha o modal.
- Reusa `ResidentPhotoViewer` para o avatar do próprio modal, então a foto expande tanto da lista
  quanto de dentro do modal.

Componente fica em `features/census/components/` (é a view da contagem) e consome o hook de
`features/residents/hooks/useResidents.ts` — não duplicar hook (regra "já existe hook para esse
recurso?" do CLAUDE.md).

### 4. `CensusPage` — dois estados novos

```tsx
const [detailTarget, setDetailTarget] = useState<Resident | null>(null);
const [photoTarget, setPhotoTarget]   = useState<Resident | null>(null);
```

Passados ao `CensusListItem` no `renderItem`; os dois modais montados ao lado dos que já existem
(`AddResidentModal`, `RemoveResidentModal`, `ConcludeCensusModal`). O `confirmedIds` **não é
tocado** — abrir e fechar o modal não pode mexer em confirmação (decisão 3).

### 5. Offline

Nenhuma mudança em `lib/offline/`: `['resident', id]` **já** está na allowlist
(`PERSISTED_QUERY_PREFIXES`), então a ficha aberta uma vez com sinal fica no disco e alimenta o
modal depois. Nenhuma mutation nova — o modal não escreve nada, logo não há item de outbox, não há
`setMutationDefaults`, não há tela de pendências envolvida. **Não** adicionar `residents.detail` ao
`prefetch.ts`: aquecer N fichas por casa é exatamente o fan-out que a [[177]] existe para eliminar
(uma requisição por filho, ~40 requisições por casa). Esta story não abre esse buraco.

---

## Validação

Story **frontend-only** (`ops.fonte`). Nenhuma rota, DTO, entity, migration ou tipo compartilhado é
tocado — logo, **sem** `test:api`, `test:api:e2e`, `build:types`, `build:api-client` ou Postman.

### Unit — `pnpm test:ops:unit`

`ResidentPhotoViewer`:
- fechado (`visible=false`) não renderiza a imagem;
- aberto usa `photoUrl`; `onError` da imagem cheia troca a fonte para `photoThumbUrl` (decisão 5);
- só thumb disponível → renderiza a thumb;
- sem nenhuma URL → não renderiza o modal;
- `onClose` dispara no botão de fechar e no toque no fundo.

`ResidentPhoto` (regressão da extração):
- comportamento da ficha inalterado — avatar sem foto mostra o ícone, avatar com foto abre o
  visualizador, `disabled` sem foto. Os testes atuais de `ResidentComponents.test.tsx` passam sem
  mudança de expectativa; se precisarem mudar, a extração está errada.

`CensusListItem`:
- toque na foto chama `onOpenPhoto` e **não** `onOpenDetails`;
- toque no nome chama `onOpenDetails` e **não** `onOpenPhoto`;
- toque em confirmar chama **só** `onConfirm`; toque em remover chama **só** `onRemove` — nenhum dos
  dois abre modal (é a regressão que protege a contagem);
- filho sem foto: alvo da foto desabilitado, alvo dos detalhes segue ativo;
- filho `pending` (`CENSUS_ADDED`): badge "Aguardando aprovação" preservado e detalhes abrem
  normalmente.

`ResidentDetailModal`:
- com `useResidentById` **carregando**, o bloco base (nome/status/entrada/foto) já aparece e **não**
  há `LoadingState` bloqueante;
- com `useResidentById` em **erro** (offline), nada de `ErrorState`: o bloco base segue na tela e o
  bloco extra some;
- com `data` presente, ministério/nascimento/telefone aparecem;
- `enabled` é `false` com o modal fechado (o hook não dispara);
- "Ver ficha completa" navega para `/residents/:id` (mock do `router`) e fecha o modal;
- nenhum campo de saúde ou CPF é renderizado.

`CensusPage`:
- abrir e fechar o modal de detalhes **não** altera `confirmedIds` nem o contador `x/y`;
- `renderItem` liga cada handler ao filho certo (abrir detalhes do 2º item traz o 2º filho).

### E2E offline — `apps/ops.fonte/e2e-web/` (Playwright)

No spec de fluxos de campo, com `context.setOffline(true)` após aquecer a lista da casa: abrir a
contagem, tocar num filho, e verificar que o modal aparece **com nome/status/entrada** e **sem**
mensagem de erro de rede. É o teste que prova a decisão 1 — Maestro não controla rede (CLAUDE.md).

### Maestro — `pnpm test:ops`

Atualizar/estender o fluxo da contagem: tocar na linha abre o modal, "Ver ficha completa" leva à
ficha, voltar mantém a contagem no mesmo estado (confirmações preservadas).

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste. Rodar
`pnpm test:ops:unit` com cobertura; **não reduzir** a cobertura de `features/census` e
`features/residents/components` do `ops.fonte`. Sem `skip`/`only`/`xfail` sem justificativa
explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Aquecer a ficha do filho no `prefetch.ts`** — é a [[177]]/[[175]], e fazer aqui recriaria o
  fan-out de ~40 requisições por casa que elas existem para eliminar.
- **Enriquecer `GET /houses/:id/residents`** (decisão 1): nenhuma mudança de backend nesta story.
- **Ações dentro do modal** — confirmar presença, remover, alta, evasão, transferência, alterar
  ministério (decisão 3).
- **Zoom/pan (pinch) na foto em tela cheia**: expandir é `resizeMode="contain"` em fundo preto, como
  já é na ficha. Ampliar por gesto é outra conversa (e outra dependência).
- Modal equivalente em outras listas do ops (ministérios, atividades, ocorrências) — se colar aqui,
  vira story própria para generalizar.
- Qualquer mudança no `app.fonte` ou no `adm.fonte`.
