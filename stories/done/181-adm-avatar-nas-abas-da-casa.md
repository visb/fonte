# Plan: adm.fonte — foto de perfil nas listas de filhos e servos do detalhe da casa

## Context

No detalhe da casa (`HouseDetailPage`), a aba **Filhos** (`ResidentsTab` → `HouseResidentRow`) lista
cada filho como nome + data de entrada + badge de status. **Sem foto.** A aba **Servos**
(`StaffTab`) faz o mesmo: nome + WhatsApp + botão de editar, também sem foto.

Quem opera a casa reconhece filho por rosto, não por nome escrito — e o resto do `adm.fonte` já
assumiu isso: `ResidentCard` (lista geral de filhos), `StaffCard` (lista geral de servos),
`ResidentDetailPage`, `StaffDetailPage`, `EligibleResidentRow` e `EnrollmentRow` (curso bíblico)
**todos** mostram avatar. As duas abas do detalhe da casa são o buraco restante.

Pedido do usuário: a lista de filhos da página de detalhes da casa precisa conter foto de perfil.

### O que o levantamento mostrou

**Filhos — nada de backend.** `ResidentsTab` consome `useInfiniteResidents({ houseId })` →
`GET /residents`, que roda `ResidentService.findAll` com `getManyAndCount()` sobre a entidade
`Resident` inteira. `photoUrl` e `photo_thumb_url` são colunas normais da entidade
(`resident.entity.ts:146-151`, sem `select: false`), então **já descem no payload**. `Resident` no
`@fonte/api-client` já declara `photoThumbUrl: string | null`. Falta só renderizar — e alargar o
`Pick<Resident, ...>` do `HouseResidentRowProps`, que hoje recorta `id | name | entryDate | status`.

**Servos — precisa de backend.** `GET /houses/:id/staff` → `HouseService.findStaffForHouse`
(`house.service.ts:243-251`) é uma query crua enxuta:

```sql
SELECT id, name, whatsapp FROM staff WHERE house_id = $1 AND deleted_at IS NULL ORDER BY name
```

Três colunas. A foto **não** vem. É uma coluna a mais no mesmo `SELECT` — sem JOIN novo, sem N+1,
sem migration (`staff.photo_url` já existe, `staff.entity.ts:89-90`).

**Bônus achado no caminho:** o `api-client` tipa essa rota como `Staff[]`
(`modules/houses.ts:36`), mas o backend devolve 3 campos. O tipo é uma mentira — hoje inofensiva
porque os três consumidores (`StaffTab`, `AddMinistryDialog`, `EditMinistryLeaderDialog`) só usam
`id`, `name` e `whatsapp`, mas é um convite a alguém ler `s.user.email` e tomar `undefined` em
produção.

**Duplicação de avatar:** o mesmo markup (`rounded-full border bg-muted flex items-center
justify-center shrink-0 overflow-hidden` + `<img className="w-full h-full object-cover">` +
fallback no ícone `User`) está copiado **6 vezes** em `adm.fonte`, em três tamanhos
(`w-9`/`w-10`/`w-12`), e não existe componente compartilhado. Adicionar mais duas cópias seria a
7ª e a 8ª.

### Decisões travadas (usuário)

1. **Extrair `PersonAvatar` compartilhado** em `components/shared/`, com prop de tamanho, e
   **migrar os 6 call sites existentes** além dos dois novos. Não é refactor oportunista solto: é o
   pré-requisito escolhido para não multiplicar a cópia.
2. **As duas abas entram**: Filhos **e** Servos do detalhe da casa.

### Decisões assumidas por default (rever se discordar)

3. **Tamanho `sm` (`w-9 h-9`) nas duas abas novas.** As linhas dessas abas são densas (`p-3`,
   `text-sm`), como as do curso bíblico que já usam `w-9`. Os call sites migrados **mantêm cada um
   o tamanho que já tem** — `md` (`w-10`) nos cards de lista, `lg` (`w-12`) nos headers de detalhe.
   A migração não muda pixel de tela nenhuma.
