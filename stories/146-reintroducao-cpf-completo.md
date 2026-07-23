# Plan: Reintrodução — exibir CPF completo nos dados não editáveis

## Context

Bloco **App adm → Reintrodução de acolhido** do BACKLOG. Contexto compartilhado com as stories
147 e 148 (mesmo fluxo de reintrodução, tela `ReadmissionForm`).

No banner "Dados de identificação — não editáveis" da tela de reintrodução
(`apps/adm.fonte/src/features/residents/components/ReadmissionForm.tsx:159`), o CPF aparece
truncado — só os 5 primeiros dígitos (ex: `123.45`). Deveria mostrar o CPF completo.

Decisão travada com o usuário: **é bug de exibição, não dado truncado.** O CPF completo está no
banco; a tela é que trunca. A story deve caçar e corrigir o ponto de truncamento.

Investigação já feita no planning (pistas para a implementação):

- A tela usa `maskCPF(resident.cpf)`. `maskCPF` (`apps/adm.fonte/src/lib/masks.ts:8`) formata
  corretamente os 11 dígitos — não é a fonte do truncamento isolada.
- `resident` vem de `useResidentById` → `GET /residents/:id`. O `findOne`
  (`services/api/src/modules/resident/resident.service.ts:196`) retorna a entidade inteira, **sem
  mask de CPF**. Nenhum `@Transform`/`@Exclude` sobre `cpf`.
- Nenhuma máscara parcial / `slice(0,5)` / mask LGPD de CPF foi encontrada no `adm.fonte`.

Como o código lido já exibiria o CPF inteiro, a implementação **precisa reproduzir** o bug com um
filho readmissível real (status `DISCHARGED` ou `EVADED`) para localizar o truncamento (candidatos:
o valor que `resident.cpf` realmente chega no cliente; algum ponto de mapeamento no `@fonte/api-client`
ou no `useResidentById`; dupla aplicação de máscara). **Atenção:** o `.env` local do api aponta para
o banco de **produção** — reproduzir em ambiente de teste/seed, nunca consultando produção.

Fallback: se, ao reproduzir, o CPF do filho estiver **de fato** truncado no banco (dado ruim de
import antigo), o conserto de exibição vira no-op e a correção real do dado passa a depender da
story 147 (editar os "dados não editáveis"). Registrar isso na PR se for o caso.

## Desenho

1. Reproduzir num filho readmissível de teste com CPF completo, confirmando onde o valor perde
   dígitos entre `GET /residents/:id` e o render do banner.
2. Corrigir o ponto de truncamento para que o banner exiba os 11 dígitos formatados
   (`000.000.000-00`) sempre que o `cpf` completo existir.
3. Manter o comportamento atual quando `cpf` for `null` (o bloco CPF não renderiza — linha 156).

Escopo é frontend-only (`adm.fonte`), a menos que a reprodução prove que o truncamento nasce no
backend/`api-client` — nesse caso corrigir na origem e ajustar o contrato.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** (`pnpm --filter adm.fonte test:cov` verde e cobertura ≥90 do código tocado; se
tocar backend/`api-client`, `pnpm test:api:cov` + `pnpm build:types`/`build:api-client`).

- Unit (`ReadmissionForm.test.tsx`): dado um `resident` com `cpf` de 11 dígitos, o banner
  "não editáveis" exibe o CPF completo formatado `000.000.000-00` (não os 5 primeiros dígitos).
- Unit: `resident.cpf === null` → bloco CPF não renderiza.
- Se o truncamento estiver no `api-client`/backend: teste na camada de origem cobrindo que o
  `cpf` completo trafega intacto.

## Fora de escopo

- Permitir editar os dados não editáveis (story 147).
- Status inicial da reintrodução (story 148).
- Qualquer mask/ocultação de CPF por LGPD.
