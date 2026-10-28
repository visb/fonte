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
- **CPF é único entre filhos não excluídos (story 219)** e é gravado **só com dígitos** — a máscara `000.000.000-00` é só de exibição/digitação. Garantido no banco por índice único parcial (`cpf` onde `cpf IS NOT NULL AND deleted_at IS NULL`); filho excluído (soft delete) não prende o CPF. Vale para o cadastro e a edição no `adm`, a contagem do `ops` e o import em lote.
  - CPF novo ou alterado precisa de 11 dígitos e dígito verificador válido (sequência repetida `111…` é recusada) → senão 400 "CPF inválido.". Ficha legada com CPF inválido continua salvável editando outro campo: o CPF só é julgado quando muda.
  - CPF já usado por outro filho → 409 "Já existe um filho com este CPF: <nome> (<status>)." com `conflictResidentId` (o `adm` linka o cadastro; a contagem do `ops` usa para reacolher). No `ops`, sem rede só formato/DV são checados; o 409 que volta da fila vai para a tela de pendências (`/sync`).
  - Duplicados anteriores à regra: a migration `UniqueResidentCpf` manteve o CPF no filho em acolhimento (empate → o de `updated_at` mais recente) e limpou os demais, guardando o valor antigo em `resident_cpf_dedup_log` para mesclagem manual. A anonimização LGPD apaga o log do titular.

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

## 5.0.1. Readmissão (reacolhimento) e a contagem do `ops` (story 218)

- Readmissão (`POST /residents/:id/readmit`, ADMIN/COORDINATOR) aceita filho com status `DISCHARGED`,
  `EVADED` **ou `ARCHIVED`** (ficha do import em lote). Cria um acolhimento novo, `ACTIVE`, na casa
  informada — ficha `ARCHIVED` sem casa passa a ter a casa do reacolhimento. Datas seguem a story
  203 (entrada não futura e ≥ última saída). A notificação de acolhimento vai para a casa nova.
- Reacolher reaproveita o cadastro: familiares, anexos e histórico ficam no mesmo filho — por isso o
  "pelo menos um familiar" do acolhimento manual não se aplica.
- **Contagem do `ops`**: ao adicionar filho, pergunta se ele já passou pela comunidade. Se sim, busca
  (`GET /residents/lookup`, ADMIN/COORDINATOR) na **comunidade inteira**, só entre filhos fora de
  acolhimento (alta, evasão, arquivado), por nome parcial sem acento/caixa ou CPF exato, até 20
  candidatos e com recorte enxuto (nome, nascimento, foto, status, última casa, última saída — sem
  CPF, saúde ou familiares; acesso auditado com CPF mascarado). Filho ativo em outra casa não
  aparece: é transferência, fluxo do `adm`. Escolhido o candidato, o operador confirma a data de
  entrada e o filho é reacolhido na casa da contagem (saúde/peso/plano ficam para o `adm`).
  Nenhum candidato → cadastro novo, como antes. CPF do cadastro novo já em uso (409, story 219) →
  oferece reacolher esse filho.
- Adicionar filho pela contagem **exige rede** (para checar se ele já passou): offline o botão fica
  desabilitado com aviso. O reacolhimento enviado entra na outbox como os demais lançamentos de
  campo; a rejeição do servidor vai para a tela de pendências (`/sync`).

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
- A promoção abre o **período de serviço** do servo (seção 5.2), na mesma transação da criação do Staff

---

## 5.2. Período de serviço do servo (story 216)

Registro de quando até quando alguém serviu (`staff_service_periods`). "Servo" aqui é todo Staff
(SERVANT, COORDINATOR, ADMIN); o período não guarda role nem nível.

- **Todo servo tem período**: ele nasce **aberto** (sem fim) na promoção do filho (início = data da
  promoção, casa do servo) e no cadastro direto de servo (início = hoje). Servos anteriores à story
  ganharam um período aberto por backfill (início = `promoted_at` ou a data de cadastro).
- **No máximo um período aberto por servo** (índice único parcial). O fim é escrito pelo desligamento
  (story 217).
