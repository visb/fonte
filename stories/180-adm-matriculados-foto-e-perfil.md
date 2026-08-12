# Plan: adm.fonte — foto e acesso ao perfil na listagem de matriculados do curso

## Context

No detalhe da turma do curso bíblico (`BibleClassDetailPage`, aba **Matrículas**), cada matriculado
sai como uma linha de texto: nome, casa e status, mais os botões de concluir / desistir / reverter /
remover (`EnrollmentRow`). **Sem foto e sem caminho para a ficha do filho.**

O contraste está na mesma tela: o painel de elegíveis logo acima (`EligibleResidentRow`, stories
125/127) já mostra **avatar** e já leva à **ficha do filho**. Quem opera a turma vê o filho com foto
enquanto decide matricular e perde a foto no instante em que ele é matriculado — que é justamente
quando o coordenador precisa reconhecer quem é quem para lançar nota, marcar desistência ou remover
a matrícula errada.

Pedido do backlog: mostrar a **foto de perfil** e um **botão para ver o perfil** na listagem dos
matriculados.

### O que o levantamento mostrou

`GET /bible-courses/classes/:id` (`BibleCourseService.findClassById`) monta as matrículas com uma
query crua que **já faz** `JOIN residents r` e **já devolve** `residentId`:

```sql
SELECT e.id, e.resident_id AS "residentId", r.name AS "residentName",
       r.house_id AS "residentHouseId", rh.name AS "residentHouseName",
       e.status, e.enrolled_at, e.completed_at, e.notes
FROM bible_course_enrollments e
JOIN residents r ON r.id = e.resident_id AND r.deleted_at IS NULL
```

- O **link para a ficha** é, portanto, frontend puro: `residentId` já está no payload.
- A **foto** falta: `photo_thumb_url` não é selecionada. É **uma coluna a mais no mesmo JOIN** — não
  há query nova, nem N+1, nem entidade nova.

### Decisões travadas (usuário)

1. **O perfil abre na MESMA aba**, com `<Link to={`/residents/${id}`}>` do react-router — o padrão
   de `BibleClassCard` no mesmo módulo. **Não** usar `target="_blank"` nem o ícone `ExternalLink`:
   o `EligibleResidentRow` vizinho abre em nova aba, e aqui o comportamento **diverge de propósito**,
   por decisão explícita do usuário.

### Decisões assumidas por default (rever se discordar)

2. **Só a aba Matrículas.** A aba **Notas** (`BibleGradesTable`) também lista os matriculados, mas é
   uma tabela densa com uma coluna por módulo e rolagem horizontal; avatar na primeira coluna rouba
   largura de onde a informação está. O payload de notas (`BibleClassGrades`) é outra query e ficaria
   de fora de qualquer forma.
3. **Botão dedicado "Ver perfil"** no grupo de ações, com ícone (`Eye`), em vez de transformar
   nome/avatar em área clicável. Foi o pedido literal do backlog ("botão para ver perfil"), e mantém
   **um alvo por ação** numa linha que já tem quatro botões — nome clicável somado a botão seria
   dois caminhos para o mesmo lugar.
4. **Avatar idêntico ao do `EligibleResidentRow`**: `w-9 h-9`, circular, `border bg-muted`,
   `object-cover`, com fallback no ícone `User` quando não há foto. Mesma tela, mesmo objeto, mesma
   aparência — e a URL resolvida pelo mesmo `api.photoUrl(...)` (helper do `@fonte/api-client`), que
   é quem sabe montar caminho local vs. bucket.

---

## Desenho

### 1. Backend — uma coluna a mais (`services/api`)

Em `BibleCourseService.findClassById`, acrescentar à query das matrículas:

```sql
r.photo_thumb_url AS "residentPhotoThumbUrl"
```

e o campo no tipo de retorno declarado no método (`residentPhotoThumbUrl: string | null`).

**Só a thumb.** A foto cheia (`photo_url`) não entra: a linha renderiza 36px, e trafegar o original
por matrícula é peso sem uso — se um dia a linha precisar da foto grande, ela está na ficha, a um
clique de distância pelo próprio botão desta story.

Nada mais no backend: sem migration (colunas já existem em `residents`), sem entity nova, sem rota
nova, sem mudança de permissão. A outra query de enrollments do service (`SELECT e.id, r.name` usada
na notificação de turma) **não** é tocada — notificação não mostra foto.

### 2. Contrato (`packages/api-client`)

`BibleCourseEnrollment` ganha:

```ts
residentPhotoThumbUrl: string | null;
```

Campo **não-opcional e nullable**, como `residentHouseName` ao lado: o backend sempre devolve a
chave, e o valor é `null` para filho sem foto. `pnpm build:api-client` depois.

Como o **response body** de `GET /bible-courses/classes/:id` muda, `fonte-api.postman_collection.json`
é atualizado (regra do CLAUDE.md: a coleção é a documentação viva da API).

