# PROGRESS — ledger ativo

Rodada de autorun **213** — aberta em 2026-10-19.

## Config da rodada

- **Tema:** app `release.fonte` (download do APK do ops + changelog) com pipeline de release no CI e skill `/release`.
- **Ordem:** 213
- **Branch base:** `main`. Branch: `feat/story-213-app-release`.
- **Deps rígidas:** nenhuma.
- **Escopo técnico por story:** novo app `apps/release.fonte` (Vite/React, sem API); `apps/ops.fonte/app.config.js` (versionCode + signing por env); `scripts/release/`; `.github/workflows/release.yml` + `ci.yml`; `Dockerfile` stage `web`; `docker/nginx/*.conf`; skill `.claude/skills/fonte-release/`; scripts raiz (`dev:release`, `build:release`, `test:release`, `test:release:e2e`, `test:cov:all`). Sem migration, sem contratos, sem Postman.
- **Cuidados da rodada:**
  - Sem credencial: keystore de release, secrets do GitHub, DNS/cert do `release.` e execução real do `release.yml` ficam **PENDENTE-MANUAL** — implementar com leitura por env + fallback debug; nunca gerar/commitar keystore nem segredo.
  - `android/` é CNG — assinatura via config plugin/`app.config.js`, nunca editar manifest/gradle gerado.
  - Não reduzir cobertura do `ops.fonte`; `release.fonte` entra no `test:cov:all` com piso 90.
  - Smoke do APK local é opcional na rodada (ambiente Windows); não bloqueia se toolchain Android indisponível — registrar.
  - Disciplina de shell do CLAUDE.md (Write/Edit, `git commit -F`).

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 213 — App release.fonte: distribuição do APK e changelog | [ ] | | | |

## Log

## Resumo final

<vazio até o fim da rodada>