4. **Filho usa `photoThumbUrl ?? photoUrl`; servo usa `photoUrl`.** É exatamente o que
   `ResidentCard` e `StaffCard` já fazem — `staff` não tem coluna de thumb.
5. **`GET /houses/:id/staff` ganha só `photo_url`.** Nada de trocar a query crua por
   `Repository.find()` nem devolver a entidade `Staff` inteira: a rota é lida por `SERVANT` e
   despejar o registro completo do servo (e-mail, rank, `former_resident_id`) num dropdown é
   ampliação de superfície de dado pessoal sem pedido (LGPD art. 6 — minimização).
6. **Corrigir o tipo da rota** para um `HouseStaffSummary` explícito no `api-client`, em vez de
   `Staff[]`. Estreitar é seguro: os três consumidores usam só os campos que sobram, e o
   `tsc` prova isso no build.
7. **Avatar não é clicável nas abas novas.** A linha do filho inteira já abre o
   `HouseResidentDetailDialog`; a linha do servo tem seu próprio botão de editar. Avatar clicável
   criaria um segundo alvo dentro de um alvo.

---

## Desenho

### 1. `components/shared/PersonAvatar.tsx` (`adm.fonte`) — novo

```tsx
import { User } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { box: 'w-9 h-9', icon: 16 },
  md: { box: 'w-10 h-10', icon: 18 },
  lg: { box: 'w-12 h-12', icon: 22 },
} as const;

interface PersonAvatarProps {
  /** Caminho cru vindo da API (o helper resolve local vs. bucket). */
  url: string | null | undefined;
  /** Vira o `alt` da imagem. */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  onClick?: () => void;
}

export function PersonAvatar({ url, name, size = 'md', className, onClick }: PersonAvatarProps) {
  const src = api.photoUrl(url);
  const { box, icon } = SIZES[size];
  return (
    <div
      className={cn(box, 'rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden', className)}
      onClick={onClick}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <User size={icon} className="text-muted-foreground" />
      )}
    </div>
  );
}
```

- A resolução da URL fica **dentro** do componente (`api.photoUrl`), não no chamador — é o que os
  6 call sites já fazem individualmente, e centralizar tira a chance de alguém passar o caminho cru
  direto para o `src`.
- `className` e `onClick` existem por causa dos **headers de detalhe**, que hoje aplicam
  `cursor-pointer hover:opacity-80 transition-opacity` condicional e abrem o modal da foto cheia.
  Sem essas duas props a migração deles não fecha.

### 2. Migração dos 6 call sites existentes (`adm.fonte`)

| Arquivo | Hoje | Vira |
|---|---|---|
| `features/residents/components/ResidentCard.tsx` | `ResidentAvatar` local (`w-10`) | `<PersonAvatar size="md" url={resident.photoThumbUrl ?? resident.photoUrl} …>` |
| `features/staff/components/StaffCard.tsx` | `StaffAvatar` local (`w-10`) | `<PersonAvatar size="md" url={s.photoUrl} …>` |
| `features/residents/pages/ResidentDetailPage.tsx` | `<div>` inline (`w-12`) + modal | `<PersonAvatar size="lg" className={cn(…)} onClick={…}>` |
| `features/staff/pages/StaffDetailPage.tsx` | `<div>` inline (`w-12`) + modal | idem, `url={staff.photoUrl}` |
| `features/bible-courses/components/EligibleResidentRow.tsx` | `<div>` inline (`w-9`) | `<PersonAvatar size="sm">` |
| `features/bible-courses/components/EnrollmentRow.tsx` | `<div>` inline (`w-9`) | `<PersonAvatar size="sm">` |

As funções locais `ResidentAvatar` e `StaffAvatar` são **removidas** (ficariam mortas).

**Uma diferença de comportamento a decidir na implementação, não a esconder:** os dois headers de
detalhe hoje condicionam o `<img>` a `resident.photoUrl` / `staff.photoUrl`, enquanto o
`PersonAvatar` condiciona ao `url` resolvido que recebeu. Para o filho isso muda o caso
`photoThumbUrl` preenchida com `photoUrl` nula — hoje cai no ícone, com o componente mostra a
thumb. É o comportamento **certo** (a thumb é derivada da foto; o estado é inalcançável na prática),
mas o `onClick` do modal precisa continuar guardado pelo `photoUrl` **cheio**, senão o modal abre
sem imagem para mostrar. Manter a guarda do `onClick`/`cursor-pointer` em `photoUrl` como está.

