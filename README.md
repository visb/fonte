# Fonte de Misericórdia

Plataforma operacional da comunidade terapêutica Fonte de Misericórdia.

Sistema modular composto por aplicações web e mobile para gestão administrativa, rotina interna, acompanhamento de internos e comunicação com familiares.

Versão inicial focada em simplicidade arquitetural, rodando em uma única instância (VPS), com backend centralizado.

---

# 1. Objetivo do Projeto

Digitalizar e organizar:

- Gestão da comunidade
- Jornada do interno (entrada → permanência → alta)
- Rotina diária
- Registro de ocorrências
- Comunicação com familiares

Objetivo principal da v1:
Entregar estabilidade operacional com baixo nível de complexidade técnica.

---

# 2. Produtos (Apps)

## adm.fonte (web)

Gestão administrativa da comunidade.

Responsabilidades:

- Cadastro de internos(filhos)
- Gestão de colaboradores(servos)
- Controle básico de dados
  - Casas
  - Ministérios(funciona como "setores" numa empresa)
  - Dispensa(individual para cada casa)
- Relatórios operacionais
  - Autonomia do estoque da dispensa com base no consumo médio da casa
  - Tempo médio de permanencia de filhos por casa
  - Relação de incidentes/filho por casa

---

## ops.fonte (mobile)

Aplicativo interno para operadores da casa.

Stakeholders:

- SERVANT
- Coordinator

Responsabilidades:

- Gestão dos internos
- Gerenciar ministérios
  - CRUD de ministérios
  - atribuir responsáveis e filhos designados
- Registro de rotina diária
- Registro de ocorrências
- Checklists operacionais
- Gestão da dispensa
  - Entrada
  - Saida
  - Conferencia
- Supervisão operacional

---

## ff.fonte (mobile)

Aplicativo para familiares (fase 2).

Responsabilidades:

- Acompanhamento do interno
- Recebimento de atualizações
- Comunicação institucional

---

## resident.fonte(mobile)

Aplicativo para filhos internos na comunidade(fase 2).

App rodando em modo Kiosk, disponivel para os filhos utilizarem no dia a dia, com limite de 25 min de uso diário, não acumulativo.

Funcionalidades:

- Enviar mensagens para familiares
- Lista de pedidos para o dia da visita
- Cadastrar contatos

---

# 3. Arquitetura Geral

Monorepo estruturado em:

```
apps/
  adm.fonte/
  ff.fonte/
  ops.fonte/
  resident.fonte/

services/
  api/

packages/
  shared/
  ui/
  types/
```

---

# 4. Stack Técnica

Backend:

- NestJS
- PostgreSQL
- JWT para autenticação

Frontend:

- Web: React
- Mobile: React Native (Expo)

Infraestrutura:

- 1 container
- 1 banco PostgreSQL
- Deploy em VPS

> **Backup (story 20):** o backup semanal usa `pg_dump`/`pg_restore` **v16**. A imagem/host
> que roda a API precisa ter o `postgresql-client` v16 instalado (ex.: Alpine
> `apk add postgresql16-client`; Debian `postgresql-client-16`). Ver skill `fonte-backup` (`.claude/skills/fonte-backup/`).

Sem microservices.
Sem mensageria.
Sem multi-tenant (neste momento).

---

# 5. Princípios Arquiteturais

- Arquitetura modular por domínio
- Controller fino
- Service com regra de negócio
- Repository isolando acesso ao banco
- DTO obrigatório para entrada/saída
- Soft delete em entidades críticas
- UUID como padrão de ID

---

# 6. Perfis de Usuário

- ADMIN
- COORDINATOR
- SERVANT
- FAMILY (fase futura)
- RESIDENT (fase futura)

---

# 7. Fluxos Principais

## Entrada de Interno

1. Cadastro
2. Status PRE_ADMISSION
3. Ativação (ACTIVE)
4. Associação à casa

## Rotina

1. Registro diário
2. Checklists
3. Ocorrências

## Alta

1. Atualização para DISCHARGED
2. Registro de data de saída
3. Ativação de acompanhamento (fase futura)

---

# 8. Roadmap Técnico

Fase 1:

- Auth
- CRUD Internos
- Registro de rotina
- Registro de ocorrências

Fase 2:

- Comunicação com familiares
- Relatórios

Fase 3:

- Pós-alta estruturado
- Métricas

---

Louvado seja o nome do nosso senhor Jesus Cristo!
