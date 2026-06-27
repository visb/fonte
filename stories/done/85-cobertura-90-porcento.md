# Epic: Cobertura de testes — subir o piso de 80% → **90%** por pacote

> **Epic guarda-chuva.** Sequência do epic **78** (que travou 80%). Define meta, estratégia e a fila
> de filhas. **Não escreve testes** — o trabalho vive nas filhas **86–91**. Mesma honestidade de
> medição do 78. Mergeie as filhas por pacote (independentes); **91 (gate) por último**.

## Context

O epic 78 levou todos os pacotes a ≥ 80% statements e travou o gate CI (story 83 / `test:cov:all` +
`.github/workflows/ci.yml`). O objetivo agora é elevar a rede para **90%**, fechando os ramos que
ficaram fora na primeira passada: branches de erro, validações, variações de role/estado, caminhos
menos felizes. Nada de produção muda — é rodada de TESTES.

### Baseline atual (verificado 2026-06-26, gate `pnpm test:cov:all` verde no piso de 80%)

| Pacote | Stmts hoje | Coberto/Total | Δ p/ 90% | ~Stmts a cobrir | Filha | Runner |
|---|---:|---:|---:|---:|---|---|
| **services/api** | 81.69% | 4359/5336 | +8.3 pp | ~444 | **86** | jest |
| **adm.fonte** | 80.02% | 10314/12888 | +10.0 pp | ~1286 | **87** | vitest |
| **ops.fonte** | 81.4% | 1545/1898 | +8.6 pp | ~163 | **88** | jest-expo |
| **app.fonte** | 83.77% | 284/339 | +6.2 pp | ~21 | **89** | jest-expo |
| **portal.fonte** | 83.17% | 717/862 | +6.8 pp | ~59 | **90** | vitest |
| **@fonte/api-client** | 99.06% | 741/748 | já ≥ 90% | — (só travar) | **90** | vitest |

Maior esforço: **adm** (~1.3k statements) e **api** (~440). `api-client` já em 99% — só subir a
catraca. `app`/`portal`/`ops` são gaps pequenos.

> **Caveat — exclusão não é cobertura (herdado do 78).** O denominador já exclui orquestração (web
> `pages/**`; RN rotas `app/**`+`_layout`; `sentry.ts`/`instrument.ts`; barrels; `*.d.ts`; `main`).
> **Não ampliar exclusões para inflar o %.** Nova exclusão é re-baseline (mede o novo ponto antes de
> contar progresso), nunca progresso. O número que conta é `lib`/`hooks`/`components`/`services`.

## Meta

Piso de **90% de statements** por pacote, sem regredir branches/functions/lines, travado via
`coverageThreshold` (jest) / `coverage.thresholds` (vitest) e gateado em CI. Subida por **catraca**:
cada filha sobe o piso ao valor atingido — **nunca desce**.

## Estratégia (vale para todas as filhas — igual 78)

- **Pirâmide por ROI:** 1) lógica pura (`lib`, schemas zod, `queryKeys`, formatadores) — unit puro;
  2) hooks (`QueryClientProvider` de teste + mock central do `@fonte/api-client`); 3) componentes de
  apresentação (RTL web / `@testing-library/react-native`), foco em branches de render
  (loading/empty/error, variantes de badge/card) e submit de form (rhf+zod / `Controller`);
  4) backend: services unit com repos mockados — ramos de erro, validação, transição de status,
  permissões/role; controllers finos via delegação.
- **Pages/Screens de orquestração NÃO são alvo de unit** — cobertos por E2E (Playwright web /
  Maestro RN) e já **excluídos do denominador**.
- **Sem baixar a meta com teste de fumaça.** Arquivo que não chega a 90% sem testar orquestração vai
  para `exclude` **com comentário justificando** — proibido inflar com teste sem assert (CLAUDE.md).
- **TESTES-ONLY.** Nenhuma mudança de produção/contrato/DTO/endpoint/migration/Postman. Refactor
  mínimo de testabilidade (extrair lógica de tela p/ hook/lib) é permitido se citado no commit.

## Catraca / gate CI (entregue na 91)

Quando todos os pacotes atingirem 90%, travar `coverageThreshold`/`thresholds` em **statements: 90**
(branch/function/lines no valor atingido) e garantir que `pnpm test:cov:all` + CI falham abaixo do
novo piso. Atualizar a nota de catraca em `CONTRIBUTING.md` + skill `fonte-workflow` (80 → 90).

## Stories filhas

| # | Escopo | Δ pp | ~Stmts | Risco |
|---|---|---:|---:|---|
| **86** | `services/api` 81.69 → 90% | +8.3 | ~444 | Alto (regra de domínio) |
| **87** | `adm.fonte` 80.02 → 90% — sub-fases por feature (87a, 87b, …) | +10.0 | ~1286 | Muito alto |
| **88** | `ops.fonte` 81.4 → 90% (RN) | +8.6 | ~163 | Médio |
| **89** | `app.fonte` 83.77 → 90% (RN) | +6.2 | ~21 | Baixo |
| **90** | `portal.fonte` 83.17 → 90% + `api-client` 99 → 90% (só travar) | +6.8/— | ~59 | Baixo |
| **91** | Catraca global 90% + gate CI (depende de 86–90) | — | — | Baixo |

- **86–90 são independentes** (cada uma toca só o seu pacote) — reordenáveis/puláveis sem travar a
  fila. **91 depende de TODAS ≥ 90%**; se alguma ficar abaixo, travar threshold parcial das prontas
  e registrar BLOQUEADO a(s) pendente(s).

## Fora de escopo (epic)

- Escrever os testes em si — vive nas filhas.
- `resident.fonte` (não scaffoldado); `@fonte/types`/`@fonte/doc-styles` (só tipos/CSS).
- Mudar infra de teste (S3/MinIO, PDF/puppeteer) ou contrato/endpoint/migration.

## Validação (epic)

- Cada `*:cov` roda e reporta o número real (baseline na tabela).
- Filhas 86–90 mergeadas sem regressão de piso; **91 ativa o gate a 90%**.
- `pnpm test:cov:all` verde com thresholds em statements:90; regressão proposital quebra o build.
