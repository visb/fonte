---
name: fonte-support-groups
description: Feature Grupos de Apoio (grupos de oração de famílias + checkin de presença) — modelo de dados (support_groups/meetings/checkins), API REST, telas adm.fonte e ops.fonte, geração/impressão de QR Code, fluxo de checkin fase 2 (app.fonte). Use ao tocar em grupos de apoio, reuniões ou checkin de família.
---

# Grupos de Apoio

## Visão geral

Módulo para gerenciar grupos de apoio (grupos de oração de famílias) e realizar checkin de presença nas reuniões.

## Modelo de dados

### `support_groups`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid | PK |
| name | varchar | Nome do grupo |
| church_name | varchar | Nome da igreja que sedia o grupo |
| address | varchar | Endereço |
| coordinator_id | uuid FK staff | Servo coordenador (nullable) |
| day_of_week | smallint | 0=Dom … 6=Sáb — dia semanal de reunião |
| created_at / updated_at / deleted_at | timestamp | Soft delete |

### `support_group_meetings`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid | PK |
| support_group_id | uuid FK | Grupo de apoio |
| date | date | Data da reunião |
| notes | text | Observações (nullable) |
| checkin_token | uuid | Token único para QR Code de checkin |
| created_at / updated_at | timestamp | |

### `support_group_checkins`
| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid | PK |
| meeting_id | uuid FK | Reunião |
| resident_id | uuid FK residents | Filho cuja família compareceu |
| checked_in_at | timestamptz | Horário do checkin |
| created_at | timestamp | |
| UNIQUE (meeting_id, resident_id) | | Evita duplicata |

## API

Todas as rotas exigem JWT. Base: `/support-groups`.

| Método | Rota | Roles | Descrição |
| --- | --- | --- | --- |
| GET | `/support-groups` | ALL | Lista grupos com nome do coordenador |
| POST | `/support-groups` | ADMIN, COORD | Cria grupo |
| GET | `/support-groups/:id` | ALL | Detalhe do grupo |
| PATCH | `/support-groups/:id` | ADMIN, COORD | Atualiza grupo |
| DELETE | `/support-groups/:id` | ADMIN, COORD | Soft delete |
| GET | `/support-groups/meetings` | ALL | Lista todas as reuniões (para ops.fonte) |
| GET | `/support-groups/:id/meetings` | ALL | Lista reuniões de um grupo |
| POST | `/support-groups/:id/meetings` | ALL | Cria reunião |
| GET | `/support-groups/meetings/:meetingId` | ALL | Detalhe da reunião + checkins |
| POST | `/support-groups/meetings/:meetingId/checkins` | ALL | Adiciona checkin manual |
| DELETE | `/support-groups/meetings/:meetingId/checkins/:checkinId` | ALL | Remove checkin |

## adm.fonte

- Rota: `/support-groups`
- Nav: sidebar "Grupos de Apoio" (ícone `HandHeart`) — visível para ADMIN e COORDINATOR
- Funcionalidades: listar, criar, editar, excluir grupos; expandir para ver histórico de reuniões

## ops.fonte

- Aba: "Apoio" (`heart-circle-outline`) na tab bar
- Tela de lista (`/(app)/support-groups`): todas as reuniões, ordenadas por data; reunião de hoje em destaque; FAB para criar nova reunião
- Tela de detalhe (`/(app)/support-groups/[meetingId]`):
  - Botão para exibir QR Code (modal fullscreen) — famílias escaneiam via app.fonte (fase 2)
  - QR Code contém: `support-group-meeting:{meetingId}`
  - Autocomplete para buscar filho pelo nome e registrar presença manual
  - Lista de famílias presentes (identificadas pelo nome do filho) com opção de remover

## Dependências adicionais (ops.fonte)

- `react-native-qrcode-svg` — geração do QR Code
- `react-native-svg` — peerDependency do react-native-qrcode-svg
- `expo-print` — impressão do QR Code via HTML

Execute `pnpm install` após o pull para instalar.

## Botão Imprimir (QR Code)

No modal do QR Code em `MeetingDetailPage.tsx`: botão "Imprimir" captura o QR via `qrRef.current.toDataURL()` (base64 PNG), embute num HTML mínimo e chama `Print.printAsync({ html })` do `expo-print`.

## Fluxo de checkin via QR Code (fase 2 — app.fonte)

O QR Code da reunião contém `support-group-meeting:{meetingId}`. Quando o fluxo de checkin no app.fonte (app das famílias) for implementado, ao escanear esse código o app apresentará um fluxo para a família confirmar sua presença, chamando `POST /support-groups/meetings/:meetingId/checkins` com o `residentId` do filho.
