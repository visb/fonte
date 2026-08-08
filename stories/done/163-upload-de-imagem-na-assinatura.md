# Plan: enviar imagem como assinatura (upload) na configuração da assinatura do perfil

## Context

Hoje a assinatura do usuário (`adm.fonte` → Perfil → seção "Assinatura", criada pela
[[128-assinatura-do-usuario-em-documentos]] e completada pela
[[138-redefinir-assinatura-perfil]]) só pode ser **desenhada** com o mouse/dedo num
`react-signature-canvas`. Desenhar com mouse produz um traço que não parece a assinatura real de
quem assina — quem já tem a assinatura digitalizada (scan) ou fotografada no papel não tem como
usá-la.

Estado atual investigado:

- **Backend:** `POST /staff/me/signature` (`staff.controller.ts:77-87`) já é um upload multipart
  comum: `FileInterceptor('file', photoOptions)`, exige `mimetype === 'image/png'` (decisão 1 da
  story 128 — o PNG é o único que garante fundo transparente) e `size <= 5 MB`.
  `StaffService.uploadSignature` apaga o arquivo anterior e grava a URL canônica.
  **Nada muda no backend.**
- **api-client:** `staff.uploadMySignature(formData)` já existe e recebe `FormData`. **Nada muda.**
- **Frontend:** `SignatureDialog.tsx` (107 linhas) monta o pad, valida "não está vazio" e faz
  `pad.getCanvas().toBlob(..., 'image/png')` → `useUploadMySignature(blob)`.
  `SignatureSection.tsx` abre o dialog. `components/ui/tabs.tsx` (Radix) já existe no app.

Story **frontend-only** em `apps/adm.fonte`.

### Decisões travadas (refinadas nesta sessão)

1. **Aceita PNG e JPG/JPEG**, e o **cliente converte tudo para PNG** antes de enviar. O contrato do
   backend (só PNG) fica intacto — a conversão é responsabilidade da tela que produz o arquivo,
   exatamente como já acontece com o pad de desenho. Aceitar JPG é o que destrava o caso principal:
   foto da assinatura feita no celular.
2. **Remoção de fundo no cliente, ligada por padrão.** Foto/scan de assinatura no papel vem com
   fundo branco opaco; colada no documento, o retângulo branco cobre a linha de assinatura
   (`.doc-signature-line`, os 25 underscores). Sem remoção, o upload entrega um resultado pior que o
   desenho. A remoção é por **luminância**: pixel claro vira transparente.
3. **Remoção com faixa de transição (feather), não corte binário.** Limiar `t` (default **230**,
   ajustável): luminância `>= t` → `alpha = 0`; `<= t - 50` → alpha original; entre os dois → alpha
   proporcional. Corte binário serrilha a borda do traço e o resultado impresso fica sujo.
4. **Controles expostos ao usuário:** checkbox "Remover fundo claro" (ligado por padrão) e um slider
   de limiar (**180–250**, default 230), com **preview ao vivo sobre fundo xadrez** para a
   transparência ficar visível. A remoção automática erra em assinatura a lápis ou papel amarelado —
   sem controle, o usuário fica sem saída. O slider só aparece com o checkbox ligado.
5. **Redimensionamento antes de enviar:** maior lado limitado a **1200 px** (mantendo proporção).
   Foto de celular tem 3–12 MB e estouraria o limite de 5 MB do backend; 1200 px é folgado para uma
   imagem impressa a 64 px de altura (`.doc-signature-img`).
6. **Validação no cliente antes de processar:** tipo em `image/png|image/jpeg` e arquivo de entrada
   `<= 10 MB` (a saída convertida cabe nos 5 MB do backend por causa da decisão 5). Erro de tipo/
   tamanho aparece no dialog, sem chamar a API.
7. **Abas dentro do `SignatureDialog`**, não um segundo botão na `SignatureSection`: "Desenhar" |
   "Enviar imagem". Ponto de entrada continua um só ("Configurar assinatura"/"Redesenhar"), e a
   seção não vira uma fileira de botões.
8. **Aba "Desenhar" continua sendo a inicial** — é o fluxo que já existe e o que a maioria usa.
   Trocar de aba **não apaga** o estado da outra (traço e imagem ficam em memória enquanto o dialog
   estiver aberto); **o que é salvo é o conteúdo da aba ativa**. Fechar o dialog zera tudo.
9. **Salvar/Limpar operam na aba ativa.** Na aba de upload, "Salvar" fica desabilitado sem arquivo
   escolhido e "Limpar" descarta o arquivo, voltando à dropzone vazia.
10. **`SignatureDialog` é decomposto** (CLAUDE.md, ~150 linhas): `SignatureDrawPad` (o pad de hoje),
    `SignatureUploadPad` (dropzone + preview + controles) e a lógica de imagem em
    `features/auth/lib/signatureImage.ts` como **funções puras** (sem DOM onde der), que é o que
    torna a remoção de fundo testável de verdade.
