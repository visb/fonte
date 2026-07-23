# Plan: Reintrodução — exibir CPF completo nos dados não editáveis

## Context

Bloco **App adm → Reintrodução de acolhido** do BACKLOG. Contexto compartilhado com as stories
147 e 148 (mesmo fluxo de reintrodução, tela `ReadmissionForm`).

No banner "Dados de identificação — não editáveis" da tela de reintrodução
(`apps/adm.fonte/src/features/residents/components/ReadmissionForm.tsx:159`), o CPF aparece
truncado (ex: `789.00`). Deveria mostrar o CPF completo (quando o solicitante tem direito de vê-lo).

**Causa-raiz confirmada no planning — double-mask (redator + formatador):**

- Backend tem proteção LGPD (`SensitiveDataInterceptor` +
  `services/api/src/common/lib/mask.ts`). `maskCpf` **redige** o documento:
  `12345678901` → `***.***.789-00`; `maskRg` → `***XX`.
- `GET /residents/:id` (`resident.controller.ts:273`) é `@RevealSensitive()`: **ADMIN/COORDINATOR
  recebem o CPF/RG completos; SERVANT recebe redigido.**
- No frontend, `maskCPF`/`maskRG` (`apps/adm.fonte/src/lib/masks.ts`) são **formatadores** (dígitos
  crus → `000.000.000-00`), não redatores — nome colide com o do backend. O banner aplica
  `maskCPF(resident.cpf)` sobre um valor que **já vem pronto do backend**. Quando vem redigido
  (`***.***.789-00`), o formatador tira os não-dígitos (`78900`, 5 dígitos) e devolve `789.00` —
  exatamente o bug relatado. Para SERVANT o CPF nunca poderá ser completo (é LGPD, correto); para
  ADMIN/COORDINATOR o valor completo chega, mas o double-mask ainda pode reformatá-lo errado.

Decisão travada: o conserto é **não reaplicar o formatador sobre valor já resolvido pelo backend**.
O banner deve renderizar `resident.cpf`/`resident.rg` como vieram, formatando **apenas** quando
forem dígitos crus completos (CPF 11 dígitos / RG cru), e exibindo as-is quando já vierem redigidos
(`*`) ou já formatados. Não remover a proteção LGPD: SERVANT continua vendo o CPF redigido — isso é
esperado, não é o bug.

## Desenho

1. No banner de `ReadmissionForm`, parar de reaplicar `maskCPF`/`maskRG` cegamente. Renderizar o
   valor do backend, formatando só quando for dígito cru completo:
   - se `cpf` contém `*` → exibir como veio (redigido pelo backend);
   - se `cpf` são 11 dígitos crus → formatar `000.000.000-00`;
   - caso contrário → exibir como veio.
   - RG análogo.
2. Preferir extrair um helper de exibição (ex: `displayCpf`/`displayRg` em `lib/masks.ts`) para não
   espalhar o `if`, e para reuso por outras telas que sofram do mesmo double-mask.
3. Resultado: ADMIN/COORDINATOR veem o CPF completo formatado; SERVANT vê o redigido do backend;
   nunca aparece o `789.00` truncado.

Escopo frontend-only (`adm.fonte`). Backend já entrega o valor correto por role — não mexer no
interceptor nem no `@RevealSensitive`.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado. Gate: **código novo sem teste
não fecha a story** (`pnpm --filter adm.fonte test:cov` verde e cobertura ≥90 do código tocado).

- Unit no helper de exibição (`masks.test.ts` ou equivalente):
  - `cpf` 11 dígitos crus → `000.000.000-00`;
  - `cpf` já redigido `***.***.789-00` → devolvido as-is (não vira `789.00`);
  - `cpf` `null` → tratado;
  - RG cru → formatado; RG redigido `***XX` → as-is.
- Unit (`ReadmissionForm.test.tsx`): resident com `cpf` completo → banner mostra CPF completo;
  resident com `cpf` redigido (SERVANT) → banner mostra o redigido, nunca `789.00`.

## Fora de escopo

- Permitir editar os dados não editáveis (story 147).
- Status inicial da reintrodução (story 148).
- Alterar a política LGPD de redação/`@RevealSensitive` — a redação para SERVANT é intencional.
