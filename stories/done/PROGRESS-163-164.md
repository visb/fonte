# PROGRESS — rodada 163-164 (encerrada)

Rodada de `/autorun` executada em 2026-08-08. Protocolo: `stories/AUTORUN.md`.

## Config da rodada

- **Tema:** assinatura por upload (163) + carnê por acolhimento (164)
- **Ordem:** 163 → 164
- **Branch base:** `main` (72b249d)
- **Deps rígidas:** nenhuma — stories independentes.
- **Dependências externas sem credencial:** nenhuma.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 163 — enviar imagem como assinatura (upload) no perfil | [OK] | adm unit 1583/1583, e2e 172/172 | 553c2dd | a16e793 |
| 2 | 164 — carnê de contribuição por acolhimento | [OK] | api 1436/1436, api e2e 511/511, adm unit 1603/1603, e2e adm 173/173 | 1843a9e | c2c3c24 |

## Log

```
[OK] 163 — testes: adm unit 1583/1583 (features/auth 98.78% stmts), e2e adm 172/172 — commit: 553c2dd — merge: a16e793 — 2026-08-08
     nota: decodeImageFile precisou de fallback createImageBitmap → <img> (Chromium recusa PNG válido com InvalidStateError).
[OK] 164 — testes: api 1436/1436 + cov (resident-receivable 96.55% st, resident 93.88% st), api e2e 511/511,
     adm unit 1603/1603 (features/residents 98.87% st), e2e adm 173/173; migration up+revert limpos — commit: 1843a9e — merge: c2c3c24 — 2026-08-08
     nota: 1º spawn cortado pelo limite de sessão antes do Playwright; retomado do working tree no disparo seguinte.
```

## Resumo final

**Ambas as stories entregues, verdes e mergeadas na `main` local. Nada bloqueado, nada
PENDENTE-MANUAL. Sem push e sem PR** (conforme AUTORUN).

### 163 — upload de imagem como assinatura (frontend-only, `apps/adm.fonte`)

`SignatureDialog` virou abas "Desenhar" | "Enviar imagem" (abre em Desenhar, troca de aba não perde
trabalho, salva o blob da aba ativa). Novos: `signatureImage.ts` (funções puras — validação,
`scaledDimensions`, `removeBackground` por luminância com feather), `SignatureUploadPad`,
`SignatureDrawPad`, `SignatureDropzone`, `SignatureBackgroundControls`. Backend, api-client e
Postman intocados (`POST /staff/me/signature` idêntico).

- **Desvio registrado:** `decodeImageFile` ganhou fallback `createImageBitmap` → `<img>`. O e2e
  provou que o Chromium recusa PNG legítimo com `InvalidStateError`; sem o fallback, imagem válida
  de usuário seria rejeitada. Ambos os ramos têm teste.

### 164 — carnê de contribuição por acolhimento

Coluna `admission_id` (nullable) em `resident_receivables` + backfill por janela de datas
(migration `1783037400000`); resolver único (`admission-resolution.ts`) reusado na escrita e no
backfill, tolerando `exit_date < entry_date`; "acolhimento atual" passa a ser resolvido por
`entry_date DESC NULLS LAST, created_at DESC` (causa C); `recalc/cancelFuturePending` e
`cancelAfterExit` deixam de tocar parcela de acolhimento encerrado. Na aba Contribuições:
`ContributionAdmissionSelector` (só com 2+ acolhimentos), acolhimento anterior somente leitura, e
estado vazio com CTA "Alterar plano" quando o acolhimento atual está sem plano.

- **Atenção operacional:** a migration está aplicada **só no banco de teste**; em produção o
  backfill roda no deploy.
- **Fora de escopo (decisão 12), continua pendente de ação manual:** as 4 parcelas de 2025 pagas
  por engano no acolhimento encerrado do Marcelo seguem sujas — ajustar pela UI depois do deploy,
  quando o carnê do acolhimento atual existir.

### Reproduzir os gates

```bash
pnpm docker:up
pnpm build:types && pnpm build:api-client
pnpm test:setup                          # migration:run:test + seed (inclui filho de 2 acolhimentos)
pnpm test:api:cov
pnpm dev:api:test                        # terminal separado, porta 3001
pnpm test:api:e2e
pnpm --filter api seed:test              # re-seed OBRIGATÓRIO: o e2e da API limpa o banco
pnpm --filter adm.fonte dev:test         # terminal separado, porta 5174
pnpm --filter adm.fonte test:unit:cov
pnpm test:adm
```

**Ordem que importa:** `test:api:e2e` zera o banco de teste — rodar `seed:test` de novo antes do
Playwright, senão `bulk-import.spec.ts` e `residents.spec.ts` ("declara produtos") falham por falta
de `inventory_items`, e não por regressão.

### Branches (preservadas, sem push)

- `feat/story-163-upload-imagem-assinatura` → merge `a16e793`
- `fix/story-164-contribuicoes-por-acolhimento` → merge `c2c3c24`
