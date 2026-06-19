# Plan: Atividades — áudio (upload + gravação) com player na atividade e comentários

## Context

Follow-up dos anexos (story 73), que entregou a tabela `activity_attachments`, os endpoints de
upload/delete e a UI de lista/anexo no adm e ops. Item 4 (último) do BACKLOG: **poder gravar áudio
(microfone) ou enviar arquivo de áudio como anexo / comentário da atividade, com um reprodutor.**

**Depende da story 73** — esta story estende a infra de anexo para áudio (não cria modelo novo).

### Decisões travadas

- **Áudio é um anexo** (`activity_attachments` da story 73), na atividade **ou** num comentário.
  Origem dupla: **upload** de arquivo de áudio **ou** **gravação em tempo real** pelo microfone.
  Comentário só de áudio = comentário com `body` vazio + 1 anexo de áudio (a story 65 permite body
  opcional quando há anexo — ajustar a validação se hoje exige body não vazio).
- **Player de áudio** (adm e ops) para qualquer anexo `file_type = audio`: **play/pause** + controle
  de **velocidade 1x / 1.5x / 2x**. Barra de progresso/tempo simples.
- **Escopo: `adm.fonte` (web) + `ops.fonte` (mobile).** Gravar e reproduzir nos dois.
  - Gravação web: `MediaRecorder` (output típico `audio/webm;codecs=opus`).
  - Gravação ops: `expo-audio` (ou `expo-av` Recording, conforme o que o app já usa) → `audio/m4a`/`aac`.
- **Formato: salvar o que o device grava, sem transcodar.** Estende a allowlist da story 73 com
  mimetypes de áudio (`audio/webm`, `audio/mp4`, `audio/m4a`, `audio/aac`, `audio/mpeg`,
  `audio/ogg`, `audio/wav`). `file_type` deriva `audio`. **Sem ffmpeg/processamento no backend.**
- **Limites:** tamanho **20 MB** (hard cap do backend, igual à 73) **e duração máx. 2 min**. A
  duração é aplicada **no cliente** — a gravação para automaticamente em 2:00 e um arquivo de áudio
  enviado por upload é rejeitado no cliente se exceder 2 min (lê metadados antes de subir). O
  backend não decodifica áudio; a garantia dura é o limite de tamanho. (Trade-off aceito: validação
  de duração é client-side.)

## Desenho

### Backend (`services/api/src/modules/activity/`)

- Estender a **allowlist de mimetype** do controller de anexos (story 73) com os tipos de áudio
  acima. `file_type` passa a derivar `audio` quando `mimetype.startsWith('audio/')` (como o
  `message.controller`). Reusa o mesmo endpoint de upload — **sem rota nova**.
- (Opcional) coluna `duration_seconds` int nullable em `activity_attachments` se quisermos exibir a
  duração: se incluída, **migration nova** e o cliente envia a duração medida. Default desta story:
  **incluir** `duration_seconds` (melhora o player) — migration aditiva, nullable.
- Validação de comentário (story 65): permitir `body` vazio **quando** o comentário tem ao menos um
  anexo (evita travar comentário só-de-áudio). Ajustar DTO/service + spec.
- **Spec**: upload de áudio aceito (mimetype de áudio ok); tipo de áudio fora da allowlist barrado;
  comentário só com anexo de áudio (body vazio) aceito; tamanho >20MB barrado.

### packages/types / api-client

- `ActivityAttachment` ganha `durationSeconds?: number | null` (se a coluna entrar). `file_type`
  já cobre `audio`. `pnpm build:types`. Sem método novo no api-client (reusa o upload da 73, que
  aceita o blob de áudio); ajustar assinatura se passar a duração no form-data. `pnpm build:api-client`.

### Frontend adm.fonte (`apps/adm.fonte/src/features/activities/`)

- `AudioRecorder` (componente): `MediaRecorder`, botão gravar/parar, timer, **auto-stop em 2:00**,
  gera `Blob` → envia pelo `useUploadActivityAttachment`/`useUploadCommentAttachment` (story 73).
  Pede permissão de microfone; erro tratado via `getErrorMessage`.
- `AudioPlayer` (componente reutilizável): `<audio>` controlado — play/pause, tempo/seek, seletor
  de velocidade **1x/1.5x/2x** via `audioEl.playbackRate`. Renderizado pelo `AttachmentItem` (da
  73) quando `file_type === 'audio'`, no lugar do link de download.
- Upload de arquivo de áudio: o `AttachmentUploader` (73) já aceita `<input file>`; estender a
  validação cliente para checar **duração ≤ 2 min** lendo metadados (`HTMLAudioElement.duration`)
  antes de subir, além de tipo/tamanho.

### Frontend ops.fonte (`apps/ops.fonte/features/activities/`)

- `AudioRecorder` RN: `expo-audio`/`expo-av` Recording, permissão de microfone, timer, auto-stop em
  2:00, sobe o arquivo gravado pelos hooks da 73.
- `AudioPlayer` RN: `expo-av` `Sound` — play/pause, progresso, `setRateAsync(rate, true)` para
  1x/1.5x/2x. Usado no item de anexo quando `file_type === 'audio'`.
- Upload de arquivo de áudio via `expo-document-picker` (filtro de áudio), com checagem de duração
  ≤ 2 min no cliente.

### Postman

- Atualizar a nota do endpoint de upload de anexo (story 73): allowlist agora inclui áudio; se
  `duration_seconds` for enviado no form-data, documentar o campo.

## Validação

- `pnpm build:types` + `pnpm build:api-client` (campo/tipo).
- `pnpm test:api` verde + migration (se `duration_seconds`) roda em `pnpm dev:api`.
- **adm**: `pnpm --filter adm.fonte build`. Smoke: gravar áudio (para em 2:00), enviar como anexo da
  atividade e como comentário só-de-áudio; reproduzir com play/pause e 1.5x/2x; enviar arquivo de
  áudio por upload; arquivo >2 min rejeitado no cliente; tipo não-áudio fora da allowlist barrado.
- **ops**: typecheck/compila. Smoke (se emulador): gravar/parar, reproduzir com velocidade, anexar
  em atividade e comentário.
- **Gate de cobertura (trava a story):** todo caminho novo/alterado tem teste — nenhum código novo
  sem teste. Backend: allowlist de áudio (aceito/barrado), comentário só-com-anexo (body vazio) e,
  se entrar, persistência de `duration_seconds`. Frontend: `AudioPlayer` (play/pause, troca de
  velocidade altera `playbackRate`/rate) e validação de duração ≤2min no uploader, nos dois apps.
  Rodar `pnpm test:api:cov` + runners de cobertura do `adm.fonte` e do `ops.fonte`; **não reduzir**
  a cobertura do módulo `activity` nem das features `activities`. Sem `skip`/`only`/`xfail`
  injustificado (CLAUDE.md).

## Fora de escopo

- **Transcodação/normalização** de áudio no backend (ffmpeg) — salva o formato nativo do device.
- Transcrição (speech-to-text), waveform/visualização avançada, trim/edição do áudio.
- Validação de duração no servidor (decodificação) — fica client-side; servidor garante só tamanho.
- Áudio em outras entidades fora de atividade/comentário.
