# Plan: Auditoria de ações dos usuários e histórico no adm

## Context

O administrador precisa descobrir quem fez cada alteração e o que mudou. O backlog pede
rastreabilidade inicialmente para login, servos, filhos (ficha, contribuições, anexos e geração
de documentos), casas, contagem e declaração de recebimento de produtos.

### Decisões do usuário

- A tela e sua API de consulta são exclusivas de ADMIN.
- Alterações mostram valores antes/depois, além de autor, data e recurso.
- Login registra sucessos e falhas nos apps que usam a autenticação centralizada.

### Base existente e decisões técnicas propostas

- Ampliar `services/api/src/modules/audit/` e `audit_logs`. Já existem `AuditService`,
  `AuditInterceptor`, `@Audit` e `GET /audit/:targetType/:targetId`, consumido pela aba Privacidade
  do filho. Preservar esse contrato e os registros existentes.
- Hoje a gravação é best-effort, sem antes/depois, e o interceptor só observa sucesso.
  Apenas adicionar decorators não satisfaz esta story: login ainda não tem `req.user`, guards
  podem rejeitar antes do interceptor e alterações precisam do estado persistido anterior.
- Captura centralizada na API cobre adm e ops sem depender de eventos enviados pelo frontend.
  Operações offline entram no histórico quando efetivamente sincronizadas; não inventar horário
  de execução local. Replay idempotente não representa uma nova alteração.
- Para escritas no banco deste escopo, alteração e evento devem compartilhar transação.
  Falha ao persistir auditoria impede confirmar a alteração. Eventos de login e geração de
  documentos usam gravação aguardada e falha observável, sem substituir erro de autenticação
  nem impedir login válido por indisponibilidade exclusiva da auditoria. Essa limitação deve
  constar na documentação: não há garantia absoluta para esses eventos sem fila durável.
- Antes/depois usa lista explícita de campos por domínio. Dados sensíveis são mascarados antes
  de persistir; segredos e conteúdo de arquivos nunca entram no log. Campos sensíveis alterados
  continuam identificados mesmo quando a máscara anterior e posterior coincidem.
- Não reconstruir passado: eventos antigos permanecem visíveis com detalhe indisponível.
  Não há dependência de story pendente; reutiliza auditoria e idempotência já existentes.

## Desenho

### 1. Catálogo de ações cobertas

Antes de instrumentar, enumerar os pontos de escrita dos módulos abaixo, inclusive rotas
alternativas que chamam o mesmo service. Manter catálogo tipado de ações e labels de exibição.

| Domínio | Eventos mínimos |
| --- | --- |
| Login | Sucesso; credenciais inválidas; usuário inativo; identificador inexistente/ambíguo; entrada inválida; bloqueio por limite de tentativas; erro interno |
| Servos | Criar, editar, remover; alteração do próprio perfil; foto, assinatura, anexos, permissões e vínculo com casa |
| Ficha do filho | Criar, editar ficha/identidade/status, transferir/remover da casa, excluir, reacolher, promover a servo, foto e alterações de vínculos familiares pela ficha; efetivação de importação |
| Contribuições do filho | Plano, isenção, pagamento, reabertura de parcela e lançamentos de contribuição pelos fluxos de acompanhamento, inclusive lote |
| Anexos do filho | Adicionar/remover anexo, anexar comprovante e documento assinado |
| Documentos do filho | Renderização, geração de PDF individual/combinado e recibo da contribuição, inclusive acesso do familiar pela API |
| Casas | Criar, editar, remover, fotos, regras e vínculos de coordenação/ministério, incluindo remoção de filho de ministério |
| Contagem | Inclusão de filho, conclusão, aprovação em lote e rejeição |
| Produtos recebidos | Declaração e remoção/correção pelos fluxos existentes, com parcela, filho, casa, produtos e quantidades; produto criado dentro da declaração |

Não criar operações de negócio que ainda não existem. Ações de escrita malsucedidas não geram
evento de alteração concluída; login mantém eventos de falha. Consultas comuns continuam fora
do novo catálogo, preservando os eventos de leitura que já existem.

### 2. Registro persistente e captura de diferenças

- Nova migration, sem editar migrations antigas, adiciona campos opcionais compatíveis:
  resultado, casa, recurso principal relacionado (ex.: filho da parcela), correlação de operação,
  campos alterados e diferenças JSONB `{ field, before, after, redacted }`.
