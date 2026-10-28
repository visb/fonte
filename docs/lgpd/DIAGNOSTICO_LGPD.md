# Diagnóstico LGPD — Fonte de Misericórdia

> Data: 2026-06-08. Escopo: backend `services/api` + apps. Documento de diagnóstico — não altera código.

## 1. Resumo executivo

A plataforma trata **dados pessoais sensíveis** na acepção do art. 11 da LGPD — dados de **saúde** (`healthIssues`, `continuousMedication`), **dependência química** (`addiction`) e **convicção religiosa** (`religion`) — além de identificadores diretos (CPF, RG, endereço, foto) de internos, staff e familiares. Dado sensível exige o nível mais alto de proteção e base legal específica (art. 11, I/II).

Estado atual: **5 gaps de risco alto sem nenhuma mitigação** — ausência de registro de consentimento, política de privacidade, audit log, direitos do titular e proteção contra força bruta no login.

**Pendência bloqueante:** a base legal do tratamento dos dados sensíveis ainda não foi definida. Essa decisão jurídica precede a implementação de consentimento (ver §5).

## 2. Inventário de dados pessoais

Categorias: **P** = dado pessoal; **S** = dado pessoal sensível (art. 11).

| Entidade | Arquivo | Campos pessoais | Sensível (S) |
|---|---|---|---|
| User | `services/api/src/modules/user/user.entity.ts` | `email`, `passwordHash` | — |
| Resident | `services/api/src/modules/resident/resident.entity.ts` | `name`, `birthDate`, `cpf`, `rg`, `nationality`, `city`, `state`, `address`, `contactPhone`, `email`, `maritalStatus`, `children`, `occupation`, `education`, `weight`, `height`, `photoUrl` | **S**: `healthIssues`, `continuousMedication`, `religion`, `addiction` |
| Staff | `services/api/src/modules/staff/staff.entity.ts` | `name`, `phone`, `birthDate`, `cpf`, `rg`, `nationality`, `gender`, `city`, `state`, `address`, `maritalStatus`, `children`, `occupation`, `education`, `photoUrl`, `signatureUrl` (imagem de assinatura manuscrita — ver §2.1) | **S**: `healthIssues`, `continuousMedication`, `religion`, `addiction` |
| Admission | `services/api/src/modules/resident/admission.entity.ts` | `entryDate`, `exitDate` | **S**: `healthIssues`, `continuousMedication`, `weight`, `height` — **sem soft delete** |
| Relative | `services/api/src/modules/relative/relative.entity.ts` | `name`, `phone`, `relationship`, `photoUrl`, `isResponsible` | — |
| Message | `services/api/src/modules/message/message.entity.ts` | `content`, `attachmentUrl`, `attachmentType` | Comunicação privada — **sem soft delete** |
| ResidentDocument | `services/api/src/modules/resident/resident-document.entity.ts` | `signedFileUrl` | Conteúdo possivelmente sensível — cascade delete |
| ResidentAttachment | `services/api/src/modules/resident/resident-attachment.entity.ts` | `filename`, `fileUrl` | Conteúdo contextual — cascade delete |
| ResidentFollowUp | `services/api/src/modules/resident-follow-up/resident-follow-up.entity.ts` | `description`, `attachmentUrl` | Notas comportamentais/saúde |
| ResidentReceivable | `services/api/src/modules/resident-receivable/resident-receivable.entity.ts` | `amount`, `paymentMethod`, `notes`, `attachmentUrl` | Financeiro |
| ResidentUsageSession | `services/api/src/modules/resident-session/resident-usage-session.entity.ts` | `secondsUsed`, `date` | Rastreio de uso — **sem delete** |
| Incident | `services/api/src/modules/incident/incident.entity.ts` | `description`, `type` (positiva/negativa) | Disciplinar/comportamental |
| SupportGroupCheckin / RelativeCheckin | `services/api/src/modules/support-group/*` | `checkedInAt` | Presença de família — **sem soft delete** |
| House | `services/api/src/modules/house/house.entity.ts` | `name`, `address`, `city`, `state`, `phone` | Facilidade (não pessoal) |

### 2.1 Assinatura funcional do staff (`staff.signature_url`)

> Proposta de inventário — **base legal sujeita a revisão humana (compliance/jurídico)**. Origem do dado: story 128; regra de URL assinada: story 76.

