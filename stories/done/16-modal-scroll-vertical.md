# Plan: Rolagem vertical no corpo de modais quando conteúdo excede a altura da tela

## Context

Vários modais (ex.: editar na página de detalhes da casa) cortam o conteúdo quando a altura da viewport é menor que a altura total do modal. O `DialogContent` é centralizado com `translate-y-[-50%]` e não limita a altura nem oferece scroll — então o topo/base do conteúdo fica inacessível.

Corrigir de forma global no componente base `DialogContent` para beneficiar todos os modais.

---

## Arquivo principal

`apps/adm.fonte/src/components/ui/dialog.tsx`

## Mudança

Limitar a altura do `DialogContent` e permitir scroll interno. Classe atual:

```
fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg ...
```

Adicionar `max-h-[90dvh] overflow-y-auto` (ou `max-h-[calc(100dvh-2rem)]`):

```tsx
className={cn(
  'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg max-h-[90dvh] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 ...',
  className,
)}
```

### Decisão — abordagem mínima (scroll no container)

**Decidido: abordagem mínima.** `max-h-[90dvh] overflow-y-auto` no `DialogContent` inteiro resolve o corte reportado. Botão X (`absolute right-4 top-4`) rola junto com o conteúdo — aceitável.

O wrapper `DialogBody` com header/footer fixos (`flex flex-col` + `shrink-0`) **não** entra nesta story — fica como melhoria futura, pois exigiria tocar todos os modais que hoje colocam form direto no `DialogContent`.

### AlertDialog — aplicar o mesmo

Aplicar `max-h-[90dvh] overflow-y-auto` também no `AlertDialogContent` (`apps/adm.fonte/src/components/ui/alert-dialog.tsx`) — mesmo problema potencial.

---

## Testes automatizados (obrigatório — Definition of Done)

Story só conclui com teste automatizado verde cobrindo a rolagem.

| Arquivo | Caso |
| --- | --- |
| `apps/adm.fonte/e2e/houses.spec.ts` | Com viewport baixa (`page.setViewportSize({ width: 1024, height: 500 })`), abrir o modal de editar casa: o `DialogContent` tem `overflow-y-auto` e `scrollHeight > clientHeight`; o botão de submit no rodapé fica acessível via scroll e é clicável |

Asserção sugerida: localizar o container do dialog (`getByRole('dialog')`), verificar `el.scrollHeight > el.clientHeight` e que o botão de salvar fica visível após `scrollIntoViewIfNeeded()`.

Rodar: `pnpm test:adm`. Verde.

## Verificação manual

1. `pnpm dev:adm` — reduzir altura da janela; abrir editar na página de detalhes da casa: conteúdo rola verticalmente dentro do modal, nada cortado.
2. Conferir outros modais grandes (`RegisterPaymentDialog`, `AddRelativeDialog`, `SupportGroupDialog`, `BibleClassDialog`) — sem corte, scroll quando necessário.
3. Modais pequenos continuam centralizados sem scrollbar desnecessária.
4. `AlertDialog` (`components/ui/alert-dialog.tsx`) — aplicar o mesmo `max-h`/`overflow` (decidido em §AlertDialog) e conferir sem corte.
