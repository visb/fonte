# Roadmap LGPD — Fonte de Misericórdia

> Plano faseado de adequação. Base: `DIAGNOSTICO_LGPD.md`. Ordenado por risco × esforço.
> Cada fase técnica vira seu **próprio plano/PR**, com migrations novas, testes `pnpm test:api` e atualização da `fonte-api.postman_collection.json` (regras do `CLAUDE.md`).

## Fase 0 — Bloqueadores jurídicos (sem código)

Pré-requisito de tudo que envolve consentimento.

| Item | Status | Saída |
|---|---|---|
| Definir base legal por processo (art. 11) | ✅ **Concluído** — ver tabela em `DIAGNOSTICO_LGPD.md` §5 | Saúde/dependência = tutela da saúde; consentimento só p/ imagem e divulgação religiosa |
| Redigir política de privacidade e termo de imagem/divulgação | Pendente | Documentos versionados (jurídico) |
| Nomear encarregado / DPO (art. 41) | Pendente | Contato publicado |

> Decisão de base legal **não bloqueia a Fase 1** (tutela da saúde + segurança independem de consentimento). Bloqueia apenas a Fase 2.

## Fase 1 — Segurança de acesso (quick wins técnicos)

Maior risco × menor esforço. Não depende da Fase 0.

| Item | Onde | Critério de pronto |
|---|---|---|
| Rate-limit/throttle no login | `@nestjs/throttler` em `app.module.ts` + `auth.controller.ts` | Login bloqueia após N tentativas; teste cobre |
| Forçar escopo por casa | `resident.service.ts`, `staff.service.ts`, `relative.service.ts` (espelhar `message.service.ts`; derivar `houseId` do JWT, **não** do DTO) | SERVANT/COORDINATOR não lê dados de outra casa; teste cobre |
| Audit log de dado sensível | Novo módulo `audit` (entity `audit_log` + interceptor) | Acesso/alteração a Resident/Staff/Relative registrado |
| Minimização de CPF/RG em listas | Serializer / `@Exclude` por contexto em `resident.entity.ts`, `staff.entity.ts` | Listas não retornam CPF/RG; detalhe sim |

## Fase 2 — Consentimento + transparência

**Depende da política/termo da Fase 0.** Escopo **restrito a imagem/divulgação/marketing e divulgação religiosa** — acesso geral do titular e dados de saúde **não** passam por aqui (operam sob tutela da saúde).

| Item | Onde | Critério de pronto |
|---|---|---|
| Registro de consentimento | Entity `consent_record` (titular, finalidade — ex. `IMAGE_PUBLICATION`, `RELIGIOUS_DISCLOSURE` —, versão do termo, timestamp, revogação) | Aceite e revogação por finalidade persistidos |
| Gate de uso de imagem/divulgação | Checagem antes de publicar foto/testemunho | Sem consentimento vigente → uso bloqueado |
| Servir política de privacidade versionada | Endpoint + tela | Versão corrente acessível ao titular |

## Fase 3 — Direitos do titular (art. 18)

| Item | Onde | Critério de pronto |
|---|---|---|
| Export de dados (portabilidade, art. 20) | Reusar geração de PDF de `resident.controller.ts`; export JSON | Titular obtém seus dados |
| Exclusão / anonimização ("esquecimento", art. 18) | Pseudonimização preservando histórico legal/contábil obrigatório | Dados anonimizados, histórico legal íntegro |
| Retificação rastreável (art. 18, III) | Encadear no audit log da Fase 1 | Alteração registra autor e antes/depois |

## Fase 4 — Retenção & higiene de dados

| Item | Onde | Critério de pronto |
|---|---|---|
| Completar soft delete | Novas migrations p/ as 18 entidades sem `deleted_at` (**nunca editar migrations existentes**) | Exclusão é soft em todas |
| Política de retenção + purga | Job de purga/anonimização após prazo legal | Dados expirados purgados/anonimizados |
| Limpeza de arquivos órfãos | Fluxo de exclusão em `resident.service.ts` / `StorageService` | Bucket não retém arquivo de registro excluído |
| Anonimização de PII em backups | `backup.service.ts`, `database/backup-export.ts` | Avaliação concluída; medida aplicada se cabível |
| Eliminação da assinatura do staff no desligamento | `staff.service.ts` (offboarding); espelhar `removeSignature` já existente | Ao encerrar o vínculo, `signature_url` é zerada e o PNG apagado do bucket automaticamente. **Parcial hoje:** eliminação sob demanda pelo titular já existe (`DELETE /staff/me/signature`, story 138, idempotente); falta só a rotina automática no offboarding. Ver `DIAGNOSTICO_LGPD.md` §2.1 |

## Matriz pilar → fase

| Pilar (priorizado) | Fase principal |
|---|---|
| Segurança de acesso | Fase 1 |
| Direitos do titular | Fase 3 |
| Consentimento + transparência | Fase 0 (jurídico) → Fase 2 |
| Retenção + soft delete | Fase 4 |
