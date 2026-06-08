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
| Staff | `services/api/src/modules/staff/staff.entity.ts` | `name`, `phone`, `birthDate`, `cpf`, `rg`, `nationality`, `gender`, `city`, `state`, `address`, `maritalStatus`, `children`, `occupation`, `education`, `photoUrl` | **S**: `healthIssues`, `continuousMedication`, `religion`, `addiction` |
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
| Controle de acesso ao sistema | Login, IP, auditoria | Legítimo interesse e segurança |
| Emissão de documentos fiscais | CPF, dados financeiros | Obrigação legal |
| Histórico de atendimento | Saúde e dependência | Tutela da saúde |
| Divulgação de fotos, testemunhos, marketing | Imagem, religião, recuperação | **Consentimento** |
| Informações religiosas | Religião, participação em atividades | **Consentimento explícito** (ou hipótese validada pelo jurídico) |

**Consequência de arquitetura:**

- Dados de **saúde/medicação/dependência** operam sob **tutela da saúde / proteção da vida** (art. 11, II) — **não dependem de consentimento**. Foco nesses dados = segurança de acesso + auditoria (Fase 1).
- **Consentimento** (Fase 2) fica restrito a **imagem/divulgação/marketing** e **divulgação religiosa**. `consent_record` é gate só desse subconjunto, **não** do acesso geral do titular.
- Decisão de base legal concluída — desbloqueia a Fase 1 e direciona a Fase 2. Resta da Fase 0: política de privacidade + termo de imagem/divulgação, e encarregado/DPO. Ver `ROADMAP_LGPD.md`.
