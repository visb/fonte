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
| Incident | `services/api/src/modules/incident/incident.entity.ts` | `description`, `severity` | Disciplinar/comportamental |
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

## 3. Mapa de gaps

| Gap | Risco | Artigo LGPD | Arquivo(s) | Pilar |
|---|---|---|---|---|
| Sem registro de consentimento | Alto | art. 8, 11 | (inexistente) | Consentimento |
| Sem política de privacidade / termo versionado | Alto | art. 9 | (inexistente) | Consentimento |
| Sem audit log de acesso/alteração a dado sensível | Alto | art. 37, 46 | (inexistente) | Segurança |
| Sem direitos do titular (export/exclusão/anonimização/retificação) | Alto | art. 18, 19, 20 | (inexistente) | Direitos |
| Sem rate-limit no login (força bruta) | Alto | art. 46 | `auth.controller.ts`, `main.ts` | Segurança |
| CPF/RG em texto puro em respostas de lista | Médio/Alto | art. 6 (minimização) | `resident.entity.ts`, `staff.entity.ts` | Segurança |
| Escopo por casa não forçado em residents/staff/relatives | Alto | art. 6, 46 | `resident.service.ts`, `staff.service.ts`, `relative.service.ts` | Segurança |
| Soft delete ausente em 18 entidades | Médio | art. 16 | Admission, Message, ResidentUsageSession, attachments, checkins… | Retenção |
| Sem política de retenção / purga / anonimização | Médio | art. 15, 16 | `backup.service.ts` (só retém backup) | Retenção |
| Arquivos órfãos no bucket após exclusão | Médio | art. 16 | `resident.service.ts` (attachments não removidos) | Retenção |
| Backups com PII completa sem anonimização | Médio | art. 6 | `backup.service.ts`, `database/backup-export.ts` | Retenção |
| Planilha de filhos com PII real versionada no git (story 106) | Alto | art. 6 | `stories/lista-filhos.xlsx` — removida do working tree; **purga do histórico + force-push pendente (manual)** | Retenção |

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
