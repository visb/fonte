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

Transições devem ser controladas via service.

Não permitir alteração manual arbitrária sem validação.

---

## 2. Cadastro de Interno

- Deve estar vinculado a uma House
- Deve possuir pelo menos um responsável (Relative/familiar)
- Não pode ser removido fisicamente (soft delete)

---

## 2.1. Vínculo com House

As seguintes entidades devem obrigatoriamente estar associadas a uma House:

- Resident (filho)
- Staff (servo e coordinator)

Regras:

- Não é permitido cadastrar essas entidades sem House associada
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

## 6. Ministérios

- Apenas COORDINATOR ou ADMIN pode criar ou remover ministérios
- OPERATOR pode ser atribuído como responsável de um ministério
- Filhos podem ser designados a um ou mais ministérios
- Ministério não pode ser removido fisicamente (soft delete)

---

## 7. Storeroom (Dispensa)

- Cada House possui sua própria storeroom
- OPERATOR pode registrar entradas e saídas
- OPERATOR pode realizar conferência
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

## 9. User e Acesso

### Modelo de identidade

Autenticação é centralizada na entidade `User`. Cada entidade que precisar de acesso ao sistema recebe um `user_id` (FK nullable):

| Entidade | user_id | Quando é preenchido                        |
| -------- | ------- | ------------------------------------------ |
| Staff    | sempre  | No cadastro do colaborador                 |
| Relative | opcional | Quando o familiar receber acesso ao portal |
| Resident | opcional | Quando o interno receber acesso ao kiosk   |

### Roles

- `ADMIN`, `COORDINATOR`, `OPERATOR` — exclusivos de Staff
- `RELATIVE` — exclusivo de Relative
- `RESIDENT` — exclusivo de Resident

### Regras

- `User` não é criado de forma autônoma — sempre nasce vinculado a Staff, Relative ou Resident
- Desativar um Staff/Relative/Resident deve desativar o `User` correspondente (`is_active = false`)
- Soft delete na entidade de domínio não remove o `User`, apenas desativa
- Email deve ser único na tabela `user`

---

## 10. Permissões por Role

| Ação                       | ADMIN | COORDINATOR | OPERATOR |
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

---

## 11. Segurança

- Apenas ADMIN pode remover Staff
- Apenas COORDINATOR ou ADMIN pode alterar status de Resident
- Alterações críticas (status, ocorrência CRITICAL, movimentação de storeroom) são registradas com responsável e timestamp

---

## 12. Exclusão

Sistema utiliza soft delete:

- deleted_at preenchido
- Registros não são removidos fisicamente