### 3. `EnrollmentRow` (`adm.fonte`)

```tsx
const src = api.photoUrl(enrollment.residentPhotoThumbUrl);
```

- **Avatar** antes do nome, no bloco de conteúdo: `<img>` quando há `src`, ícone `User` quando não.
  Markup copiado do `EligibleResidentRow` (decisão 4). O bloco de nome/casa passa a viver ao lado do
  avatar, num flex — o `min-w-0`/`truncate` que já existe é preservado, senão nome longo estoura a
  linha.
- **Botão "Ver perfil"** no grupo de ações, **antes** dos botões de status:

```tsx
<Button variant="ghost" size="icon" asChild title={`Ver perfil de ${enrollment.residentName}`}>
  <Link to={`/residents/${enrollment.residentId}`} aria-label={`Ver perfil de ${enrollment.residentName}`}>
    <Eye size={15} />
  </Link>
</Button>
```

  `asChild` para o `Button` emprestar o estilo ao `Link` sem aninhar `<a>` dentro de `<button>`
  (HTML inválido, e o teclado se perde). Rota `/residents/:id`, mesma aba (decisão 1).
- Os quatro botões existentes (concluir, desistir, reverter, remover) e o badge de status ficam
  **inalterados** — inclusive o `disabled={busy}`, que não vale para o link: navegar não depende de
  mutation em voo.

O componente segue abaixo de ~150 linhas; não há decomposição a fazer.

---

## Validação

### Backend — `pnpm test:api`

`bible-course.service.spec.ts` (já mocka `manager.query` para as matrículas):

- `findClassById` propaga `residentPhotoThumbUrl` **com** valor e **com `null`**;
- a query de matrículas seleciona `photo_thumb_url` (asserção no SQL, como os specs vizinhos já
  fazem para as demais colunas);
- os campos que já existiam continuam saindo iguais — regressão do payload.

Sem migration ⇒ sem `pnpm migration:run:test`.

### Backend — `pnpm test:api:e2e`

`GET /bible-courses/classes/:id` devolve `residentPhotoThumbUrl` em cada matrícula (com valor para o
filho com foto no seed e `null` para o sem foto). Permissões da rota **não mudam** — o teste existente
de roles segue valendo sem edição; se precisar mudar, algo saiu do escopo.

### Contratos

`pnpm build:api-client` verde. `fonte-api.postman_collection.json` com o campo novo no exemplo de
resposta do detalhe da turma.

### `adm.fonte` — unit (Vitest/RTL), `pnpm test:adm:unit`

`EnrollmentRow.test.tsx` (estender o arquivo existente):

- com `residentPhotoThumbUrl`, renderiza `<img>` com `alt` do nome do filho;
- sem foto (`null`), renderiza o fallback e **nenhuma** `<img>`;
- "Ver perfil" tem `href="/residents/<residentId>"`;
- "Ver perfil" **não** tem `target="_blank"` — é a asserção que trava a decisão 1 contra alguém
  "padronizar" com o `EligibleResidentRow` depois;
- o link **não** dispara `updateMutation` nem `removeMutation` (nenhum clique vaza para as ações da
  linha);
- **regressão**: os cinco testes atuais (nome/casa/status, concluir, desistir, reverter, remover,
  casa ausente) passam sem mudança de expectativa. Se algum precisar mudar, o layout novo quebrou
  comportamento.

`EligibleResidentsPanel` / `EligibleResidentRow`: nenhuma alteração esperada — seus testes atuais
devem seguir verdes intocados.

### `adm.fonte` — e2e (Playwright), `pnpm test:adm`

No spec do curso bíblico: abrir o detalhe de uma turma com matriculado, conferir que a linha mostra o
avatar, clicar em "Ver perfil" e verificar que a navegação cai em `/residents/:id` **na mesma aba**
(sem `page.waitForEvent('popup')` — a ausência de nova aba é parte do que se prova).

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste. Rodar
`pnpm test:api:cov` e `pnpm test:adm:unit` com cobertura; **não reduzir** a cobertura de
`bible-course` (backend) nem de `features/bible-courses` (adm.fonte). Sem `skip`/`only`/`xfail` sem
justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Foto na aba Notas** (`BibleGradesTable` / `BibleGradeRow`) — decisão 2; é outro payload
  (`BibleClassGrades`) e outra query.
- **Foto cheia / lightbox** na linha de matrícula: só a thumb, e a foto grande está na ficha.
- Mudar o comportamento do `EligibleResidentRow` (que segue abrindo em nova aba) ou uniformizar os
  dois — a divergência é decisão travada, não inconsistência a corrigir.
- Qualquer alteração nas ações da matrícula (concluir, desistir, reverter, remover), no badge de
  status ou nas permissões da rota.
- Foto de matriculado em qualquer outra tela ou app (`ops.fonte`, `app.fonte`).