- **Dado:** imagem da **assinatura manuscrita** do colaborador, desenhada pelo próprio staff no app e persistida como arquivo **PNG** (com transparência) no bucket, pasta `signatures/`. Referenciada em `staff.signature_url`.
- **Titular:** colaborador (**Staff** — roles `ADMIN` / `COORDINATOR` / `SERVANT`).
- **Categoria:** dado pessoal de identificação (**P**). A assinatura identifica o colaborador e autentica documentos; não é dado sensível do art. 11, mas tem valor probatório/identificatório e exige cuidado equivalente ao da foto.
- **Finalidade:** **assinar automaticamente** os documentos institucionais gerados a partir de templates (variável `{{signature}}`), substituindo a assinatura manual folha a folha. Desde a story 137, o bloco impresso traz **nome + assinatura** (a role deixou de ser impressa abaixo da assinatura).
- **Fluxo / armazenamento:**
  - Upload via `POST /staff/me/signature` (o próprio titular envia; validação de PNG, transparência e limite de 5 MB).
  - No banco fica a **URL canônica** (não a URL assinada). A URL é **assinada na leitura** (regra da story 76): as respostas da API entregam uma URL temporária assinada, e a canônica nunca vaza.
  - Ao **redesenhar**, o arquivo anterior é **apagado** do bucket antes de gravar o novo (story 128, decisão 8) — não acumula versões órfãs.
  - Em **produção** (S3), vale o comportamento canônico + assinada-na-leitura descrito acima. Em **dev local** (storage não-S3), a story 135 serve a assinatura como *data URI* embutido apenas para viabilizar o preview local; isso **não** se aplica a produção.
- **Base legal (proposta):** **legítimo interesse / execução do contrato de trabalho** (art. 7, II e IX) — a assinatura funcional do colaborador em documentos institucionais é instrumento ordinário da relação de trabalho e da atividade-fim da instituição. **Não** se enquadra como consentimento: coerente com o critério do projeto (§5), o consentimento fica reservado a **imagem/divulgação/marketing e divulgação religiosa**; dados operacionais do vínculo têm base própria. A assinatura aqui é uso funcional interno (autenticar documentos), não divulgação da imagem do colaborador.
- **Retenção / eliminação:**
  - O dado vive enquanto o staff mantém sua assinatura configurada. Redesenhar **sobrescreve e apaga** o arquivo anterior (story 128, dec. 8).
  - **Eliminação sob demanda pelo titular já existe:** `DELETE /staff/me/signature` (story 138) — botão "Redefinir" no perfil, **idempotente**, apaga o arquivo do bucket e zera `signature_url`.
  - **Gap remanescente:** não há eliminação **automática** no **desligamento/offboarding** do colaborador — o titular consegue remover manualmente, mas nenhuma rotina apaga a assinatura ao encerrar o vínculo. Ver `ROADMAP_LGPD.md` (Fase 4).

### 2.2 Ficha do filho armazenada no dispositivo do operador (`ops.fonte`)

> Origem: story 175 (store local em SQLite/AsyncStorage), sobre o snapshot da casa da story 177. Decisão de escopo tomada explicitamente pelo responsável pelo produto.

