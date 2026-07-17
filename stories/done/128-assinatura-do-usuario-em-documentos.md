# Plan: Assinatura do usuário logado nos documentos gerados

> **Status: PLANEJAMENTO.** Implementar só após aprovação do usuário.

## Context

Os documentos gerados a partir dos templates (`{{name}}`, `{{cpf}}`, …) saem hoje **sem assinatura
de quem os emitiu** — o coordenador imprime e assina à mão, uma folha por vez. Esta story permite
que cada usuário **configure a própria assinatura uma vez**, no perfil, e que o template a insira
automaticamente via variável.

### Estado atual (o que já existe e vai ser reusado)

- **Substituição de variáveis no backend:** `DocumentTemplateService.applyVariables()`
  (`document-template.service.ts:180`) monta um `Record<string,string>` e faz `replace` de
  `{{chave}}`. Alimenta `renderForResident()` (HTML) e `generatePdf()` (puppeteer), expostos em
  `GET /residents/:id/documents/:templateId/render` e `.../pdf` (`resident.controller.ts:506-532`).
  **Nenhum dos dois conhece o usuário logado hoje** — é o que muda.
- **Lista de variáveis do editor:** `VARIABLES` em `TemplateEditor.tsx:413` (chave em inglês, label
  em português).
- **Gate antes de gerar:** `AttachmentsTab.handleGenerateRequest` (`:262`) já roda
  `extractTemplateVars(template.content)` e, se faltar dado, abre `MissingFieldsDialog` em vez de
  gerar. **O modal de assinatura entra exatamente nesse ponto de decisão.**
- **Perfil do usuário:** `/profile` → `ProfilePage` (`features/auth/pages/`) já edita o staff logado
  via `useStaffMe`/`useUpdateStaffMe`, incluindo upload de foto (`POST /staff/me/photo`, multipart
  com `memoryStorage`). A assinatura segue esse mesmo caminho.
- **URL de imagem no bucket:** a story [[76]] fixou a regra — **persistir a URL canônica** (não
  assinada) e **assinar na leitura** (`storageService.signUrl` / `signContentUrls`). A assinatura
  obedece isso, senão o `<img>` quebra no PDF depois de 24h.

### Decisões travadas

1. **A assinatura é uma imagem desenhada na tela.** O usuário desenha com mouse/dedo num canvas; o
   traço vira PNG **com fundo transparente** (precisa imprimir por cima da linha). Desenhar resolve
   sem depender de scanner e funciona no notebook e no tablet.
2. **Biblioteca `react-signature-canvas`** (wrapper do `signature_pad`): trata pointer/touch e
   suavização de traço — hand-roll de canvas erraria em tablet. Dependência nova em `adm.fonte`,
   assumida conscientemente.
3. **Layout: assinatura acima da linha, identificação abaixo.** A linha é literalmente **25 `_`**,
   como pedido. Bloco renderizado:
   ```
           ~imagem da assinatura~
   _________________________
   João Silva
   Coordenador
   ```
4. **A assinatura mora no `Staff`** (`staff.signature_url`), não no `User`. `User` não tem nome — o
   nome impresso sai de `staff.name` — e as roles que geram documento (`ADMIN`, `COORDINATOR`,
   `SERVANT`) são exclusivas de Staff. O perfil (`/profile`) já é a ficha do staff.
5. **Variável `{{signature}}`** — chave em inglês como todas as outras, label "Assinatura" no editor.
6. **Sem assinatura configurada → modal configura e segue.** Ao pedir o documento, se o template usa
   `{{signature}}` e o staff não tem assinatura, abre o modal; ao salvar, **a geração continua
   automaticamente**. Fechar o modal **cancela a geração** — não existe documento gerado com
   assinatura vazia (só a linha) por esse caminho.