### 3. Backend — uma coluna a mais (`services/api`)

`HouseService.findStaffForHouse`:

```sql
SELECT id, name, whatsapp, photo_url AS "photoUrl" FROM staff
WHERE house_id = $1 AND deleted_at IS NULL ORDER BY name
```

e o tipo de retorno declarado no método vira
`Array<{ id: string; name: string; whatsapp: string | null; photoUrl: string | null }>`.

Sem migration, sem entity nova, sem rota nova, **sem mudança de permissão** (`ADMIN`,
`COORDINATOR`, `SERVANT` seguem iguais).

### 4. Contrato (`packages/api-client`)

```ts
export interface HouseStaffSummary {
  id: string;
  name: string;
  whatsapp: string | null;
  photoUrl: string | null;
}
```

`houses.getStaff` passa de `http.get<Staff[]>` para `http.get<HouseStaffSummary[]>`.
`pnpm build:api-client` depois. Como o **response body** de `GET /houses/:id/staff` muda,
`fonte-api.postman_collection.json` é atualizado (CLAUDE.md: a coleção é a documentação viva).

### 5. `HouseResidentRow` (`adm.fonte`)

- Props: `Pick<Resident, 'id' | 'name' | 'entryDate' | 'status'>` passa a incluir
  `'photoUrl' | 'photoThumbUrl'`.
- `<PersonAvatar size="sm" url={resident.photoThumbUrl ?? resident.photoUrl} name={resident.name} />`
  antes do bloco de nome, dentro do `<button>` que já existe. O `flex items-center gap-3` do
  wrapper já acomoda; o `flex-1 min-w-0` + `truncate` do bloco de texto é preservado, senão nome
  longo estoura a linha.
- `onSelect`, badge de status e formatação de data ficam **inalterados**.

`ResidentsTab` não muda: já passa o `resident` inteiro.

### 6. `StaffTab` (`adm.fonte`)

- `<PersonAvatar size="sm" url={s.photoUrl} name={s.name} />` antes do nome; o nome passa a viver
  num flex ao lado do avatar (hoje o `<div>` da linha é `justify-between` com o nome solto à
  esquerda — vira `<div className="flex items-center gap-3 min-w-0">` envolvendo avatar + nome,
  com `truncate` no nome).
- WhatsApp e botão de editar ficam **inalterados** à direita.

`StaffTab` tem 39 linhas e continua abaixo de ~150 — sem decomposição a fazer. `AddMinistryDialog` e
`EditMinistryLeaderDialog` **não** são tocados (usam a mesma query, só leem `id`/`name`).

---

## Validação

### Backend — `pnpm test:api`

`house.service.spec.ts`:

- `findStaffForHouse` seleciona `photo_url AS "photoUrl"` (asserção no SQL, como os specs vizinhos
  já fazem para as demais colunas);
- propaga `photoUrl` **com** valor e **com `null`**;
- `id`, `name` e `whatsapp` continuam saindo iguais — regressão do payload;
- casa inexistente segue estourando `NotFoundException` (`assertHouseExists` intocado).

Sem migration ⇒ sem `pnpm migration:run:test`.

### Backend — `pnpm test:api:e2e`

`GET /houses/:id/staff` devolve `photoUrl` em cada servo (valor para o servo com foto no seed,
`null` para o sem foto). Permissões da rota **não mudam** — o teste de roles existente segue valendo
sem edição; se precisar mudar, algo saiu do escopo.

### Contratos

`pnpm build:api-client` e `pnpm build:types` verdes. O build do `adm.fonte` (`tsc`) é parte da prova
da decisão 6: se algum consumidor lia campo de `Staff` que o `HouseStaffSummary` não tem, quebra
aqui e é bug pré-existente encontrado, não regressão.
`fonte-api.postman_collection.json` com o campo novo no exemplo de resposta de `GET /houses/:id/staff`.