- **Dado:** cópia local da ficha dos filhos **presentes na casa do operador** — ficha básica (`Resident`), acompanhamentos (`ResidentFollowUp`), **consentimentos** (`ConsentRecord` consolidado por finalidade), **recorte do carnê** (`ResidentReceivableSummary` — `id`, `referenceMonth`, `status` e o filho dono da parcela; story 186), **metadados** de anexos (nome, tipo, data, id) e ministérios da casa.
- **Titular:** interno (**Resident**).
- **Categoria:** dado pessoal (**P**) e **sensível** (**S**) — a ficha básica carrega `healthIssues`, `continuousMedication`, `religion`, `addiction`.
- **Onde:** aparelho do operador. Banco **SQLite** local (`ops-fonte-resident-store.db`) no Android/iOS; `AsyncStorage` (uma chave por registro, prefixo `ops-fonte-resident-store:`) no web. **Binário de anexo não é baixado** — só a lista; abrir o arquivo continua exigindo conexão.
- **Finalidade:** o `ops.fonte` é usado **dentro das casas, sem sinal confiável**. Sem cópia local o operador não acessa a ficha de quem ele acompanha — o que inclui medicação em uso e restrições de saúde. Base legal acompanha a do processo de origem (§5): **tutela da saúde / proteção da vida** para o prontuário e acompanhamento; **execução de contrato / obrigação legal** para o financeiro.
- **Retenção:** **não há expiração por tempo** (o limite anterior de 24h do cache foi removido de propósito: casa sem sinal por um fim de semana abria vazia). O dado vive **até o logout ou a expiração da sessão**, quando é purgado.
- **Mitigações implementadas (story 175):**
  - **Purga verificada** no logout e na sessão expirada (`purgeAll()` junto de `clearPersistedCache()`); falha na purga **propaga** o erro (registrada no console/Sentry) em vez de falhar em silêncio.
  - **Allowlist, nunca denylist**: só as chaves declaradas em `lib/offline/store/` e `lib/offline/constants.ts` vão para o disco — dado novo não entra por omissão.
  - **Escopo por casa**: o aparelho só baixa o pacote da **própria casa** do operador (`GET /houses/:id/offline-snapshot`, story 177); o snapshot também **remove** do aparelho quem deixou de ser presente na casa (transferência, alta, evasão).
  - **Minimização no carnê (story 186)**: o aparelho passou a receber e **persistir** mês de referência e status de parcela por filho, para toda role de staff — é dado pessoal, ainda que não financeiro, e por isso fica registrado aqui. O que **não** trafega nem é gravado: valor, valor pago, forma de pagamento, data de pagamento, comprovante e observações. A leitura do carnê cheio continua restrita a `ADMIN`/`COORDINATOR` e só existe no `adm.fonte` (web, sem cópia local).
- **Gaps remanescentes:** (1) **sem criptografia em repouso** do banco local (SQLCipher) — aparelho comprometido/roubado expõe a ficha até o logout; (2) não há **purga remota** ou por inatividade se o aparelho nunca mais abrir o app. Ver `ROADMAP_LGPD.md`.

### 2.3 Rascunho do acolhimento no navegador (`adm.fonte`)

> Origem: story 211 (salvamento automático do acolhimento). Decisões de escopo tomadas pelo responsável pelo produto.

- **Dado:** os campos digitados no wizard de **primeiro acolhimento** (ficha de cadastro e admissão: nome, CPF, RG, nascimento, contato, endereço, perfil social, **saúde, medicação contínua, religião, dependência química**, casa, entrada, investimento familiar) e no formulário de **reintrodução**; mais o passo atual, o id do filho já criado e a forma do 1º pagamento. **Arquivos não entram** (foto e comprovante): só uma flag de que tinham sido escolhidos, para pedir que sejam reanexados.
- **Titular:** interno (**Resident**) em acolhimento.
- **Categoria:** dado pessoal (**P**) e **sensível** (**S**).
- **Onde:** `localStorage` do navegador do computador onde o acolhimento está sendo feito, chave `fonte:admission-draft:<userId>` (primeiro acolhimento) e `fonte:admission-draft:<userId>:readmission:<residentId>` (reintrodução). Código em `apps/adm.fonte/src/features/residents/lib/admissionDraft.ts`.
- **Finalidade:** proteger o que já foi preenchido contra queda de energia, recarga ou aba fechada durante o acolhimento, e impedir que o filho seja criado em duplicidade ao retomar. Base legal acompanha a do processo de origem (§5): o acolhimento.
- **Retenção:** **temporário**. Expira em **7 dias** (descartado na leitura) e é apagado ao **concluir** o acolhimento/reintrodução, ao **Descartar**, ao **Cancelar** e no **logout**.
- **Mitigações:** chave por `userId` (outro usuário no mesmo navegador não vê o rascunho de quem preencheu); sem arquivos; sem envio a servidor (o rascunho nunca sai do navegador); leitura/escrita em `try/catch` (storage bloqueado só desliga o rascunho).
- **Gaps remanescentes:** (1) **sem criptografia** no `localStorage` — quem tem acesso ao perfil do navegador (DevTools) lê o rascunho até ele expirar ou ser apagado; (2) **sessão expirada não apaga** o rascunho (só o logout explícito), para que o usuário retome após novo login — fica limitado pelos 7 dias.

### 2.4 Trilha de auditoria de ações (`audit_logs`)

