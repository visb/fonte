# Regras de Negócio – Fonte de Misericórdia

---

## 1. Status do Interno

Status possíveis:

- `PRE_ADMISSION`: Interno ainda em fase de admissão, pendente de aprovação ou integração ao serviço. Não está considerado como residente plenamente ativo.
- `ACTIVE`: Interno em situação normal, participando das rotinas e atividades regulares da instituição.
- `DISCIPLINE`: Interno em regime disciplinar, com restrições ou medidas específicas devido a comportamento ou necessidade de correção.
- `TEMP_LEAVE`: Interno temporariamente ausente da instituição, por permissão ou saída programada, mas com vínculo ativo.
- `DISCHARGED`: Interno oficialmente desligado do serviço, com alta registrada e fim do vínculo institucional.
- `EVADED`: Interno que fugiu ou evadiu-se sem autorização, status usado para controle e ações de retorno.
- `ARCHIVED`: Registro histórico vindo do import em lote sem correspondência na planilha de referência (arquivo morto). Não conta como presente/ativo em nenhuma listagem ou contador de ocupação.

Transições devem ser controladas via service.

Não permitir alteração manual arbitrária sem validação.

---

## 2. Cadastro de Interno

- Deve estar vinculado a uma House — exceção: status `ARCHIVED` pode não ter House (import em lote de ficha fora da planilha, casa desconhecida); filho sem casa não aparece em listagens/contagens por casa
- Deve possuir pelo menos um responsável (Relative/familiar) no acolhimento manual — exceção: import em lote aceita ficha sem familiar (registro histórico; familiar pode ser cadastrado depois)
- Não pode ser removido fisicamente (soft delete)

---

## 2.1. Vínculo com House

As seguintes entidades devem obrigatoriamente estar associadas a uma House:

- Resident (filho)
- Staff (servo e coordinator)

Regras:

- Não é permitido cadastrar essas entidades sem House associada (exceção: Resident com status `ARCHIVED` pode não ter House)
- A House determina o escopo operacional do usuário (storeroom, rotina, ocorrências)

---

## 3. Registro de Rotina

- Deve conter data
- Deve conter responsável (Staff)
- Não pode ser editado após 24h

---

## 4. Ocorrências

- Deve registrar severity
- Deve registrar responsável
- Não pode ser deletada
- Se severity = CRITICAL:
  - Pode exigir alteração de status do interno

---

## 5. Alta

Para registrar alta:

- Status deve estar ACTIVE ou DISCIPLINE
- Deve registrar exit_date
- Após alta, não permitir novos registros de rotina

---

## 5.0. Histórico de acolhimentos (story 215)

A aba Histórico do `adm.fonte` lista as passagens (`admissions`) do filho. Só **ADMIN** cria e
edita; COORDINATOR e SERVANT leem. Não há exclusão (histórico é fato).

- **Acolhimento atual** = o de maior entrada (índice 0 da lista, story 164) — o que a ficha espelha.
  Nele só a **data de entrada** é corrigível (atualiza também `resident.entry_date`; o carnê não é
  recalculado). Casa, saída e status mudam só por transferência, alta ou readmissão.
- **Passagem encerrada**: casa, entrada, saída e status editáveis.
- **Criar** = só passagem antiga, já encerrada (entrada + saída). Acolhimento novo é a readmissão.
- Status aceito numa passagem criada/editada: só status de saída (`DISCHARGED`, `EVADED`,
  `ARCHIVED`). Casa só pode ficar nula com `ARCHIVED`.
- Datas seguem a story 203 (não futuras, saída ≥ entrada). Passagens do mesmo filho **não se
  sobrepõem** (sair e reentrar no mesmo dia pode) e a passagem antiga tem de começar antes do
  acolhimento atual — senão ela viraria o "atual".
- Auditoria: `admission.create` / `admission.update`, alvo `admission`, filho como principal.

---

## 5.1. Promoção de filho a servo

Quase todos os servos foram filhos um dia. Um Resident pode ser promovido a Staff:

- Ação disponível na página do filho; permitida a ADMIN ou COORDINATOR
- Permitida em qualquer status do filho
- A data da promoção é informada no diálogo (default: hoje) e usada na alta, na timeline e em `promoted_at` do servo
- O filho é arquivado: status passa a `DISCHARGED` com `exit_date` = data da promoção
- Cria-se um Staff com role `SERVANT`, nível `ASPIRANTE`, vinculado ao Resident de origem (`former_resident_id`) e com `promoted_at`
- Se o filho já tinha acesso (User do kiosk), a conta é reaproveitada: role muda de `RESIDENT` para `SERVANT`, mantendo email/senha
- Se não tinha acesso, gera-se email + senha (igual ao fluxo de novo servo)
- Não é permitida dupla promoção do mesmo filho
- A timeline do filho registra o evento `PROMOTED_TO_SERVANT` na data da promoção
- O servo herda todo o histórico do filho (acompanhamento, familiares, anexos, acolhimentos), exibido na página de detalhes do servo via `former_resident_id`