11. **Frontend puro.** Nenhuma mudança de endpoint, DTO, entity, migration ou contrato ⇒ sem
    `build:types` / `build:api-client` e **sem alteração no `fonte-api.postman_collection.json`**
    (`POST /staff/me/signature` continua idêntico).
12. **Sem drag-and-drop obrigatório:** a dropzone aceita clique (input file escondido) **e** drop.
    O drop é ~10 linhas e é o gesto natural de quem tem o scan no desktop.

## Desenho

### `features/auth/lib/signatureImage.ts` (novo — funções puras)

1. Constantes: `MAX_SIGNATURE_DIMENSION = 1200`, `DEFAULT_BACKGROUND_THRESHOLD = 230`,
   `MIN_BACKGROUND_THRESHOLD = 180`, `MAX_BACKGROUND_THRESHOLD = 250`,
   `BACKGROUND_FEATHER = 50`, `MAX_INPUT_BYTES = 10 * 1024 * 1024`,
   `ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg']`.
2. `validateSignatureFile(file: File): string | null` — devolve a mensagem de erro (em pt-BR, para a
   UI) ou `null`. Cobre tipo não aceito e tamanho acima de `MAX_INPUT_BYTES` (decisão 6).
3. `scaledDimensions(width, height, max = MAX_SIGNATURE_DIMENSION): { width, height }` — proporção
   mantida, sem **upscale** (imagem menor que o limite passa intacta). Decisão 5.
4. `removeBackground(data: Uint8ClampedArray, threshold: number): void` — opera **in place** sobre o
   buffer RGBA do `ImageData`. Para cada pixel: `l = 0.299r + 0.587g + 0.114b`;
   `l >= threshold` → `a = 0`; `l <= threshold - BACKGROUND_FEATHER` → `a` inalterado; entre os dois
   → `a = a * (threshold - l) / BACKGROUND_FEATHER` arredondado (decisão 3). Pixel já transparente
   segue transparente.

### `features/auth/components/SignatureUploadPad.tsx` (novo)

5. Props: `onChange(blob: Blob | null): void`, `disabled?: boolean`. Sem fetch e sem mutation — quem
   salva é o dialog (dialog autossuficiente já busca/salva pelos hooks).
6. Estado local: `file`, `objectUrl`, `removeBg` (default `true`), `threshold` (default 230),
   `error`.
7. Escolha do arquivo por `<input type="file" accept="image/png,image/jpeg" class="sr-only">`
   acionado por clique na dropzone **e** por `onDrop`/`onDragOver` (decisão 12). Rejeição de
   `validateSignatureFile` mostra erro e **não** troca o preview.
8. Pipeline de processamento (efeito que roda quando `file`, `removeBg` ou `threshold` muda):
   `createImageBitmap`/`Image` → `canvas` no tamanho de `scaledDimensions` → `drawImage` →
   se `removeBg`: `getImageData` → `removeBackground(data, threshold)` → `putImageData` →
   `canvas.toBlob(..., 'image/png')` → `onChange(blob)`.
   Debounce curto (~150 ms) no slider para não reprocessar a cada pixel arrastado.
9. Preview = o próprio `<canvas>` renderizado sobre fundo **xadrez** (classe utilitária com
   `background-image` de gradiente, sem asset novo), altura equivalente à do pad de desenho
   (~180 px) para as duas abas não pularem de tamanho.
10. Controles abaixo do preview: checkbox "Remover fundo claro" e, quando ligado, slider de limiar
    com `aria-label` explícito (decisão 4).

### `features/auth/components/SignatureDrawPad.tsx` (novo — extração)

11. Recebe `onChange(blob: Blob | null)` e expõe "limpar" por prop (`clearSignal` numérico ou
    `ref`); mantém `penColor="black"`, `aria-label="Área de assinatura"`, altura 180 e a conversão
    `toBlob('image/png')` que já existe. Comportamento idêntico ao de hoje — é refactor, não
    mudança.

### `features/auth/components/SignatureDialog.tsx` (reescrito, fino)

12. `Tabs` (`components/ui/tabs.tsx`) com `defaultValue="draw"`; abas "Desenhar" e "Enviar imagem"
    (decisões 7/8). Os dois pads ficam **montados** (Radix `Tabs` desmonta por padrão — usar
    `forceMount` + `hidden` ou manter o blob no estado do dialog) para que trocar de aba não perca
    o trabalho.
13. Estado: `drawBlob`, `uploadBlob`, `tab`. `activeBlob = tab === 'draw' ? drawBlob : uploadBlob`.
14. "Salvar": `disabled={!activeBlob || mutation.isPending}` → `mutation.mutate(activeBlob)`
    (decisão 9). Mensagem de erro da mutation via `getErrorMessage`, como hoje.
15. "Limpar": aba ativa — limpa o pad ou descarta o arquivo (decisão 9).
16. `handleClose` zera os dois blobs, o erro e faz `mutation.reset()` (decisão 8).
17. Alvo: dialog abaixo de ~120 linhas; cada pad abaixo de ~150.