> Origem: story 199 (amplia o registro de leituras/LGPD que já existia). Código em `services/api/src/modules/audit/`; tela ADMIN `/auditoria` no `adm.fonte`.

- **Dado:** um evento por ação do catálogo (`AuditAction` em `@fonte/types`): autor (`user_id`, `role`), IP, método e rota **sem query string**, alvo (`target_type`/`target_id`), recurso principal (`parent_type`/`parent_id`, ex.: o filho da parcela), casa no momento da ação e casa anterior (`house_id`/`previous_house_id`), correlação da requisição, resultado/motivo e, para alterações, os campos alterados com **antes/depois** (`changed_fields`, `changes` JSONB). Eventos sem diff (login, documentos, conclusão da contagem) guardam só metadados permitidos em `context`.
- **Titular:** usuários do sistema (autor) e o titular do recurso alterado (filho, servo, familiar).
- **Categoria:** dado pessoal (**P**). Dado **sensível não é gravado em texto**: a projeção de antes/depois usa **lista explícita de campos por domínio** (`audit-fields.ts`) e aplica, ANTES de persistir:
  - `redacted` (só registra QUE mudou, antes/depois `null`): saúde, medicação contínua, dependência, religião, peso, altura, endereço, observações da parcela e descrição de acompanhamento;
  - `masked`: CPF, RG, telefone/WhatsApp e e-mail (só os últimos caracteres; e-mail mantém 1ª letra e domínio). O campo continua sinalizado como alterado mesmo quando as máscaras coincidem;
  - `file`: foto, assinatura, anexos e comprovantes viram o marcador `[arquivo]` — **nunca** URL (canônica ou assinada), bytes ou nome do arquivo.
  - Campo fora da lista nunca entra (senha, hash, token, cookie, `Authorization`, corpo HTTP, query string).
- **Login:** uma ocorrência por tentativa finalizada (sucesso e falhas: credencial inválida, usuário inativo, identificador inexistente/ambíguo, entrada inválida, bloqueio por tentativas, erro interno). Falha **não** atribui identidade: autor nulo e o identificador digitado gravado **mascarado** (e-mail `a***@dominio`; telefone só 4 últimos dígitos). A resposta externa não muda.
- **Exclusões** registram só o vínculo (status/casa/datas do filho; casa/perfil do servo) — sem cópia da ficha. Nomes exibidos na tela são resolvidos pelo banco no momento da consulta (sem snapshot permanente de nome).
- **Anonimização (art. 18):** `anonymizeResident` zera, na mesma transação, os valores de antes/depois de todos os eventos cujo alvo ou recurso principal é o titular (fica só a lista de campos alterados). É a única escrita posterior permitida sobre `audit_logs`; nenhuma rota edita ou apaga eventos.
- **Finalidade / base legal:** segurança e rastreabilidade de quem alterou o quê (art. 37 e 46) — **legítimo interesse e segurança** (§5, "Controle de acesso ao sistema").
- **Acesso:** consulta (`GET /audit`, `GET /audit/events/:id`) exclusiva de **ADMIN**.
- **Garantias e limites:** alterações de banco do catálogo gravam o evento **na mesma transação** (falha da auditoria desfaz a alteração). Login, geração de documentos e conclusão da contagem gravam de forma aguardada, mas **sem fila durável**: indisponibilidade exclusiva da auditoria gera aviso sanitizado no log operacional e o evento pode se perder — não há garantia absoluta para esses eventos. Upload/PDF/storage não são transacionais.
- **Retenção:** **sem prazo definido** — os eventos ficam indefinidamente, como os registros de leitura já existentes. Prazo legal de retenção é decisão jurídica pendente (não inventado aqui); ver `ROADMAP_LGPD.md`.

## 3. Mapa de gaps