- Mudar o servo de casa **não** fecha/abre período: o período guarda a casa de início.
- Aba **Histórico** do servo (todo servo): linha do tempo com os períodos de serviço e, para ex-filho,
  os acolhimentos da seção 5.0, do início mais recente ao mais antigo. Leitura: ADMIN, COORDINATOR,
  SERVANT. Escrita só **ADMIN**:
  - **Criar** = só período antigo, já encerrado (início + fim; casa opcional).
  - **Período encerrado**: casa, início e fim editáveis.
  - **Período aberto**: só o início.
- Datas: início e fim não futuros, fim ≥ início; períodos do mesmo servo **não se sobrepõem** (terminar
  e recomeçar no mesmo dia pode). Sem exclusão.
- Auditoria: `staff.service_period.create` / `staff.service_period.update`, alvo
  `staff-service-period`, servo como principal.

---

## 5.3. Desligamento de servo (story 217)

Saída de um servo (todo Staff). **Só ADMIN, só no `adm.fonte`** (`POST /staff/:id/dismiss` e
`POST /staff/:id/reinstate`).

- **O cadastro fica visível como "Desligado"** (`staff.dismissed_at`), sem soft delete. Servo
  **ativo** = não soft-deletado **e** não desligado — predicado único da API
  (`services/api/src/modules/staff/active-staff.ts`). Desligado sai das listas, contagens e
  seletores de servo ativo (lista de servos, aba Servos da casa, contagem da casa, coordenadores,
  líder de ministério, grupos de apoio, contatos do familiar); aparece no filtro **"Desligados"** da
  lista do `adm`, e o detalhe com o Histórico continua acessível.
- **Motivo = categoria + observação**: Pedido próprio, Decisão da coordenação, Transferência para
  outra obra, Falecimento, Outro (`StaffDismissalReason`). Observação livre opcional, **obrigatória
  em "Outro"**. O motivo mora no **período de serviço encerrado** (seção 5.2) e aparece no card dele.
- **Data do desligamento**: informada (default hoje), não futura e ≥ início do período em andamento.
- **Efeitos, numa transação só**: fecha o período aberto (fim = data, motivo, observação), grava
  `dismissed_at`, desativa o `User` (`is_active = false` — login bloqueado; sessão aberta cai no
  próximo 401), limpa o **titular** da casa e a **liderança de ministérios** do servo. Permissões
  extras, casa e nível **ficam** gravados (inertes enquanto desligado).
- **Reintegração** (desligado → ativo): reativa o `User`, limpa `dismissed_at` e abre um período de
  serviço **novo** (casa escolhida + data de início não futura e ≥ fim do último período). As
  permissões gravadas voltam a valer.
- Desligar quem já está desligado ou reintegrar quem está ativo → 409.
- **Excluir cadastro** (`DELETE /staff/:id`, soft delete) continua, só para cadastro feito por
  engano — na UI é ação secundária com confirmação forte. Staff excluído antes desta story segue
  oculto (não é migrado).
- Auditoria: `staff.dismiss` / `staff.reinstate` (alvo o servo) + `staff.service_period.update` no
  período encerrado.

---

## 6. Ministérios

- Apenas COORDINATOR ou ADMIN pode criar ou remover ministérios
- SERVANT pode ser atribuído como responsável de um ministério
- Filho pertence a no máximo um ministério (`residents.ministry_id`) e pode ser o líder dele
- Só filho **em acolhimento** (`ACTIVE`, `DISCIPLINE`, `TEMP_LEAVE` — `REMOVABLE_RESIDENT_STATUSES`) **na mesma casa** do ministério entra no ministério ou o lidera; fora disso o backend responde 400 (story 205)
- Alta, evasão (qualquer saída do acolhimento) ou transferência de casa tira o filho do ministério e da liderança automaticamente, com evento `MINISTRY_CHANGE` na linha do tempo; readmissão volta sem ministério
- Ministério não pode ser removido fisicamente (soft delete)

## 6.0. Daily — board de ministérios (story 225)

