# PROGRESS — rodada 213

Rodada de autorun **213** — aberta em 2026-10-19, encerrada em 2026-10-19.

## Config da rodada

- **Tema:** app `release.fonte` (download do APK do ops + changelog) com pipeline de release no CI e skill `/release`.
- **Ordem:** 213
- **Branch base:** `main`. Branch: `feat/story-213-app-release`.
- **Deps rígidas:** nenhuma.
- **Escopo técnico por story:** novo app `apps/release.fonte`; `apps/ops.fonte/app.config.js` (versionCode + signing por env); `scripts/release/`; `.github/workflows/release.yml` + `ci.yml`; `Dockerfile` stage `web`; nginx; skill `.claude/skills/fonte-release/`. Sem migration, sem contratos, sem Postman.
- **Cuidados da rodada:** keystore/secrets/DNS/cert/execução real do `release.yml` = PENDENTE-MANUAL; `android/` é CNG; não reduzir cobertura do ops; `release.fonte` no `test:cov:all` com piso 90.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 213 — App release.fonte: distribuição do APK e changelog | [OK] | release 56/56 (100%), e2e 4/4, scripts 47/47 (99,2% br), ops 1587/1587 | 930c8da | fe497d3 |

## Log

[OK] 213 — testes: release unit 56/56 cov 100; e2e 4/4; scripts 47/47; ops unit 1587/1587 (1 run com 4 flakes, 2 seguintes verdes) — commit: 930c8da — merge: fe497d3 — 2026-10-19
PENDENTE-MANUAL: keystore + secrets `OPS_KEYSTORE_BASE64/OPS_KEYSTORE_PASSWORD/OPS_KEY_ALIAS/OPS_KEY_PASSWORD`; DNS cinza `release.` + certbot; ensaio real do `release.yml`; teste em aparelho (instalar por cima); dry-run da skill; ligar pacote `fonte-apk` do GHCR ao repo.
Nota: server nginx do `release.` é opcional — `docker/nginx/enable-sites.sh` só habilita com cert presente (mudou `command` do nginx no `docker-compose.prod.yml`).

## Resumo final

- **Passou:** 213, mergeada na `main` (`fe497d3`), arquivada em `stories/done/`. Branch `feat/story-213-app-release` preservada.
- **PENDENTE-MANUAL:** ver Log. Nada BLOQUEADO.
- **Gates para reproduzir:** `pnpm test:release`, `pnpm test:release:e2e`, `pnpm test:release:scripts`, `pnpm test:ops:unit:cov`, `pnpm build:release`, `docker build --target web .`
- **Follow-up:** `fonte-project-map` não cita `release.fonte` ainda; investigar flakes intermitentes no `test:ops:unit`.
