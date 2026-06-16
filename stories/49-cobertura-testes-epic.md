# Plan: Revisão e cobertura de testes — todos os apps e services (EPIC)

## Context

Hoje a cobertura de testes do monorepo é desigual e há buracos grandes:

| Workspace | Unit | E2E | Lacuna |
|---|---|---|---|
| `services/api` | ✅ Jest (37 specs) | ✅ supertest (19 specs) | sem tooling de cobertura mínima garantida; módulos sem spec |
| `adm.fonte` | ❌ nenhum | ✅ Playwright (15 specs) | **zero unit** (hooks, lib, componentes) |
| `associados` | ❌ nenhum | ❌ nenhum | **nenhum teste** — app inteiro descoberto |
| `ops.fonte` | ❌ nenhum | ⚠️ Maestro (exige emulador) | **zero unit**; e2e preso a emulador nativo (bloqueio recorrente — ver PROGRESS stories 19/25) |
| `app.fonte` | ❌ nenhum | ⚠️ Maestro (exige emulador) | **zero unit**; e2e preso a emulador |
| `packages/api-client` | ❌ nenhum | — | sem teste do cliente HTTP compartilhado |
| `packages/types` / `doc-styles` | ❌ | — | só tipos/CSS — sem unit relevante (fora de escopo) |

Decisões travadas com o usuário (`/issue`):

- **Estrutura = epic + sub-stories por workspace.** Esta story (49) é o epic: define o
  **padrão de testes** comum, atualiza a skill `issue` e o `AUTORUN.md`, e enumera as filhas
  50–55. Cada filha entrega o tooling + baseline de **um** workspace, valida sozinha e só
  fecha verde.
- **Profundidade = subir o piso, não perseguir % agora.** Cada filha instala/configura o tooling
  onde falta e escreve testes **baseline**: smoke (monta/renderiza sem crash) + caminhos
  críticos do domínio. A cobertura cresce dali em diante via a nova regra do `/issue` (toda
  issue futura atualiza testes). **Não** se persegue threshold numérico nesta entrega.
- **Apps Expo testados no modo web, sem emulador.** `ops.fonte` e `app.fonte` passam a ter:
  - **unit** com `jest-expo` + `@testing-library/react-native` (jsdom, roda em CI sem device);
  - **e2e web** com Playwright contra o build web do Expo (`expo export --platform web` →
    servido localmente), espelhando o setup do `adm.fonte`. O Maestro existente **não é
    removido** (fica como e2e nativo opcional), mas deixa de ser o único e2e e não bloqueia o
    DoD — o gate de merge passa a usar o e2e web.
- **Frameworks por tipo de app:**
  - Apps web (`adm.fonte`, `associados`) e packages: **Vitest** + (web) `@testing-library/react`
    + `jsdom`. e2e web = **Playwright**.
  - Apps Expo (`ops.fonte`, `app.fonte`): **jest-expo** + `@testing-library/react-native`
    (unit). e2e web = **Playwright** contra o export web.
- **Manutenção da cobertura é regra permanente.** A skill `issue` passa a exigir atualização de
  testes em toda issue; o `AUTORUN.md` passa a exigir suíte verde antes de qualquer merge na main
  e a tratar "testes passando" como critério de conclusão (DoD).

Trade-offs aceitos: baseline ≠ cobertura alta — aceitamos piso modesto agora com crescimento
incremental. Maestro permanece no repo como e2e nativo opcional (não apagar trabalho existente),
mas o gate efetivo dos apps Expo passa a ser o e2e web (determinístico, sem device). Não se mede
threshold de cobertura no CI nesta fase (vira follow-up se o usuário pedir).

## Desenho

### Deliverables do epic (nesta story, antes das filhas)

1. **Padrão de testes** documentado na skill `fonte-workflow`
   (`.claude/skills/fonte-workflow/SKILL.md`): qual runner por tipo de workspace, onde ficam os
   arquivos (`*.test.ts(x)` colocados ao lado do código nos fronts; `*.spec.ts` no backend já é
   convenção), comandos `pnpm test:*`, e a regra "toda mudança atualiza os testes".