7. **Persistir URL canônica, assinar na leitura** (regra da [[76]]). Como `applyVariables` é síncrona
   e roda **depois** do `findOne` que já assinou o conteúdo do template, a URL assinada da assinatura
   tem que ser resolvida **antes** e passada pronta para dentro dela.
8. **Redesenhar substitui.** Não há "excluir assinatura" — configurar de novo sobrescreve, e o
   arquivo antigo é apagado do bucket (mesmo padrão da foto de perfil).

## Desenho

### Backend (`services/api`)

**Migration** nova em `src/database/migrations/` (`<timestamp>-StaffSignature.ts`):
`ALTER TABLE staff ADD COLUMN signature_url varchar NULL`. Entity `Staff` ganha `signatureUrl`.

**`StaffController` / `StaffService`** — espelhando `POST /staff/me/photo`:

- `POST /staff/me/signature` (multipart `file`, `memoryStorage`, roles de staff): valida
  **`image/png`** (decisão 1 exige transparência) e tamanho máximo; sobe para a pasta `signatures/`
  do bucket; apaga o arquivo anterior (decisão 8); grava a **URL canônica** em `staff.signature_url`.
- `GET /staff/me` passa a devolver `signatureUrl` (assinada na leitura, como as demais imagens).

**`DocumentTemplateService`:**

- `DocumentTemplateModule` registra `Staff` no `TypeOrmModule.forFeature([...])` — mesmo precedente
  do `Relative`, que já é lido por este módulo.
- `renderForResident(templateId, resident, signerUserId?)` e
  `generatePdf(templateId, resident, signerUserId?)` passam a receber quem está gerando; resolvem o
  staff por `user_id` e **pré-resolvem a URL assinada** (decisão 7) antes de chamar `applyVariables`.
- `applyVariables(content, resident, responsible, signer?)` ganha a chave `signature`:
  - **com assinatura:** `<img>` (URL assinada) + linha de 25 `_` + `staff.name` + label PT da role
    (`ADMIN` → "Administrador", `COORDINATOR` → "Coordenador", `SERVANT` → "Servo");
  - **sem staff/sem assinatura:** só a linha de 25 `_` + nome, quando houver — o documento nunca sai
    com `{{signature}}` cru no papel.
  - CSS do bloco vai junto do HTML já usado por `wrapPage`, com altura fixa para a imagem não
    empurrar a paginação do A4 (convenção da [[24]]).

**`ResidentController`** (`:506` e `:519`): ambos os endpoints ganham `@CurrentUser()` e repassam o
`userId`. Sem regra de negócio no controller — só o repasse.

### Contratos

- `packages/types` / `api-client`: `Staff.signatureUrl?: string | null`;
  `staff.uploadMySignature(file: Blob)`.
- **Postman**: adicionar `POST /staff/me/signature` e refletir `signatureUrl` no response de
  `GET /staff/me`.

### Frontend (`adm.fonte`)

**`SignatureDialog`** (`features/auth/components/`, autossuficiente — busca/salva por hooks
próprios): canvas de desenho (`react-signature-canvas`), botões "Limpar" e "Salvar", export
`toBlob('image/png')` com fundo transparente. Bloqueia salvar com canvas vazio. Props:
`{ open, onClose, onSaved? }` — `onSaved` é o que destrava a geração (decisão 6).

**Perfil** (`ProfilePage`): seção "Assinatura" mostrando a assinatura atual (ou vazio) e botão
"Configurar assinatura" / "Redesenhar" → abre o `SignatureDialog`. Extrair como
`SignatureSection` para não estourar o limite de ~150 linhas da page.

**Gate na geração** (`AttachmentsTab`):

- `handleGenerateRequest` passa a checar também a assinatura: se
  `extractTemplateVars(template.content)` inclui `signature` **e** `useStaffMe().signatureUrl` é
  vazio → abre `SignatureDialog` com `onSaved: () => downloadPdf(template)` (decisão 6); fechar sem
  salvar não gera nada.