---

## 6. Ministérios

- Apenas COORDINATOR ou ADMIN pode criar ou remover ministérios
- SERVANT pode ser atribuído como responsável de um ministério
- Filho pertence a no máximo um ministério (`residents.ministry_id`) e pode ser o líder dele
- Só filho **em acolhimento** (`ACTIVE`, `DISCIPLINE`, `TEMP_LEAVE` — `REMOVABLE_RESIDENT_STATUSES`) **na mesma casa** do ministério entra no ministério ou o lidera; fora disso o backend responde 400 (story 205)
- Alta, evasão (qualquer saída do acolhimento) ou transferência de casa tira o filho do ministério e da liderança automaticamente, com evento `MINISTRY_CHANGE` na linha do tempo; readmissão volta sem ministério
- Ministério não pode ser removido fisicamente (soft delete)

---

## 7. Storeroom (Dispensa)

- Cada House possui sua própria storeroom
- SERVANT pode registrar entradas e saídas
- SERVANT pode realizar conferência
- Toda movimentação é registrada com responsável, data e quantidade
- Não é permitido estorno; correções devem ser feitas com novo lançamento
- O serviço mantém log interno de todas as movimentações

---

## 8. resident.fonte

- App roda em modo Kiosk nos dispositivos da casa
- Uso diário limitado a 25 minutos por interno, não acumulativo
- Funcionalidades disponíveis: envio de mensagens a familiares, lista de pedidos para visita, cadastro de contatos
- Controle de tempo gerenciado pelo backend; interno não pode estender o limite

---

## 8.1. Acesso de Resident no ops.fonte

- Residents podem fazer login no ops.fonte com email + senha
- Acesso gerado manualmente por ADMIN ou COORDINATOR no adm.fonte
- Senha pode ser resetada por ADMIN, COORDINATOR ou SERVANT
- Residents só têm acesso a: Módulo Mensagens e Módulo Lista de Pedidos
- Limite diário de 1200 segundos (20 min) por interno para uso destes módulos
- Timer exibido no topo das telas; acesso bloqueado quando limite é atingido
- Limite reseta automaticamente à meia-noite (baseado em data)
- Apenas ADMIN e COORDINATOR podem resetar o timer manualmente

---

## 8.2. Módulo Mensagens

- Servos podem conversar com familiares de todos os filhos da casa
- Residentes podem conversar apenas com seus próprios familiares
- Familiares (RELATIVE) podem conversar apenas com seu próprio filho
- Mensagens enviadas por residents ou familiares têm status PENDING_APPROVAL até servo aprovar
- Mensagens enviadas por servos têm status APPROVED automaticamente
- Servos visualizam painel de moderação com mensagens pendentes
- Cada conversa é uma thread por par (resident, familiar)

---

## 8.3. Módulo Lista de Pedidos

- Residents gerenciam lista de itens desejados para visita familiar
- Items adicionados/removidos por resident ficam em PENDING_APPROVAL
- Servant aprova (torna visível para família) ou rejeita cada item; ao rejeitar pode informar motivo (texto livre, opcional)
- Remoção: resident solicita; servant aprova a remoção (soft delete)
- Servants visualizam painel de moderação com todas as listas pendentes
- Resident visualiza seus itens separados em abas: Aprovados, Pendentes, Recusados
- Motivo de recusa exibido ao resident na aba Recusados quando informado

---

## 9. User e Acesso

### Modelo de identidade

Autenticação é centralizada na entidade `User`. Cada entidade que precisar de acesso ao sistema recebe um `user_id` (FK nullable):

| Entidade | user_id | Quando é preenchido                        |
| -------- | ------- | ------------------------------------------ |
| Staff    | sempre  | No cadastro do colaborador                 |
| Relative | opcional | Quando o familiar receber acesso ao portal |
| Resident | opcional | Quando o interno receber acesso ao kiosk   |

### Roles

- `ADMIN`, `COORDINATOR`, `SERVANT` — exclusivos de Staff (`SERVANT` = servo da casa)
- `RELATIVE` — exclusivo de Relative
- `RESIDENT` — exclusivo de Resident

### Coordenador da casa (stories 194 e 214)

- **Coordenador da casa** = Staff lotado nela (`staff.house_id`) com role `COORDINATOR` **ou**
  `ADMIN`, não desligado. A lista é derivada (sem tabela de junção) e aparece em
  `GET /houses/:id` → `coordinators`.
- Admin sem `house_id` não coordena casa nenhuma; admin coordena **só** a casa onde está lotado.
- O titular (`houses.coordinator_id`) só pode ser eleito entre os coordenadores da casa; o titular não
  ganha permissão extra (todos os coordenadores da casa configuram a casa).
- O titular é limpo quando o staff é desligado, muda de casa ou deixa de ser coordenador da casa
  (role fora de `COORDINATOR | ADMIN`). Trocar `COORDINATOR ↔ ADMIN` mantém o titular.