2. **Scripts raiz `pnpm test:*`** completados no `package.json` da raiz para cada workspace:
   - novos: `test:adm:unit`, `test:associados`, `test:associados:e2e`, `test:ops:unit`,
     `test:ops:e2e`, `test:app:unit`, `test:app:e2e`, `test:api-client`.
   - um agregador `test:all` que roda as suítes unit de todos os workspaces (e2e fica sob demanda
     por exigir serviços/builds no ar).
   *(Os scripts são adicionados pelas filhas conforme cada tooling entra; o epic só reserva os
   nomes e o agregador.)*
3. **Atualização da skill `issue`** (`.claude/skills/issue/SKILL.md`): toda issue futura **deve**
   criar/atualizar os testes correspondentes (unit + e2e quando houver fluxo) para manter a
   cobertura; passo 6 (Validar) e a seção "Proibido" reforçados; DoD inclui suíte verde.
4. **Atualização do `AUTORUN.md`**: antes de **qualquer** merge na main, rodar a suíte de testes
   da área tocada e exigir **tudo verde**; "atividade concluída" = implementada **e** testes
   passando. Generalizar o arquivo (hoje é específico das stories 21–25) para o protocolo de
   teste-antes-do-merge.

### Sub-stories (filhas)

| NN | Workspace | Entrega |
|---|---|---|
| **50** | `services/api` | Auditoria de cobertura: mapear módulos sem `*.spec.ts`/sem e2e e preencher baseline (service unit + e2e supertest do endpoint). `pnpm test:api:cov` como referência de gaps. |
| **51** | `adm.fonte` | Tooling **unit** (Vitest + RTL web + jsdom) + baseline (lib puras, 1–2 hooks com QueryClient, 1 componente). Playwright e2e já existe — revisar smoke. `test:adm:unit`. |
| **52** | `associados` | Do zero: Vitest + RTL + Playwright. Unit das libs (`cardTokenizer`, gross-up preview, schema) + e2e web do fluxo público (token válido/inválido, preview do gross-up, submit com tokenizer stub). |
| **53** | `ops.fonte` | Unit (jest-expo + RTL native) baseline (hooks, libs `inventoryUtils`, 1 componente) + **e2e web** (Playwright contra `expo export` web) cobrindo login + 1 fluxo. Maestro mantido como opcional. |
| **54** | `app.fonte` | Unit (jest-expo + RTL native) baseline + **e2e web** (Playwright) cobrindo login + home/checkin. Maestro mantido como opcional. |
| **55** | `packages/api-client` | Unit (Vitest) do cliente HTTP: monta recursos, repassa params, trata erro — com `axios`/fetch mockado. |

Cada filha tem seu próprio `stories/NN-*.md` com Context/Desenho/Validação/Fora de escopo, segue
o fluxo `/issue` (branch própria, valida, arquiva, merge sob confirmação) e **fecha só com a
própria suíte verde**.

### Ordem sugerida

```
49 (epic: padrão + skill + AUTORUN) → 55 (api-client, isolado) → 51 (adm unit) →
52 (associados) → 50 (api gaps) → 53 (ops web) → 54 (app web)
```

`55` e `51` primeiro porque destravam o padrão Vitest reaproveitado por `52`. `53`/`54` (Expo web)
por último por exigirem o setup de export web + Playwright mais elaborado.

## Validação

Do **epic** (esta story):

- `.claude/skills/fonte-workflow/SKILL.md`, `.claude/skills/issue/SKILL.md` e `stories/AUTORUN.md`
  atualizados e coerentes entre si (mesma regra de teste-antes-do-merge).
- Scripts raiz reservados sem quebrar `pnpm install` (`test:all` pode existir agregando o que já
  há; cresce conforme as filhas).
- Nenhuma regressão: `pnpm test:api` continua verde após mexer só em docs/skills/scripts.

Cada **filha** valida sua própria suíte (ver o `.md` da filha). O epic só fecha quando o padrão e
as duas atualizações de processo (skill + AUTORUN) estão no lugar; as filhas podem ser entregues
incrementalmente depois.

## Fora de escopo

- Threshold/percentual de cobertura travado em CI (vira follow-up se pedido).
- Remover os fluxos Maestro existentes (ficam como e2e nativo opcional).
- Testes de `packages/types` e `packages/doc-styles` (só tipos/CSS — sem unit relevante).
- Pipeline de CI (GitHub Actions etc.) — esta entrega prepara os comandos; orquestração de CI é
  outra story.
- Testes visuais/snapshot de UI e testes de performance/carga.