- **`ALWAYS_AVAILABLE` (`AttachmentsTab.tsx:75`) precisa incluir `signature`** — senão
  `findMissingFields` trata a assinatura como campo faltante do **filho** e o `MissingFieldsDialog`
  dispara errado. É o erro silencioso mais provável desta story.

**Editor** (`TemplateEditor.tsx:413`): entrada nova em `VARIABLES` —
`{ key: '{{signature}}', label: 'Assinatura', description: 'Assinatura do usuário que gerar o documento' }`.

## Validação

- **`pnpm test:api`** (unit):
  - `StaffService`: upload grava URL **canônica** (não assinada) em `signature_url`; substituir
    apaga o arquivo anterior; rejeita mimetype != `image/png`; rejeita acima do limite de tamanho.
  - `DocumentTemplateService.applyVariables`: com signer + assinatura → HTML tem `<img>`, **linha com
    exatamente 25 `_`**, nome e label PT da role; sem assinatura → linha + nome, **sem `<img>`**; sem
    signer → não deixa `{{signature}}` cru; template **sem** `{{signature}}` não ganha bloco nenhum;
    as demais variáveis seguem substituídas.
  - `renderForResident`: URL da assinatura sai **assinada** (decisão 7) — regressão da [[76]].
- **`pnpm test:api:e2e`** (`test/` de staff e de documentos):
  - `POST /staff/me/signature` grava e `GET /staff/me` devolve `signatureUrl`; **401** sem token;
    **400** para arquivo não-PNG;
  - `GET /residents/:id/documents/:templateId/render` com template que usa `{{signature}}` traz a
    assinatura **do usuário do token** (dois usuários diferentes → assinaturas diferentes).
- **`pnpm test:adm:unit`**:
  - `SignatureDialog`: salvar com canvas vazio fica bloqueado; "Limpar" zera; salvar chama o upload
    com um `Blob` PNG e dispara `onSaved`.
  - `AttachmentsTab`: template com `{{signature}}` + staff **sem** assinatura → abre o
    `SignatureDialog` e **não** gera; salvar no modal → gera; fechar → **não** gera; template com
    `{{signature}}` + staff **com** assinatura → gera direto, sem modal; **`signature` não aparece no
    `MissingFieldsDialog`** (regressão do `ALWAYS_AVAILABLE`).
  - `ProfilePage`/`SignatureSection`: mostra assinatura quando existe; botão abre o dialog.
- **`pnpm test:adm`** (Playwright): perfil → desenhar assinatura → salvar → gerar documento com
  `{{signature}}` → PDF baixado sem passar pelo modal.
- **`pnpm build:types && pnpm build:api-client`** (contratos) e **`pnpm --filter api
  migration:run:test`** (migration nova aplica limpa).

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm test:api:cov` + `pnpm test:adm:unit:cov`; **não
reduzir** a cobertura dos módulos `staff` e `document-template` nem de `features/auth` e
`features/residents`. Sem `skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md).

## Fora de escopo

- **Assinatura no `ops.fonte`/`app.fonte`** — o perfil desses apps não ganha a configuração; quem
  gera documento é o adm.
- Assinatura de **familiar ou do próprio filho** no documento (só o usuário logado, que é staff).
- **Validade jurídica / assinatura digital certificada** (ICP-Brasil, e-CPF, hash, carimbo de tempo)
  — isto é imagem de assinatura em documento, não assinatura eletrônica avançada.
- Múltiplas assinaturas no mesmo documento (ex: `{{signature2}}`, testemunhas) ou escolher **outro**
  signatário que não o usuário logado.
- Excluir a assinatura (decisão 8 — redesenhar substitui).
- Upload de imagem da assinatura escaneada — decidido desenhar na tela.
- Revisar a base legal LGPD do armazenamento da assinatura (`docs/lgpd/`) — vale conferir depois se o
  inventário precisa registrar esse dado novo.