### `adm.fonte` — unit (Vitest/RTL), `pnpm test:adm:unit`

`PersonAvatar.test.tsx` (novo):

- com `url`, renderiza `<img>` com `alt` = `name` e `src` resolvido por `api.photoUrl`;
- com `url` `null` **e** com `undefined`, renderiza o fallback e **nenhuma** `<img>`;
- cada `size` aplica a classe de caixa esperada (`w-9`/`w-10`/`w-12`) e o default é `md`;
- `className` extra é **somada**, não substitui as classes base;
- `onClick` dispara ao clicar; sem `onClick`, clicar não estoura.

`HouseResidentRow.test.tsx` (estender o existente):

- com `photoThumbUrl`, renderiza `<img>` com `alt` do nome do filho;
- sem foto (`photoThumbUrl` e `photoUrl` nulos), renderiza o fallback e nenhuma `<img>`;
- com `photoThumbUrl` nula e `photoUrl` preenchida, cai na `photoUrl` (prova o `??`);
- clicar no **avatar** dispara `onSelect` com o id (o avatar está dentro do botão da linha — se
  alguém colocar `stopPropagation` ali, este teste pega);
- **regressão**: os 4 testes atuais (nome/data/status, data ausente, status desconhecido,
  `onSelect`) passam **sem mudança de expectativa**. Se algum precisar mudar, o layout novo quebrou
  comportamento.

`StaffTab.test.tsx` (estender o existente):

- servo com `photoUrl` renderiza `<img>` com `alt` do nome; sem foto, fallback;
- **regressão**: nome, WhatsApp mascarado, navegação do botão de editar, estados de loading e vazio
  passam sem mudança de expectativa.

Suítes dos call sites migrados — `ResidentCard.test.tsx`, `StaffCard.test.tsx`,
`EligibleResidentRow.test.tsx`, `EnrollmentRow.test.tsx`, `EligibleResidentsPanel.test.tsx` e o que
cobrir os headers de detalhe — **devem passar intocadas**. Elas já mockam
`@/lib/api` com `photoUrl` e já asseguram `getByAltText(...)`; é exatamente o que prova que a
migração não mudou comportamento. **Se alguma precisar ser editada, a migração regrediu** — a única
edição admitida é o mock de `@/lib/api` migrar de arquivo, nunca uma expectativa de render.

### `adm.fonte` — e2e (Playwright), `pnpm test:adm`

No spec do detalhe da casa: abrir uma casa com filhos e servos, conferir que a linha do filho na aba
**Filhos** e a linha do servo na aba **Servos** mostram o avatar (imagem quando há foto no seed,
fallback quando não), e que **clicar na linha do filho ainda abre** o
`HouseResidentDetailDialog` — o avatar novo não pode engolir o clique.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste. Rodar
`pnpm test:api:cov` e `pnpm test:adm:unit` com cobertura; **não reduzir** a cobertura de
`modules/house` (backend) nem de `features/houses`, `features/residents`, `features/staff`,
`features/bible-courses` e `components/shared` (adm.fonte). Sem `skip`/`only`/`xfail` sem
justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Upload / troca de foto** por essas abas — a foto continua sendo gerenciada na ficha do filho e
  do servo.
- **Lightbox / foto cheia** nas linhas das abas: só a thumb; a foto grande está na ficha, a um
  clique de distância pelo próprio dialog/link que já existe.
- **Thumbnail para `staff`**: servo não tem `photo_thumb_url` e esta story não cria a coluna nem o
  pipeline de recorte. Se a foto cheia pesar nas listas, é story própria.
- Avatar em qualquer outra tela ou app (`ops.fonte`, `app.fonte`, `portal.fonte`) — o `PersonAvatar`
  nasce em `adm.fonte`, não em `packages/`.
- Mudar `AddMinistryDialog` / `EditMinistryLeaderDialog` para mostrar foto nos dropdowns.
- Qualquer mudança nas ações das linhas (abrir dialog do filho, editar servo), nos filtros da aba
  Filhos ou nas permissões das rotas.