- Reunião diária dos coordenadores no `ops.fonte`: board com todos os ministérios da casa + a caixa "Sem ministério", compartilhado em tempo real entre aparelhos
- **Acesso:** só ADMIN e COORDINATOR. Coordenador só a daily da **própria casa** (outra casa → 403); ADMIN informa a casa. SERVANT não vê o item no menu e a API responde 403
- **Rascunho vs aplicar:** arrastar mexe só no rascunho da sessão (não altera ministério real nem gera auditoria). Os ministérios reais só mudam quando um coordenador toca **"Aplicar"**: o backend grava tudo numa transação, com auditoria apenas do que mudou
- **Uma sessão aberta por casa**, do dia: aberta pré-preenchida do estado real (filho no ministério atual; servo no vínculo mais antigo). Sessão aberta de dia anterior e não aplicada é descartada. Depois de aplicar, a sessão fica somente leitura e "Nova daily" abre outra
- Quem entra no board: filho em acolhimento na casa (mesma regra de elegibilidade do ministério) e staff **ativo** da casa, de qualquer role. Pessoa nova entra em "Sem ministério"; quem deixou de ser elegível sai; membros de ministério excluído vão para "Sem ministério"
- **Uma pessoa = um ministério:** no board cada pessoa ocupa uma caixa só. Ao aplicar, o servo fica **somente** no ministério do board e perde os outros vínculos; "Sem ministério" zera os vínculos dele (filho fica sem `ministry_id`)
- **Pulados:** quem deixou de ser elegível até o momento do "Aplicar" é pulado (listado na resposta com o motivo) e o resto é aplicado
- Conflito: última escrita vence, por pessoa. Aplicar sessão já aplicada/descartada → 409
- Liderança não muda pelo board: o líder movido para outro ministério continua líder do original
- Exige rede: fora da fila offline; sem sinal o board fica somente leitura

---

## 6.1. Atividades (stories 48, 220 e 224)

- Fluxo: rascunho (`DRAFT`) → solicitação (`REQUESTED`) → a fazer (`TODO`) → fazendo (`DOING`) ↔ impedimento (`BLOCKED`) → concluída (`DONE`). Transições validadas no service
- Qualquer servo cria rascunho na própria casa; o criador envia a solicitação ou a devolve para rascunho
- **Criar** (story 224): em `DRAFT`, qualquer staff; em `REQUESTED` ou `TODO`, só o coordenador da casa da atividade ou o ADMIN (SERVANT ou coordenador de outra casa → 403). Nenhum outro status na criação (400)
- O responsável pode ser indicado já na criação, por qualquer staff (inclusive no rascunho do servo). `TODO` exige responsável (400); em `DRAFT`/`REQUESTED` é opcional. Não-ADMIN só indica servo **ativo** da casa da atividade (400); o ADMIN, qualquer staff existente. Criar com responsável grava `CREATED` e depois `RESPONSIBLE_CHANGED { from: null, to }`
- Trocar o responsável **depois** de criado continua sendo só do coordenador da casa ou do ADMIN (abaixo)
- **Aprovar** a solicitação (`REQUESTED` → `TODO`) e **atribuir/trocar o responsável** cabem ao **coordenador da casa** (COORDINATOR ou ADMIN lotado na casa da atividade) ou ao ADMIN. SERVANT só vê o responsável
- Aprovar exige responsável (o do pedido ou o já definido). O coordenador só escolhe **staff da casa da atividade**; fora disso, 400
- O coordenador troca o responsável em qualquer situação **menos Concluída** (403): para trocar em `DONE`, reabrir antes. O ADMIN segue podendo reatribuir em qualquer situação, pelo `adm`
- No bloco de trabalho (`TODO`, `DOING`, `BLOCKED`, `DONE`) o responsável é obrigatório: removê-lo é 400 para qualquer role
- Toda atribuição ou troca de responsável fica no histórico (`RESPONSIBLE_CHANGED { from, to }`), inclusive a feita na aprovação, registrada antes do `STATUS_CHANGED`
- Mexer no bloco de trabalho (iniciar, impedir, concluir, reabrir) é do responsável ou do ADMIN
- Aprovar e trocar responsável exigem rede no `ops.fonte` (sem outbox)

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
  `ADMIN` **e ativo** — não excluído e não desligado (story 217, seção 5.3). A lista é derivada (sem tabela de junção) e aparece em
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
| Daily (abrir, mover, aplicar) |   ✓   |      ✓      |          |
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