- Autor vem do contexto autenticado; login bem-sucedido usa usuário resolvido pelo auth service.
  Falha de login não atribui identidade autenticada ao identificador digitado: autor nulo,
  identificador mascarado e motivo interno controlado. Resposta externa mantém mensagens atuais.
- Identificar recursos criados pelo ID persistido; manter IDs de recursos removidos. Nome de
  autor/recurso na consulta pode ser resolvido pelo banco; ausentes/excluídos têm fallback por ID.
  Evitar snapshots permanentes de nomes e fichas completas.
- Casa é a casa no momento da ação; transferência preserva referência anterior/posterior.
  Filtro por casa deve localizar os dois lados da transferência.
- Diferenças vêm do estado real antes/depois no service/repository, com proteção de concorrência
  apropriada à transação; nunca comparar somente o DTO ou consultar o estado depois do commit.
- Criação usa `before: null`; exclusão usa `after: null`; edição inclui somente campos alterados.
  Atualização sem mudança efetiva não cria evento de alteração.
- Arquivos: IDs, tipo e metadados permitidos, sem bytes, assinatura, URL assinada ou conteúdo.
  Documentos: IDs dos templates e do filho, formato e quantidade; geração não tem diff fictício.
- Lotes produzem eventos por recurso alterado com correlação comum, sem snapshots gigantes.
- AuditService expõe contrato transacional para módulos, mantendo persistência encapsulada.
  Evitar duplicidade entre chamadas explícitas e `@Audit` existente.
- Integrar replay com idempotência: mesma alteração sincronizada duas vezes gera um único
  evento; eventos só existem para transações confirmadas. Upload/PDF/storage não são rollback
  transacional: registrar conclusão no ponto correto e preservar compensações existentes.
- Nunca gravar senha, hash, token, cookie, Authorization, corpo HTTP completo, prontuário em
  texto livre ou query string. IP utiliza configuração confiável de proxy já existente.
- Novos campos são somente leitura pelas APIs. Nenhuma rota de edição/exclusão de eventos.
  Preservar compatibilidade com anonimização existente: não introduzir cópias identificáveis
  ou clínicas nos diffs que sobrevivam à anonimização do recurso. Atualizar inventário técnico
  LGPD com campos adicionados, mascaramento e limitação de retenção atual; não inventar prazo legal.

### 3. Login

- Registrar uma ocorrência por tentativa finalizada, abrangendo rejeições de DTO e throttle,
  que não passam pelo handler. Escolher ponto de captura que observe a resposta final e receba
  contexto seguro do auth service; evitar eventos duplicados entre guard, filtro e service.
- Usar motivos enumerados, status e correlação, sem serializar erro ou payload recebido.
- Falha do próprio gravador tem log operacional sanitizado e teste; não recursar na auditoria.
- Login inclui todos os perfis ativos. Renovação de token/troca de senha não é novo login.

### 4. Consulta e contratos

- `GET /audit`: DTO validado com período, usuário, casa, ação, tipo/ID de recurso, resultado,
  cursor e limite (default 50, máximo 100). Período padrão: últimos 30 dias.
- Ordenação estável por `created_at DESC, id DESC`; resposta `{ items, nextCursor }`.
  Limites de período inválidos, cursor inválido e filtros desconhecidos retornam erro validado.
- `GET /audit/events/:id`: detalhe ADMIN com diferenças e contexto; 404 quando ausente.
  Declarar rota específica antes da rota legada de dois parâmetros para evitar colisão.
- Índices de consulta coerentes com período e filtros; nada de carregar todos os logs em memória.
- Tipos e métodos no `@fonte/api-client`, reutilizando módulo `audit` existente; contratos
  compartilhados em `@fonte/types` quando consumidos por múltiplas camadas.
- Atualizar `fonte-api.postman_collection.json` com rotas, filtros, paginação e exemplos.

### 5. Tela administrativa

- Rota `/auditoria`, menu ADMIN e proteção de rota; autorização efetiva também no backend.
- Feature `features/audit/`: hooks, filtros, lista/linha, detalhe e constantes de labels.
  Page somente orquestra; query keys em `lib/queryKeys.ts`; filtros com react-hook-form + zod.