### `SignatureSection.tsx`

18. Inalterada, fora do rótulo do botão: com assinatura configurada, "Redesenhar" vira
    **"Alterar assinatura"** — com upload disponível, "Redesenhar" descreve só metade das opções.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Story frontend-only (decisão 11)
⇒ `pnpm test:api`, `pnpm test:api:e2e`, `build:types`/`build:api-client` e `migration:run:test`
**não** são exigidos.

**Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
nenhum código novo entra sem teste. Rodar `pnpm --filter adm.fonte test:unit:cov` com cobertura ≥90
do código tocado e **sem reduzir** a cobertura de `features/auth`. `pnpm test:adm` (Playwright)
verde.

- **Unit `signatureImage.test.ts`** (novo — o coração da decisão 2/3, testável sem DOM):
  - `validateSignatureFile`: aceita `image/png` e `image/jpeg`; rejeita `image/webp`, `image/gif` e
    `application/pdf` com mensagem de tipo; rejeita arquivo acima de 10 MB com mensagem de tamanho;
    arquivo válido → `null`.
  - `scaledDimensions`: paisagem 3000×2000 → 1200×800; retrato 2000×3000 → 800×1200; imagem menor
    que o limite **não** é ampliada; quadrada 1200×1200 → inalterada; arredondamento sem `0`.
  - `removeBackground`: pixel branco (255,255,255) → `a = 0`; pixel preto → `a` intacto; pixel na
    faixa de feather → alpha **intermediário** (nem 0 nem original) — é o que prova a decisão 3;
    limiar mais alto preserva cinza que o limiar baixo apagaria; pixel já com `a = 0` continua 0;
    a função altera o buffer **in place** e não realoca.
- **Unit `SignatureUploadPad.test.tsx`** (novo):
  - arquivo `image/jpeg` válido → chama `onChange` com um `Blob` **`image/png`** (decisão 1);
  - arquivo rejeitado (tipo/tamanho) → mensagem de erro visível e `onChange` **não** chamado;
  - checkbox "Remover fundo claro" nasce **ligado** e o slider só aparece com ele ligado
    (decisão 4);
  - desligar o checkbox reprocessa e emite novo blob (o pipeline reage ao controle);
  - "limpar" volta ao estado vazio e emite `onChange(null)`;
  - drop de arquivo na dropzone tem o mesmo efeito da seleção pelo input (decisão 12).
  - Mocks: `HTMLCanvasElement.getContext`/`toBlob` e `createImageBitmap` não existem no jsdom —
    stub no setup do teste (o assert é sobre o **contrato** do componente, não sobre pixels; pixel é
    coberto pelo teste puro acima).
- **Unit `SignatureDialog.test.tsx`** (já existe — atualizar):
  - abre na aba "Desenhar" (decisão 8) e a aba "Enviar imagem" existe;
  - "Salvar" desabilitado na aba de upload sem arquivo; habilita ao escolher; salva o blob **da aba
    ativa** (regressão direta da decisão 9 — trocar de aba e salvar não pode enviar o blob da
    outra);
  - desenhar, trocar para "Enviar imagem" e voltar **preserva** o traço (decisão 8);
  - fechar e reabrir zera as duas abas;
  - erro da mutation renderiza via `getErrorMessage`;
  - os casos atuais do pad de desenho continuam passando (o refactor do item 11 não muda
    comportamento).
- **Unit `SignatureSection.test.tsx`** (já existe — atualizar): com assinatura configurada, o botão
  diz **"Alterar assinatura"**; sem assinatura, "Configurar assinatura" (item 18).
- **E2E `apps/adm.fonte/e2e/auth.spec.ts`** (a seção vive na ProfilePage; não há e2e de assinatura
  hoje): abrir "Configurar assinatura" → aba "Enviar imagem" → `setInputFiles` com um PNG de
  fixture → preview aparece → "Salvar" → a seção passa a exibir a assinatura. É o único caminho que
  prova o ciclo completo contra a API real.

## Fora de escopo

- **Backend.** `POST /staff/me/signature` continua exigindo PNG ≤ 5 MB; nenhuma conversão ou
  remoção de fundo no servidor (decisões 1/11).
- **Upload de assinatura de OUTRO staff** (admin configurando pelo perfil alheio) — a story mexe só
  no `me`.
- **Recorte/rotação/crop** da imagem enviada. Quem mandar a foto torta manda de novo.
- **Aceitar PDF, WEBP, HEIC ou SVG** (decisão 6).
- **Remoção de fundo "inteligente"** (detecção de papel, correção de sombra, binarização adaptativa
  tipo scanner). O limiar por luminância com slider resolve o caso comum; algoritmo melhor é outra
  story.
- **`ops.fonte` / `app.fonte`** — a configuração de assinatura é do `adm.fonte`.
