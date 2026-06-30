# Plan: Limpeza de órfãos no bucket de arquivos

## Context

Item do BACKLOG (bloco "tratar melhor o bucket"): hoje objetos sobem ao bucket e,
em vários fluxos, nunca são apagados quando deixam de ser referenciados —
acumulando lixo e custo de storage, além de risco LGPD (dado pessoal que deveria
sumir continua no bucket).

`StorageService.delete(fileUrl)` **já existe**
(`services/api/src/modules/storage/storage.service.ts:225`) — o problema é caller
que sobe mas não chama delete. Auditoria feita ao refinar esta story:

**Já corretos (substituição/deleção apaga o antigo):** `resident` (foto + thumb +
anexo + doc assinado), `staff` (foto), `relative` (foto), `house` (foto),
`activity-attachment`, `payable`, `resident-follow-up`, `resident-receivable`,
`event` (banner), `data-rights`.

**Gaps identificados:**
1. **Wysiwyg (TipTap → `document-template`)**: `TemplateEditor` sobe imagem via
   `document-template.service.ts:132`. Quando a imagem é removida do conteúdo (ou
   o template é re-salvo sem ela), o objeto vira órfão — **não há diff/limpeza**.
2. **`event-registration.service.ts:238`**: upload de comprovante sem delete
   correspondente quando o registro/comprovante é substituído ou removido.
3. **`message.controller.ts:82`**: anexo de mensagem — avaliar (mensagem pode ser
   imutável por design → ver decisão).

### Decisões travadas

- **Wysiwyg = diff no save.** Ao salvar o conteúdo do editor, comparar as URLs de
  imagem do conteúdo **antigo** vs **novo**; apagar do bucket as que sumiram.
  Síncrono e determinístico. **Não** usar varredura periódica especulativa (risco
  de apagar imagem em uso).
- **Reconciliação retroativa: incluída (one-shot ADMIN).** Story entrega um
  comando/endpoint ADMIN que varre o bucket e remove objetos não referenciados em
  nenhum registro/conteúdo — para limpar órfãos legados já existentes. Por ser
  destrutivo: roda em **dry-run por padrão** (lista o que apagaria), só apaga com
  flag explícita; logar tudo.
- **Anexos órfãos: corrigir só onde o pai já tem deleção.** Adicionar
  `storage.delete` onde o registro pai (comprovante de inscrição, etc.) já é
  apagado/substituído. Onde o pai é **imutável por design** (mensagem nunca
  apagada), **não** criar fluxo de deleção novo — fora de escopo.
- **Padrão de implementação**: deleção de bucket sempre na camada de service do
  módulo dono do recurso, junto da deleção/substituição do registro. Falha ao
  apagar objeto **não** deve abortar a transação principal — logar e seguir
  (best-effort), como já faz `activity-attachment`.

## Desenho

### 1. Wysiwyg — limpeza por diff (`document-template`)

- Helper puro `extractImageUrls(html: string): string[]` (varre `<img src>` /
  nós de imagem do conteúdo salvo) — testável isolado.
- No service de salvar template/conteúdo: antes de persistir, carregar conteúdo
  atual, calcular `removed = old.urls − new.urls`, e `storage.delete` cada uma
  (best-effort, só URLs do nosso bucket — ignorar externas/base64). Aplicar ao(s)
  campo(s) de conteúdo rico que sobem imagem ao bucket.

### 2. Comprovante de inscrição (`event-registration`)

- No ponto que substitui/remove o comprovante (upload em `:238` e fluxo de
  deleção do registro), apagar o objeto antigo via `storage.delete` antes/junto.

### 3. Auditoria — garantir cobertura dos demais

- Revisar a lista "já corretos" com teste de regressão garantindo que cada
  substituição/deleção de mídia chama `storage.delete` (não silenciosamente
  quebrar). Documentar `message` como imutável (sem deleção) se confirmado.

### 4. Reconciliação one-shot (ADMIN)

- Endpoint `POST /storage/reconcile?apply=false` (ADMIN only, guard JWT) ou
  comando equivalente: lista todas as URLs referenciadas (somando os campos de
  mídia conhecidos + URLs extraídas dos conteúdos wysiwyg), lista objetos do
  bucket, e calcula órfãos. `apply=false` (default) → só retorna/loga o relatório
  (dry-run). `apply=true` → apaga e loga cada deleção. Atualizar
  `fonte-api.postman_collection.json` com o endpoint.

## Validação

Gate de cobertura: **código novo sem teste não fecha a story.** Sem
`skip`/`only`/`xfail` injustificado. (`pnpm test:api` / `pnpm test:api:cov` +
`pnpm test:api:e2e`.)

- `extractImageUrls`: unit — html com 0/1/N imagens, base64 ignorado, URLs
  externas ignoradas, só URLs do bucket retornadas.
- Service de template: ao salvar removendo imagem, `storage.delete` chamado
  para a URL removida e **não** para as mantidas; falha do storage não aborta o
  save (best-effort).
- `event-registration`: substituir/remover comprovante chama `storage.delete` do
  antigo (StorageService mockado).
- Regressão da lista "já corretos": testes existentes seguem verdes; adicionar
  asserts onde faltar para travar o comportamento.
- Reconciliação: unit do cálculo de órfãos (referenciadas vs objetos do bucket →
  conjunto correto), `apply=false` não chama delete, `apply=true` chama delete de
  cada órfão; e2e do endpoint com guard ADMIN (não-ADMIN bloqueado).

## Fora de escopo

- Criar fluxo de deleção onde o registro pai é imutável por design (ex:
  mensagem). Só documentar.
- Varredura periódica agendada (job recorrente) — esta story faz reconciliação
  sob demanda (one-shot), não cron.
- Versionamento/lixeira com retenção de objetos apagados.
- Migração de mídia entre buckets / segundo bucket (é o backup — story 20).