- Admin lotado na casa abre os fluxos de coordenador (contagem, configurações da casa no `ops`, pedido
  de capacidade), sob a mesma regra de vínculo com a casa. Fora desses fluxos, o ADMIN segue com o
  poder pleno de sempre (ex.: altera capacidade direto).

### Hierarquia do servo (rank)

Servos (`SERVANT`) têm um nível espiritual, separado do Role de sistema:

- `ASPIRANTE` → `CONSAGRADO` → `ALIANCADO`

Regras:

- Campo `rank` em Staff; nulo para `ADMIN`/`COORDINATOR`
- Servo recém-criado/promovido entra como `ASPIRANTE`
- Promoção entre níveis é feita na edição do servo

### Regras

- `User` não é criado de forma autônoma — sempre nasce vinculado a Staff, Relative ou Resident
- Desativar um Staff/Relative/Resident deve desativar o `User` correspondente (`is_active = false`)
- Soft delete na entidade de domínio não remove o `User`, apenas desativa
- Email deve ser único na tabela `user`

---

## 10. Permissões por Role

| Ação                       | ADMIN | COORDINATOR | SERVANT |
| -------------------------- | :---: | :---------: | :------: |
| Gerenciar Staff            |   ✓   |             |          |
| Remover Staff              |   ✓   |             |          |
| Alterar status de Resident |   ✓   |      ✓      |          |
| Cadastrar Resident         |   ✓   |      ✓      |    ✓     |
| Registrar rotina           |   ✓   |      ✓      |    ✓     |
| Registrar ocorrência       |   ✓   |      ✓      |    ✓     |
| Criar/remover ministério   |   ✓   |      ✓      |          |
| Atribuir responsável/filho |   ✓   |      ✓      |          |
| Movimentar storeroom       |   ✓   |      ✓      |    ✓     |
| Conferência de storeroom   |   ✓   |      ✓      |    ✓     |
| Ler o carnê (valores)      |   ✓   |      ✓      |          |
| Ler o recorte do carnê     |   ✓   |      ✓      |    ✓     |
| Declarar contribuição em produtos |   ✓   |      ✓      |    ✓     |
| Registrar pagamento em valor |   ✓   |      ✓      |          |
| Reabrir parcela paga       |   ✓   |      ✓      |          |
| Alterar plano de contribuição / isenção |   ✓   |      ✓      |          |

### Carnê do filho: valor é do coordenador, produto é da casa (story 186)

- O **carnê cheio** (valor, vencimento, pagamento, forma, comprovante, histórico) é lido só por
  ADMIN/COORDINATOR — `GET /residents/:id/receivables`. Histórico de pagamento da família é dado
  pessoal financeiro e não fica acessível a todo operador da casa.
- O servo lê o **recorte** — `GET /residents/:id/receivables/summary`: `id`, `referenceMonth` e
  `status`, e nada mais. É o mínimo para localizar em qual parcela ele declara a **contribuição em
  produtos** (liberada a SERVANT+ desde a story 112), que é operação de casa, não de financeiro.
- O pacote offline da casa (`GET /houses/:id/offline-snapshot`) leva o **recorte**, para toda role de
  staff — nunca valor nem pagamento.
- Escrita financeira segue ADMIN/COORDINATOR: registrar pagamento em valor, reabrir parcela, alterar
  plano de contribuição e marcar isenção.

---

## 11. Segurança

- Apenas ADMIN pode remover Staff
- Apenas COORDINATOR ou ADMIN pode alterar status de Resident
- Alterações críticas (status, ocorrência CRITICAL, movimentação de storeroom) são registradas com responsável e timestamp

---

## 12. app.fonte (Familiares)

App mobile para familiares (role `RELATIVE`) de residentes.

### Acesso
- Familiar recebe login (email + senha) gerado por ADMIN ou COORDINATOR no adm.fonte
- Senha pode ser resetada por ADMIN, COORDINATOR ou SERVANT
- No primeiro login, familiar deve trocar a senha (`mustChangePassword = true`)

### Permissões
- RELATIVE vê apenas dados do seu próprio filho
- RELATIVE pode enviar mensagens apenas no thread do seu filho
- Mensagens enviadas por RELATIVE → `PENDING_APPROVAL` (moderadas por servo)
- RELATIVE vê apenas itens `APPROVED` da lista de pedidos do seu filho (read-only)
- RELATIVE pode registrar check-in em grupos de apoio via token QR

### Check-in de grupo de apoio
- Familiar escaneia QR code da reunião (que contém o `checkinToken`)
- Backend registra `SupportGroupRelativeCheckin` com `(meetingId, relativeId)`
- Check-in duplicado na mesma reunião gera erro de conflito
- Histórico salvo em `support_group_relative_checkins`

---

## 13. Exclusão

Sistema utiliza soft delete:

- deleted_at preenchido
- Registros não são removidos fisicamente