- Mostrar horário local, usuário (ou tentativa não autenticada), ação, recurso, casa e resultado.
  Mais recentes primeiro; filtros da API, carregar próxima página, limpar filtros e atualizar.
- Detalhe mostra tabela Campo / Antes / Depois, labels legíveis e marcadores de valor vazio,
  dado protegido e detalhe indisponível para eventos antigos. Sem JSON bruto como apresentação.
- Eventos sem diff (login/documentos) mostram contexto próprio. Recursos removidos continuam
  legíveis por ID; navegação para recurso só quando aplicável.
- Reutilizar LoadingState, EmptyState, ErrorState e getErrorMessage. Componentes pequenos,
  sem fetch na page nem itens complexos inline.

## Validação

### Backend

- `pnpm test:api`: testes do audit service, captura de contexto, projeções de diferenças,
  DTOs e instrumentação dos services. Cada ação do catálogo tem teste que prova autor,
  alvo, casa, resultado e diff correto; testar criação, edição, exclusão, no-op e lotes.
- Provar concorrência consistente, rollback conjunto quando auditoria falha, ausência de evento
  de sucesso em erro de negócio e apenas um evento no replay da mesma Idempotency-Key.
- Login: sucesso para perfis ativos; senha errada, usuário inativo/inexistente/ambíguo,
  DTO inválido, throttle e erro interno. Exatamente um evento por tentativa; credenciais nunca
  aparecem; falha da gravação mantém comportamento de autenticação e gera aviso sanitizado.
- Projeções: dados sensíveis mascarados na persistência e resposta; alterações protegidas
  continuam sinalizadas; anonimização não expõe dados anteriores nos novos diffs.
- `pnpm test:api:e2e`: login e uma operação real de cada domínio aparecem na consulta com
  detalhes corretos; matriz de permissões (ADMIN permitido, demais roles 403, anônimo 401),
  filtros combinados, limites, cursor estável com datas iguais, 404, eventos legados e replay.
- Executar nova migration no banco de teste, validar logs antigos preservados e novos campos
  opcionais; verificar índice e plano de consulta representativo.

### Adm e cliente HTTP

- `pnpm test:api-client`: transporte, filtros/cursor serializados e contrato do detalhe,
  preservando `audit.byTarget`.
- `pnpm test:adm:unit`: hooks e chaves, alteração/limpeza dos filtros reiniciando paginação,
  loading/empty/error/retry, labels, antes/depois, máscaras, eventos sem diff e legados.
- `pnpm test:adm` no novo spec de auditoria: ADMIN entra pelo menu, filtra ação recém-criada,
  abre detalhe e vê antes/depois; paginação; COORDINATOR/SERVANT sem menu e sem acesso direto.
- Fixtures próprias, IDs acumulados para cleanup e seed somente leitura. Cleanup de auditoria
  somente por IDs/correlação pertencentes ao teste, sem expor endpoint de exclusão.
- Validar sincronização offline/replay por teste de integração da API. Se implementação tocar
  código do ops, exigir também `pnpm test:ops:unit`, cobertura do ops, Playwright offline em
  `e2e-web/` e fluxo Maestro correspondente, preservando fila persistente.

### Builds e gate

- `pnpm build:types`, `pnpm build:api-client`, `pnpm build:api` e
  `pnpm --filter adm.fonte build`.
- **Gate de cobertura (trava a story):** código novo sem teste não fecha a story. Todo caminho
  novo ou alterado tem teste correspondente. Rodar `pnpm test:api:cov`,
  `pnpm test:api-client:cov` e `pnpm test:adm:unit:cov`; manter piso de 90% statements e não
  reduzir cobertura dos módulos afetados nem thresholds existentes. Sem `skip`/`only`/`xfail`
  sem justificativa explícita no código.

## Fora de escopo

- Instrumentar todos os demais módulos do sistema nesta primeira entrega.
- Histórico retroativo de ações que nunca foram registradas.
- Exportação CSV/PDF, alertas, dashboards estatísticos e busca no conteúdo de documentos.
- Auditar navegação/cliques locais ou horário de ação offline anterior à sincronização.
- Reverter alterações pela tela, edição de logs e mecanismos criptográficos contra adulteração
  por administrador do banco.
- Nova infraestrutura de filas, serviço externo de auditoria e definição de prazo legal de
  retenção. Preservar processos existentes e documentar limitações.
