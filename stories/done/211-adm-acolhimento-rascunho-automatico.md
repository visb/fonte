# Plan: salvamento automático (rascunho) do acolhimento no `adm.fonte`

## Context

O acolhimento é um wizard longo (`AdmissionWizardPage`: Ficha de cadastro → Admissão → Familiares →
Documentos), preenchido na hora da chegada do filho, muitas vezes em computador de casa sem
nobreak. Backlog: *"no app adm, no acolhimento, fazer salvamento automático conforme o acolhimento
progride, para proteger os dados já preenchidos em caso de queda de energia"*.

Comportamento atual:

- **Passos 1 e 2** (Ficha, Admissão) ficam só em memória (`useForm`). Queda de energia, F5 ou aba
  fechada perdem tudo.
- No **"Avançar" do passo 2**, o filho é criado no servidor (`ensureResident`). Familiares e
  documentos (passos 3 e 4) já gravam cada ação na hora.
- Recarregar **no passo 3 ou 4** perde o `residentId`. O wizard volta ao passo 1 vazio, e refazer
  **cria o filho em duplicidade**.
- A **reintrodução** (`ReadmissionForm`, via `NewAdmissionGatewayPage`) tem o mesmo problema de
  perda.

### Decisões travadas (usuário)

1. **Rascunho no navegador** (`localStorage`), salvo automaticamente conforme o preenchimento.
   Funciona sem rede e não exige backend novo. Limite aceito: só retoma no mesmo
   computador/navegador.
2. **Só os campos, sem arquivos.** Foto (`pendingPhotoRef`) e comprovante do 1º pagamento não
   entram no rascunho. Ao retomar, um aviso pede para reanexá-los, se tinham sido escolhidos.
3. **Vale para o primeiro acolhimento e para a reintrodução.**

### Decisões de desenho (defaults assumidos no refino)

4. **O que é salvo (primeiro acolhimento)**: os valores do form (`getValues()`), o passo atual, o
   `residentId` (quando já criado) e os campos de 1º pagamento que são texto/flag
   (`firstPaymentPaid`, `firstPaymentMethod`), mais `savedAt` e uma versão de schema do rascunho.
   **Reintrodução**: os valores do `ReadmissionForm`, com chave pelo `residentId` do filho
   reintroduzido.
5. **Quando salva**: `watch` do form com debounce (~1s), e também a cada troca de passo e logo
   após o filho ser criado (o `residentId` é gravado imediatamente, sem debounce). Isso é o que
   fecha o buraco da duplicidade.
6. **Retomada**: ao abrir *Novo acolhimento* com rascunho existente, aparece um banner/dialog
   "Há um acolhimento não concluído de *{nome ou 'sem nome'}*, salvo em *{data/hora}*" com
   **Continuar** e **Descartar**. Continuar restaura os valores e o passo. Se o rascunho tem
   `residentId`, o wizard abre no passo salvo (3 ou 4) usando esse id, sem recriar o filho. Se o id
   não existe mais no servidor (404), o rascunho é descartado com aviso.
7. **Quando apaga**: ao concluir o acolhimento, ao concluir a reintrodução, em **Descartar**, em
   **Cancelar** (com confirmação, se houver dados) e no **logout**.
8. **LGPD: o rascunho contém dado pessoal e de saúde num computador possivelmente
   compartilhado.**
   - A chave inclui o `userId` logado (`fonte:admission-draft:<userId>`), então outro usuário no
     mesmo navegador não vê o rascunho.
   - **Expira em 7 dias** (descartado ao ler, se vencido).
   - Apagado no logout (decisão 7).
   - Nada de arquivos (decisão 2).
   - Registrar o tratamento em `docs/lgpd/DIAGNOSTICO_LGPD.md` (armazenamento local temporário do
     rascunho).
9. **Um rascunho por tipo por usuário**: 1 de primeiro acolhimento, mais 1 por filho em
   reintrodução. Começar um acolhimento novo com rascunho pendente passa pela escolha da decisão 6.
