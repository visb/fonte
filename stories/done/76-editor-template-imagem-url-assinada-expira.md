# Plan: Editor de templates — imagem some quando a URL assinada expira

## Context

No `adm.fonte`, no editor de templates de documentos (`TemplateEditor`, `features/settings/`), as
imagens inseridas (logo/cabeçalho/rodapé) **quebram depois de algumas horas**: viram imagem com link
quebrado. Causa raiz mapeada no código:

1. `POST /document-templates/images` → `DocumentTemplateService.uploadImage` devolve a URL
   **canônica** (não assinada) do objeto no S3. Mas o **`StorageUrlInterceptor` global**
   (`app.module.ts`) vê a resposta `{ url }`, a string **é** uma URL S3 (`isS3Url` true), e a
   **assina** — então o front recebe uma **URL assinada com validade de 24h**
   (`SIGN_EXPIRES_IN = 86400` em `storage.service.ts`).
2. No front, `editor.getHTML()` serializa o `<img src="…url-assinada…">` para dentro de `content`,
   que é **persistido** no banco via `PUT /document-templates/:id`.
3. Passadas ~24h, a assinatura expira → S3 responde 403 → imagem quebrada, **no preview do editor e
   no PDF gerado** (`renderForResident` → puppeteer baixando a `<img src>`).
4. O interceptor assina uma string **só quando a string inteira é uma URL S3**. URLs embutidas dentro
   do HTML de `content` **nunca são re-assinadas**, então nada reconstrói o link.

O erro de design é **persistir a URL assinada** (efêmera) em vez de uma referência estável.

### Decisões travadas (respostas do usuário)

- **Bucket continua privado; assinar na hora de servir.** Imagens de template são logo/cabeçalho —
  mas mantemos a postura atual (privado + assinatura), sem expor prefixo público. A persistência
  guarda a **URL canônica** (sem query de assinatura); a assinatura é aplicada **no momento de
  servir**: (a) ao retornar o template para o editor (GET) e (b) ao renderizar o HTML do PDF.
- **Reparar templates já salvos via normalização.** A URL assinada ainda contém o **caminho do
  objeto** (`…/documents/doc-xxxx.png?X-Amz-…`). Basta **remover a query string** para recuperar a
  canônica. Logo: ao salvar (`create`/`update`), normalizar todo `<img src>` S3 para a forma
  canônica antes de persistir **e** uma migration one-time que normaliza o `content` dos templates
  existentes. No serve, re-assina. Isso **auto-cura** os templates já quebrados (a próxima leitura já
  vem assinada de novo).

## Desenho

### Backend — `services/api/src/modules/storage/storage.service.ts`

Dois helpers puros, testáveis, operando sobre HTML (substituição dos `src` de `<img>` que apontam
para o bucket — usar parsing/regex restrito ao atributo `src` de tags `<img>`, não tocar outros
atributos):

- `canonicalizeS3Url(url)`: se `isS3Url(urlSemQuery)`, devolve a URL **sem** query string
  (`?X-Amz-…`); senão devolve inalterada. Reaproveita `publicBaseUrl`.
- `stripContentSignatures(html)`: troca cada `<img src>` que seja URL S3 assinada pela sua forma
  **canônica** (via `canonicalizeS3Url`). Usado na escrita.
- `signContentUrls(html)`: troca cada `<img src>` que seja URL S3 **canônica** pela sua forma
  **assinada** (via `signUrl`, já com cache de 12h existente). `async` (assina via `getSignedUrl`).
  Usado na leitura/render. No-op fora do modo S3 (`isS3Mode` false) — devolve o HTML inalterado.

> Importante: a assinatura de `content` **não** pode depender do `StorageUrlInterceptor` global — ele
> não entra em URLs embutidas em HTML. A assinatura do HTML é responsabilidade explícita do
> `DocumentTemplateService` (abaixo).

### Backend — `services/api/src/modules/document-template/document-template.service.ts`

- **Escrita (`create` e `update`)**: antes de persistir, passar `content` por
  `storage.stripContentSignatures(content)` → grava **sempre canônico**. (Idempotente: conteúdo já
  canônico passa intacto.)
- **Leitura (`findOne` e `findAll`)**: ao devolver o(s) template(s), aplicar
  `await storage.signContentUrls(content)` no `content` antes de retornar — assim o editor recebe
  `<img src>` assinados e válidos por ≥12h (cache). `findAdmissionTemplates` idem se o `content` for
  exposto a algum render.
- **PDF (`renderForResident`)**: aplicar `signContentUrls` no `content` **antes** do `applyVariables`
  /`wrapPage`, garantindo que o puppeteer baixe os `<img>` com URL válida.
- O endpoint `uploadImage` **continua** devolvendo `{ url }`; o `StorageUrlInterceptor` global segue
  assinando essa string (URL S3 inteira) → o front recebe uma URL assinada **só para preview imediato
  na sessão**. Ao salvar, a normalização do backend a reduz para canônica. Não muda o contrato.

> Nota: como `signContentUrls` produz HTML com URLs assinadas e o interceptor global roda **depois**,
> verificar que o interceptor **não** re-processa nem corrompe o `content` (ele só assina strings que
> são URL S3 inteira; `content` é HTML, então `isS3Url(content)` é false → passa intacto). Cobrir no
> teste.