| Gap | Risco | Artigo LGPD | Arquivo(s) | Pilar |
|---|---|---|---|---|
| Sem registro de consentimento | Alto | art. 8, 11 | (inexistente) | Consentimento |
| Sem política de privacidade / termo versionado | Alto | art. 9 | (inexistente) | Consentimento |
| Sem audit log de acesso/alteração a dado sensível | Alto → **Mitigado** (registro de leituras pré-existente + story 199: leituras + alterações com antes/depois mascarado, login; ver §2.4) — resta prazo de retenção da trilha | art. 37, 46 | `services/api/src/modules/audit/` | Segurança |
| Sem direitos do titular (export/exclusão/anonimização/retificação) | Alto | art. 18, 19, 20 | (inexistente) | Direitos |
| Sem rate-limit no login (força bruta) | Alto | art. 46 | `auth.controller.ts`, `main.ts` | Segurança |
| CPF/RG em texto puro em respostas de lista | Médio/Alto | art. 6 (minimização) | `resident.entity.ts`, `staff.entity.ts` | Segurança |
| Escopo por casa não forçado em residents/staff/relatives | Alto | art. 6, 46 | `resident.service.ts`, `staff.service.ts`, `relative.service.ts` | Segurança |
| Soft delete ausente em 18 entidades | Médio | art. 16 | Admission, Message, ResidentUsageSession, attachments, checkins… | Retenção |
| Sem política de retenção / purga / anonimização | Médio | art. 15, 16 | `backup.service.ts` (só retém backup) | Retenção |
| Arquivos órfãos no bucket após exclusão | Médio | art. 16 | `resident.service.ts` (attachments não removidos) | Retenção |
| Backups com PII completa sem anonimização | Médio | art. 6 | `backup.service.ts`, `database/backup-export.ts` | Retenção |
| Planilha de filhos com PII real versionada no git (story 106) | Alto | art. 6 | `stories/lista-filhos.xlsx` — removida do working tree; **purga do histórico + force-push pendente (manual)** | Retenção |
| Ficha do filho no dispositivo do operador sem criptografia em repouso (§2.2) | Médio | art. 46 | `apps/ops.fonte/lib/offline/store/` — purga no logout implementada; SQLCipher pendente | Segurança |

> Nota: o módulo de mensagens (`message.service.ts`) é o **único** que já força escopo por casa no service — serve de referência para corrigir os demais.

## 4. Pontos já conformes

- Senhas com **bcrypt (10 rounds)**; nunca logadas/expostas.
- **JWT + guards** (`JwtAuthGuard`, `RolesGuard`) em todos os controllers exceto `/auth/login` (esperado).
- **Soft delete** (`deleted_at`) nas entidades core: User, Resident, Staff, Relative, Incident, House e outras.
- `mustChangePassword` força troca de senha inicial.
- Escopo por casa correto em `message.service.ts`.
- Permissões granulares de staff (`MODERATE_MESSAGES`, `SEND_MESSAGES_TO_FAMILIES`).

## 5. Base legal por processo

Mapeamento definido (a validar com jurídico). A base **não é única** — varia por processo/categoria de dado.

| Processo | Dados | Base legal |
|---|---|---|
| Cadastro de internos | Nome, CPF, RG, endereço | Execução de contrato / procedimentos preliminares; proteção da vida |
| Prontuário social e acompanhamento | Saúde, medicação, dependência | Tutela da saúde; proteção da vida |
| Controle de medicamentos | Saúde, medicação contínua | Tutela da saúde |
| Contato com familiares | Nome, telefone, parentesco | Legítimo interesse / execução contratual |
| Assinatura funcional do staff em documentos (§2.1) | `signatureUrl` (imagem de assinatura) | Legítimo interesse / execução do contrato de trabalho — **proposta, a validar com jurídico** |
| Controle de acesso ao sistema | Login, IP, auditoria | Legítimo interesse e segurança |
| Emissão de documentos fiscais | CPF, dados financeiros | Obrigação legal |
| Histórico de atendimento | Saúde e dependência | Tutela da saúde |
| Divulgação de fotos, testemunhos, marketing | Imagem, religião, recuperação | **Consentimento** |
| Informações religiosas | Religião, participação em atividades | **Consentimento explícito** (ou hipótese validada pelo jurídico) |

**Consequência de arquitetura:**

- Dados de **saúde/medicação/dependência** operam sob **tutela da saúde / proteção da vida** (art. 11, II) — **não dependem de consentimento**. Foco nesses dados = segurança de acesso + auditoria (Fase 1).
- **Consentimento** (Fase 2) fica restrito a **imagem/divulgação/marketing** e **divulgação religiosa**. `consent_record` é gate só desse subconjunto, **não** do acesso geral do titular.
- Decisão de base legal concluída — desbloqueia a Fase 1 e direciona a Fase 2. Resta da Fase 0: política de privacidade + termo de imagem/divulgação, e encarregado/DPO. Ver `ROADMAP_LGPD.md`.
