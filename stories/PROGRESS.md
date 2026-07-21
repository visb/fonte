# PROGRESS — stories 135–141 (assinatura nos documentos + editor de templates)

Ordem: 135 → 136 → 137 → 138 → 139 → 140 → 141. Fonte de verdade: esta seção + git log.

**Config da rodada**

- **Branch base:** `main` (cada branch parte da main ATUAL, já com o merge da anterior).
- **Prefixo de branch:** `feat/story-NN-<slug>`.
- **Deps rígidas** (se a de cima bloquear, a de baixo bloqueia junto — não pular):
  - **140 → 139** (drag-and-drop usa a `VariablesPanel` da 139 como fonte de arraste). Se 139
    bloquear, 140 bloqueia junto.
  - **135, 136, 137** tocam o MESMO arquivo (`document-template.service.ts` + spec). Não é dep
    rígida de lógica, mas devem ir **em ordem** (135→136→137): cada branch parte da main já com o
    merge da anterior, evitando conflito. Não paralelizar.
  - 138 e 141 independentes (141 é editor-only; não altera o texto `{{signature}}`, então não
    quebra o render das 135/136/137).
- **Cuidados da rodada:**
  - **Sem migration nova** em nenhuma das 7. `staff.signature_url` já é nullable (story 128) — a 138
    só seta `null`, sem schema. Última migration aplicada: `1783037200000-UserPreferences` (+ as da
    128, ver `staff` `signature`). Se algo exigir schema, **parar e registrar** — não improvisar.
  - **Contratos** (`packages/types`/`api-client`): só a **138** muda (adiciona
    `removeMySignature` no módulo staff do api-client). Ao mudar: `pnpm build:types && pnpm
    build:api-client` e refletir no Postman. As demais NÃO tocam contrato.
  - **Postman:** só a **138** adiciona endpoint (`DELETE /staff/me/signature`). Atualizar
    `fonte-api.postman_collection.json`. As outras 6 não mexem em API.
  - **135:** fix backend, modo não-S3 → data URI da assinatura (helper em `StorageService`). Não
    mexer no fluxo de imagem de conteúdo (já funciona). S3 intacto.
  - **136:** substituir `<p …>{{signature}}</p>` inteiro carregando `text-align`; `.doc-signature-img`
    vira `inline-block`. Preservar fallback do token inline.
  - **137:** remover role + bold do nome no bloco; limpar plumbing órfão só se seguro (relation
    `['user']`/`ROLE_LABEL_PT` — na dúvida, manter).
  - **139/140/141:** frontend adm-only (`features/settings`), sem backend/contrato. 141 usa
    **decoration do ProseMirror** — o doc mantém `{{signature}}` literal (guarda: `getHTML()` ainda
    contém `{{signature}}`).
  - **Gate de cobertura ≥ 90** no pacote tocado, sem `skip`/`only`/`xfail` injustificado.
  - **DnD (140) e paginação (141)** podem não ser cobríveis por Playwright de forma confiável —
    extrair lógica pura e cobrir por unit; documentar no ledger se o e2e não simular.

## Fila

| Ordem | Story | Status | Testes | Commit | Merge |
| --- | --- | --- | --- | --- | --- |
| 1 | 135 — assinatura URL quebrada no PDF local (data URI) | [OK] | api unit 1261/1261 · doc-templates e2e 21/21 · cov escopo 100% (toDataUri) | 8a3f35a | (merge abaixo) |
| 2 | 136 — assinatura honra alinhamento no PDF | [OK] | api unit 1268/1268 · doc-templates e2e 21/21 (7 casos novos) · cov escopo 100% | 3f1dbeb | (merge na main) |
| 3 | 137 — assinatura só nome (sem role, sem bold) | [OK] | api unit 1269/1269 · e2e 485/485 (doc-templates 21/21) · código tocado 100% | e69a745 | (merge na main) |
| 4 | 138 — botão redefinir assinatura no perfil (DELETE endpoint) | [OK] | api unit 1273/1273 · api e2e 487/487 (staff 26/26) · api-client 265/265 · adm unit 1302/1302 · cov novos 100% | 889a070 | (merge na main) |
| 5 | 139 — barra de variáveis colapsável fixa à direita | [ ] | | | |
| 6 | 140 — drag-and-drop das variáveis para o editor | [ ] | | | |
| 7 | 141 — placeholder do {{signature}} no editor (decoration) | [ ] | | | |

## Log

Entrada curta — máx. ~3 linhas. Detalhe rico vai no corpo do commit ou no `.md` arquivado.

[OK|PARCIAL|BLOQUEADO] NN — testes: <resumo> — commit: <hash> — merge: <hash> — <data> — <bloqueio se houver>

[OK] 135 — testes: api unit 1261/1261 · document-templates e2e 21/21 (afirma `data:image/png;base64,` e
ausência de `/uploads/` no bloco de assinatura) · cov escopo novo 100% (toDataUri+mime) — commit: 8a3f35a
— merge: (na main via --no-ff) — 2026-07-21. Helper `StorageService.toDataUri` (não-S3 + `/uploads/` →
`download()` + data URI, mime por extensão); `resolveSigner` ramo não-S3 usa o helper; S3 e imagem de
conteúdo intactos. Sem migration/contrato/Postman.

[OK] 136 — testes: api unit 1268/1268 · document-templates e2e 21/21 (7 casos: center/right/left, sem-align,
inline fallback, sem-assinatura, CSS inline-block) · cov escopo novo 100% — commit: 3f1dbeb — merge: (main
--no-ff) — 2026-07-21. `applyVariables` troca `<p …>{{signature}}</p>` inteiro carregando `text-align` p/
`buildSignatureBlock(signer, align)`; fallback do token nu mantido; `.doc-signature-img` → inline-block. Fix
135 (data URI) preservado.

[OK] 137 — testes: api unit 1269/1269 · e2e 485/485 (doc-templates 21/21) · código tocado 100% — commit:
e69a745 — merge: (main --no-ff) — 2026-07-21. `buildSignatureBlock` deixou de emitir `.doc-signature-role`;
CSS `.doc-signature-name` → font-weight:normal e regra `.doc-signature-role` removida. Plumbing órfão
REMOVIDO com segurança: `DocumentSigner.role`, `ROLE_LABEL_PT`, `import Role`, `relations:['user']` (grep
confirmou sem outros usos). Fixes 135/136 intactos.

[OK] 138 — testes: api unit 1273/1273 · api e2e 487/487 (staff 26/26) · api-client 265/265 (contratos 190)
· adm unit 1302/1302 · cov: staff.service 91.9% / controller 100% / componentes novos adm 100% — commit:
889a070 — merge: (main --no-ff) — 2026-07-21. `DELETE /staff/me/signature` idempotente (removeSignatureMe:
delete arquivo + signatureUrl=null); api-client `removeMySignature` (types+api-client rebuildados); hook
`useRemoveMySignature`; SignatureSection botão "Redefinir" + `RemoveSignatureDialog` (AlertDialog). Postman
atualizado. Sem migration.

## Resumo final

<pendente — rodada em andamento>
