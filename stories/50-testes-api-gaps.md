# Plan: Auditoria de cobertura e gaps de teste — services/api (filha do epic 49)

## Context

Filha do epic [49](49-cobertura-testes-epic.md). O backend já tem a melhor cobertura do repo
(Jest unit + supertest e2e), mas não é garantida: módulos podem entrar sem spec. Esta story
**audita** a cobertura atual e **preenche o piso** dos módulos descobertos.

Decisões travadas (herdadas do epic): subir o piso, não perseguir %. Tooling já existe
(`jest`, `supertest`, `ts-jest`) — **nada novo a instalar**.

## Desenho

1. Rodar `pnpm test:api:cov` e ler o relatório: listar `src/modules/*` cujo `*.service.ts` tem
   cobertura baixa ou **sem `*.spec.ts`**, e endpoints sem e2e em `test/*.e2e-spec.ts`.
2. Para cada gap relevante (priorizar service com regra de negócio e endpoint exposto):
   - **unit**: `*.service.spec.ts` cobrindo o caminho feliz + 1–2 bordas (NotFound, validação de
     transição, soft delete) — espelhar specs existentes (`incident`, `associate`, `bible-course`).
   - **e2e**: `test/<modulo>.e2e-spec.ts` com guard (401/403 por role), validação 400 e o CRUD/fluxo
     principal — espelhar `associates.e2e-spec.ts` e usar `test/helpers/e2e-app.ts`.
3. Não duplicar o que já existe; só preencher buracos. Sem `skip`/`only`.

## Validação

- `pnpm test:api` verde (todas as suítes unit).
- `pnpm test:api:e2e` verde (exige `pnpm test:setup` + `pnpm dev:api:test`).
- `pnpm test:api:cov` rodado; gaps remanescentes (se houver módulo grande) registrados no commit
  como follow-up, não silenciados.

## Fora de escopo

- Threshold de cobertura travado em CI.
- Reescrever specs existentes que já passam.
- Módulos novos ainda não mergeados (payable/activity das stories 47/48 trazem seus próprios specs).