10. **Resiliência**: toda leitura e escrita em `localStorage` fica em `try/catch`. Storage cheio,
    bloqueado ou JSON corrompido nunca quebra o wizard: só não há rascunho. Um rascunho com versão
    de schema diferente é descartado.
11. **Indicador discreto** no rodapé do wizard: "Rascunho salvo às HH:MM".
12. **Tamanho**: o `AdmissionWizardPage` (~250 linhas) passa do limite. A lógica de rascunho fica
    num hook (`useAdmissionDraft`) e o banner num componente. A page só orquestra.

---

## Desenho (`adm.fonte`, frontend-only)

```
features/residents/
  lib/admissionDraft.ts              ← read/write/clear, chave por userId, TTL 7d, versão, try/catch
  hooks/useAdmissionDraft.ts         ← debounce do watch, save imediato de step/residentId, restore
  components/wizard/DraftResumeBanner.tsx   ← Continuar / Descartar, nome + data
  components/wizard/DraftSavedIndicator.tsx ← "Rascunho salvo às HH:MM"
  pages/AdmissionWizardPage.tsx      ← usa o hook; retomada com residentId pula a criação
  components/ReadmissionForm.tsx     ← mesmo hook, chave por residentId
lib/auth (logout)                    ← limpa os rascunhos do usuário
```

- Sem mudança de backend, contratos ou query keys.
- A retomada com `residentId` valida a existência via `useResidentById`. Em 404, descarta.

---

## Validação

### `adm.fonte`: unit (`pnpm test:adm:unit`)

- **`admissionDraft`**:
  - grava e lê pela chave do usuário, e outro `userId` não lê;
  - rascunho com mais de 7 dias é descartado na leitura;
  - versão diferente é descartada;
  - JSON corrompido ou `localStorage` lançando exceção → sem rascunho, sem erro;
  - `clear` remove.
- **`useAdmissionDraft`**:
  - salva após o debounce;
  - troca de passo e `residentId` salvam na hora;
  - restore devolve valores, passo e id.
- **`DraftResumeBanner`**: mostra nome/"sem nome" e a data; Continuar e Descartar chamam os
  callbacks.
- **`AdmissionWizardPage`**:
  - com rascunho nos passos 1–2, Continuar restaura os campos e o passo;
  - com rascunho com `residentId`, abre no passo 3 **sem chamar create** (regressão da
    duplicidade);
  - `residentId` com 404 descarta e avisa;
  - concluir e descartar apagam;
  - rascunho que tinha foto/comprovante mostra o aviso para reanexar.
- **`ReadmissionForm`**: rascunho por filho é restaurado e apagado ao concluir.
- **Logout** limpa os rascunhos do usuário.

### `adm.fonte`: e2e (`pnpm test:adm`)

- Preencher parte da Ficha, **recarregar a página**, voltar em *Novo acolhimento* → Continuar →
  campos restaurados.
- Avançar até o passo 3 (filho criado), recarregar, Continuar → passo 3 com o mesmo filho, e a
  listagem não tem duplicata.
- Descartar → wizard vazio.
- A fixture criada é removida no `afterAll` por id (story 182).

### Gate de cobertura (trava a story)

Código novo sem teste não fecha a story. `pnpm test:adm:unit` com cobertura: `admissionDraft`,
`useAdmissionDraft` e componentes novos ≥90%, sem reduzir `features/residents`. Sem
`skip`/`only`/`xfail` sem justificativa explícita no código (CLAUDE.md).

---

## Fora de escopo

- **Rascunho no servidor** / retomar em outro computador (decisão 1).
- **Arquivos** (foto, comprovante) no rascunho (decisão 2).
- Rascunho em outros formulários do `adm` (edição de ficha, servo etc.).
- Lista de vários rascunhos de primeiro acolhimento simultâneos (decisão 9).
- Import em lote (`BulkImportPage`/`ImportResidentPage`).
