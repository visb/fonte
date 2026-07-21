# Plan: Registrar a assinatura do staff (`staff.signature_url`) no inventário LGPD

## Context

A story 128 introduziu um **novo dado pessoal**: a **imagem da assinatura** de cada usuário staff,
persistida em `staff.signature_url` (URL canônica no bucket, imagem PNG desenhada pelo próprio
usuário) e impressa nos documentos gerados. Isso é um dado biométrico-adjacente / de identificação
pessoal que **ainda não consta** no inventário de dados pessoais do projeto
(`docs/lgpd/DIAGNOSTICO_LGPD.md`) nem no mapa de gaps/roadmap (`docs/lgpd/ROADMAP_LGPD.md`). O plano
da 128 já sinalizou, em "Fora de escopo", que valeria conferir depois se o inventário precisa
registrar esse dado novo. Esta story faz esse registro.

### O que precisa ser inventariado

- **Dado:** imagem de assinatura manuscrita do staff (`staff.signature_url` → arquivo PNG no bucket,
  pasta `signatures/`).
- **Titular:** colaborador (Staff — roles `ADMIN`/`COORDINATOR`/`SERVANT`).
- **Finalidade:** assinar automaticamente documentos gerados a partir dos templates (substitui a
  assinatura manual folha a folha).
- **Fluxo/armazenamento:** upload via `POST /staff/me/signature`; URL **canônica** no banco, **assinada
  na leitura** (regra da story 76); arquivo antigo apagado ao redesenhar (story 128, decisão 8).
- **Base legal:** definir no preenchimento — provavelmente **legítimo interesse / execução de
  contrato de trabalho** (assinatura funcional do colaborador em documentos institucionais), **não**
  consentimento. Alinhar com o critério já adotado no projeto (ver
  [[project_lgpd_legal_basis]] e `DIAGNOSTICO_LGPD.md`: consentimento reservado a imagem/divulgação
  religiosa; dados operacionais têm base própria).
- **Retenção/eliminação:** o dado vive enquanto o staff está ativo; redesenhar sobrescreve e apaga o
  anterior. Registrar o que acontece no desligamento do colaborador (gap a mapear no roadmap se não
  houver rotina).

### Decisões / diretrizes

1. **Story de documentação, não de código.** Não há mudança de schema, endpoint ou app — o dado já
   existe (128). O entregável é o **inventário atualizado** e o **gap correspondente no roadmap**, se
   houver (ex.: eliminação no desligamento).
2. **Reusar o formato existente** do `DIAGNOSTICO_LGPD.md` — entrar a nova linha/entrada no mesmo
   padrão das demais (dado, titular, finalidade, base legal, armazenamento, retenção), sem inventar
   estrutura nova.
3. **Base legal decidida no texto**, com justificativa curta, coerente com o critério já documentado
   (não jogar para consentimento por reflexo).

## Desenho

- **`docs/lgpd/DIAGNOSTICO_LGPD.md`:** adicionar a entrada da assinatura do staff no inventário, no
  formato existente.
- **`docs/lgpd/ROADMAP_LGPD.md`:** se a análise revelar um gap (ex.: sem rotina de eliminação da
  assinatura no desligamento do staff), registrar como item de gap/fase; se já coberto por algo
  existente, apenas referenciar.
- **Sem código, sem migration, sem contrato, sem teste automatizado.**

## Validação

Story **documentação-only** — não há suíte a rodar. Validação é **revisão de coerência**:

- A nova entrada existe no `DIAGNOSTICO_LGPD.md`, no formato das demais, com **base legal explícita e
  justificada** e o fluxo canônico/assinado-na-leitura descrito corretamente.
- Qualquer gap identificado (ex.: eliminação no desligamento) está refletido no `ROADMAP_LGPD.md`, ou
  há nota explícita de que já está coberto.
- Referências cruzadas corretas: story 128 (origem do dado), story 76 (regra de URL assinada).
- Revisão humana do texto antes do commit (é decisão jurídica/de compliance, não mecânica).

> **Gate:** por ser documentação sem código, **não há gate de cobertura de teste** — o "código novo
> sem teste não fecha" não se aplica (não há código). O gate é a **revisão de coerência do inventário**
> acima. Se, ao escrever, concluir-se que o dado exige mudança de código (ex.: rotina de eliminação),
> isso **não** entra aqui — vira story própria referenciada no roadmap.

## Fora de escopo

- Implementar rotina de **eliminação/anonimização** da assinatura no desligamento do staff — se for
  necessária, é story própria (registrada como gap no roadmap por esta).
- Assinatura digital certificada / validade jurídica (ICP-Brasil) — já fora de escopo desde a 128.
- Revisar o inventário LGPD de **outros** dados além da assinatura do staff.