### Backend — migration one-time

- Nova migration (`services/api/src/database/migrations/`) que percorre `document_template` e, para
  cada `content`, **remove a query string** dos `<img src>` S3 (mesma lógica de
  `stripContentSignatures`, em SQL ou via `queryRunner` lendo/reescrevendo as linhas). Idempotente.
  Não editar migrations existentes. Como a lógica de normalização é só remoção de `?...` do src S3,
  pode ser feita em JS dentro da migration (carregar linhas, reescrever, salvar).

### Frontend — `apps/adm.fonte` (`TemplateEditor.tsx`)

- Comportamento atual de `uploadFile` **permanece**: usa a URL devolvida (assinada, para preview
  imediato) em `setImage({ src })`. Não precisa mudar — o backend normaliza no save e re-assina no
  load. (Opcional, se trivial: nada a fazer aqui; a correção é backend.)
- Verificar que, ao reabrir o template (refetch após save / troca de template), o editor recebe o
  `content` já com URLs assinadas frescas (vem do GET) e a imagem aparece.

### Contratos

- Sem mudança de tipo/contrato (`{ url }` no upload; `content: string` no template). Sem
  `build:types`/`build:api-client` necessários, salvo ajuste de comentário. Postman: sem novo
  endpoint; se algum exemplo de response de template tiver `content` com URL assinada, sem ação
  obrigatória (é runtime).

## Validação

### Testes — backend (`pnpm test:api`)

`storage.service.spec.ts` (helpers novos):
- `canonicalizeS3Url`: URL S3 assinada → sem query; URL S3 já canônica → inalterada; URL não-S3
  (local `/uploads/...`, externa `https://outro`) → inalterada; string sem `publicBaseUrl` (modo não
  S3) → inalterada.
- `stripContentSignatures`: HTML com 1 e com N `<img>` S3 assinados → todos viram canônicos; `<img>`
  não-S3 preservado; `<img>` sem src / outros atributos (`<a href=…s3…>`) **não** tocados;
  idempotência (canônico passa intacto); HTML sem imagem → inalterado.
- `signContentUrls`: HTML com `<img>` S3 canônico → src assinado (`?X-Amz-…`); fora do modo S3 →
  inalterado; `<img>` não-S3 preservado; reaproveita cache de `signUrl` (não estoura validade).

`document-template.service.spec.ts`:
- `create`/`update` chamam `stripContentSignatures` → `content` persistido é canônico mesmo recebendo
  HTML com URL assinada.
- `findOne`/`findAll` devolvem `content` com `<img>` assinados (mockar `StorageService`).
- `renderForResident` injeta URLs assinadas no HTML passado ao puppeteer (verificar a string antes do
  `page.setContent`, sem subir browser de verdade — extrair/mockar o ponto de render).

E2E (`pnpm test:api:e2e`) — fluxo HTTP do `document-template`:
- `POST /document-templates/images` continua devolvendo `{ url }` (assinada em modo S3 / canônica em
  modo não-S3, conforme o setup de teste).
- `PUT` com `content` contendo `<img>` com URL assinada → reler via `GET` e confirmar que o
  `content` volta com `<img>` (assinado em S3; em modo não-S3 do teste, a URL passa íntegra e o caso
  prova a normalização: a query foi removida na escrita). Cobrir o caminho de **permissão** já
  existente (ADMIN/COORDINATOR) sem regressão.

Migration:
- Teste/checagem da migration sobre uma linha com `content` contendo `<img>` assinado → vira
  canônico; idempotente ao rodar de novo. (Se o repo não testa migrations isoladamente, validar via
  `document-template.service.spec` reusando o mesmo helper, e rodar a migration localmente.)

### Casos a cobrir (enumeração)

- Caminho feliz: upload → preview → save → reabrir após >24h (simulado) → imagem assinada de novo.
- Múltiplas imagens no mesmo template.
- Template **sem** imagem (regressão: nada quebra).
- Imagem local (`/uploads/...`, modo não-S3) — não é tocada.
- URL não-S3 externa embutida — preservada.
- `<a href>` apontando para S3 — **não** assinado/normalizado (só `<img src>` no escopo).
- Idempotência: salvar duas vezes não acumula/corrompe.
- Template antigo já quebrado: após migration, GET volta com URL válida.

### Gate de cobertura (trava a story)

Todo caminho novo ou alterado tem teste correspondente — nenhum código novo entra sem teste. Rodar
`pnpm test:api:cov`; **não reduzir** a cobertura dos módulos `storage` e `document-template`. Sem
`skip`/`only`/`xfail` sem justificativa no código (CLAUDE.md). Se tocar fluxo do editor no front,
rodar o runner de cobertura do `adm.fonte` dos arquivos afetados.

## Fora de escopo

- Mudar o bucket para público / servir imagens de template sem assinatura (decisão: manter privado).
- Re-arquitetar o `StorageUrlInterceptor` para parsear HTML genérico — a assinatura de `content` é
  explícita no service, restrita a `<img src>`.
- Assinar URLs embutidas em **outros** campos HTML de outros módulos (só `document_template.content`
  nesta story).
- Tratar/recomprimir/redimensionar imagens (story 22 já fixou que não há "tratamento").
- Trocar a validade de 24h da assinatura ou o TTL de cache de 12h.
