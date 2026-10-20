# Fonte de Misericórdia

Plataforma operacional da comunidade terapêutica Fonte de Misericórdia.

Sistema modular composto por aplicações web e mobile para gestão administrativa, rotina interna, acompanhamento de internos e comunicação com familiares.

Versão inicial focada em simplicidade arquitetural, rodando em uma única instância (VPS), com backend centralizado.

---

# 1. Objetivo do Projeto

Digitalizar e organizar:

- Gestão da comunidade
- Jornada do interno (entrada → permanência → alta)
- Rotina diária
- Registro de ocorrências
- Comunicação com familiares

Objetivo principal da v1:
Entregar estabilidade operacional com baixo nível de complexidade técnica.

---

# 2. Produtos (Apps)

## adm.fonte (web)

Gestão administrativa da comunidade.

Responsabilidades:

- Cadastro de internos(filhos)
- Gestão de colaboradores(servos)
- Controle básico de dados
  - Casas
  - Ministérios(funciona como "setores" numa empresa)
  - Dispensa(individual para cada casa)
- Relatórios operacionais
  - Autonomia do estoque da dispensa com base no consumo médio da casa
  - Tempo médio de permanencia de filhos por casa
  - Relação de incidentes/filho por casa

---

## ops.fonte (mobile)

Aplicativo interno para operadores da casa.

Stakeholders:

- SERVANT
- Coordinator

Responsabilidades:

- Gestão dos internos
- Gerenciar ministérios
  - CRUD de ministérios
  - atribuir responsáveis e filhos designados
- Registro de rotina diária
- Registro de ocorrências
- Checklists operacionais
- Gestão da dispensa
  - Entrada
  - Saida
  - Conferencia
- Supervisão operacional

---

## app.fonte (mobile)

Aplicativo para familiares (role RELATIVE) — ativo.

Responsabilidades:

- Acompanhamento do interno
- Recebimento de atualizações
- Comunicação institucional

---

## resident.fonte (mobile)

Aplicativo para filhos internos na comunidade (planejado; role RESIDENT já ativa no backend).

App rodando em modo Kiosk, disponivel para os filhos utilizarem no dia a dia, com limite de 25 min de uso diário, não acumulativo.

Funcionalidades:

- Enviar mensagens para familiares
- Lista de pedidos para o dia da visita
- Cadastrar contatos

---

# 3. Arquitetura Geral

Monorepo estruturado em:

```
apps/
  adm.fonte/
  app.fonte/
  ops.fonte/
  resident.fonte/

services/
  api/

packages/
  shared/
  ui/
  types/
```

---

# 4. Stack Técnica

Backend:

- NestJS
- PostgreSQL
- JWT para autenticação

Frontend:

- Web: React
- Mobile: React Native (Expo)

Infraestrutura:

- 1 container
- 1 banco PostgreSQL
- Deploy em VPS

> **Backup (story 20):** o backup semanal usa `pg_dump`/`pg_restore` **v18** — o servidor de
> produção é 18.x e archive custom-format novo não é lido por `pg_restore` mais antigo. A
> imagem/host que roda a API precisa ter o `postgresql-client` v18 instalado (ex.: Alpine
> `apk add postgresql18-client`; Debian `postgresql-client-18`). O `Dockerfile` da raiz já faz
> isso. Ver skill `fonte-backup` (`.claude/skills/fonte-backup/`).

Sem microservices.
Sem mensageria.
Sem multi-tenant (neste momento).

---

# 5. Princípios Arquiteturais

- Arquitetura modular por domínio
- Controller fino
- Service com regra de negócio
- Repository isolando acesso ao banco
- DTO obrigatório para entrada/saída
- Soft delete em entidades críticas
- UUID como padrão de ID

---

# 6. Perfis de Usuário

- ADMIN
- COORDINATOR
- SERVANT
- RELATIVE (familiares — ativo, usado pelo app.fonte)
- RESIDENT (internos — ativo no backend; app/kiosk dedicado planejado)

---

# 7. Fluxos Principais

## Entrada de Interno

1. Cadastro
2. Status PRE_ADMISSION
3. Ativação (ACTIVE)
4. Associação à casa

## Rotina

1. Registro diário
2. Checklists
3. Ocorrências

## Alta

1. Atualização para DISCHARGED
2. Registro de data de saída
3. Ativação de acompanhamento (fase futura)

---

# 8. Roadmap Técnico

Fase 1:

- Auth
- CRUD Internos
- Registro de rotina
- Registro de ocorrências

Fase 2:

- Comunicação com familiares
- Relatórios

Fase 3:

- Pós-alta estruturado
- Métricas

---

# 9. Deploy no VPS

Toda a stack roda em Docker Compose num VPS único: `postgres` + `minio` + `api` + `nginx` +
`certbot`. **Só o nginx publica porta** (80/443); os demais ficam na rede interna.

Artefatos: `Dockerfile` (multi-stage, raiz), `docker-compose.prod.yml`, `docker/nginx/`.
O `docker-compose.yml` da raiz é o de **desenvolvimento** e não é usado em produção.

Hosts deste corte:

| Host | Serve |
|---|---|
| `adm.fontedemisericordia.com.br` | `adm.fonte` (Vite) + `/api/v1` |
| `ops.fontedemisericordia.com.br` | `ops.fonte` web (`expo export`) + `/api/v1` |
| `release.fontedemisericordia.com.br` | `release.fonte` (Vite, **sem** API): download do APK do ops + changelog — ver §9.7 |
| `static.fontedemisericordia.com.br` | proxy para o MinIO (**bucket privado**, só URL assinada) |

`portal.fonte` e `app.fonte` estão fora deste corte: não são buildados, não têm `server` block
e não entram em `CORS_ORIGIN`.

## 9.1 Pré-requisitos

1. Docker + Docker Compose no VPS, repositório clonado.
2. DNS: os **quatro** hosts apontando para o IP do VPS (o certbot só emite depois disso).
3. `.env` na **raiz** do repositório no VPS (nunca versionado). É ao mesmo tempo o arquivo de
   interpolação do compose e o `env_file` da API. Base: `services/api/.env.example`. Precisa
   conter, no mínimo:

```bash
POSTGRES_PASSWORD=...
MINIO_ROOT_USER=...
MINIO_ROOT_PASSWORD=...

DATABASE_URL=postgres://fonte:<POSTGRES_PASSWORD>@postgres:5432/fonte
JWT_SECRET=...
NODE_ENV=production
CORS_ORIGIN=https://adm.fontedemisericordia.com.br,https://ops.fontedemisericordia.com.br

# Storage: endpoint PÚBLICO, não http://minio:9000 (a assinatura cobre o host).
AWS_S3_BUCKET_NAME=fonte
AWS_ENDPOINT_URL=https://static.fontedemisericordia.com.br
AWS_DEFAULT_REGION=auto
AWS_ACCESS_KEY_ID=<MINIO_ROOT_USER>
AWS_SECRET_ACCESS_KEY=<MINIO_ROOT_PASSWORD>
```

> **URL da API é build-time nos front-ends.** `VITE_API_URL` (adm) e `EXPO_PUBLIC_API_URL` (ops)
> são embutidos no bundle pelo stage `build`. Trocar de domínio exige **rebuild da imagem**, não
> restart. Os defaults do compose já apontam para os hosts acima.

## 9.2 Imagens — build fora do VPS, registry no meio

**O VPS não compila.** Com 1 vCPU, buildar o monorepo (pnpm install de ~1200 deps, Chromium do
puppeteer, `sharp`/`bcrypt` nativos, Vite do adm e `expo export` do ops) é lento e disputa a
memória que a stack precisa para rodar. O `docker-compose.prod.yml` referencia
`ghcr.io/visb/fonte-api` e `ghcr.io/visb/fonte-web`; o VPS só faz `pull`.

O build roda **fora**: hoje na máquina do operador, depois no GitHub Actions. O bloco `build:`
de cada serviço fica comentado no compose para o caso de precisar buildar no lugar.

**Na máquina que builda** (precisa ser `linux/amd64`, igual ao VPS):

```bash
docker build --target api -t ghcr.io/visb/fonte-api:latest .
docker build --target web -t ghcr.io/visb/fonte-web:latest \
  --build-arg VITE_API_URL=https://adm.fontedemisericordia.com.br/api/v1 \
  --build-arg EXPO_PUBLIC_API_URL=https://ops.fontedemisericordia.com.br/api/v1 .

echo $GHCR_TOKEN | docker login ghcr.io -u <usuário> --password-stdin
docker push ghcr.io/visb/fonte-api:latest
docker push ghcr.io/visb/fonte-web:latest
```

> A URL da API é **build-time** nos dois front-ends. Trocar de domínio exige rebuild **e push**
> da imagem `web` — `restart` não resolve.

**No VPS** (token separado, só `read:packages`):

```bash
echo $GHCR_READ_TOKEN | docker login ghcr.io -u <usuário> --password-stdin
docker compose -f docker-compose.prod.yml pull
```

Confira que o cliente do Postgres na imagem da API é **18** (é o que permite restaurar o dump da
story 188):

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh api -c "pg_dump --version && pg_restore --version"
```

## 9.3 Ordem de bootstrap do TLS (é aqui que a montagem trava)

Ovo e galinha: o nginx **não sobe** com `ssl_certificate` apontando para arquivo inexistente, e o
certbot **não emite** sem o nginx respondendo na porta 80. A ordem correta:

**1. Suba banco, storage e API** (não dependem de TLS):

```bash
docker compose -f docker-compose.prod.yml up -d postgres minio api
```

**2. Suba o nginx com a config só-HTTP** (`docker/nginx/bootstrap.conf`), montada por cima da
config final:

```bash
docker compose -f docker-compose.prod.yml run -d --service-ports \
  -v ./docker/nginx/bootstrap.conf:/etc/nginx/conf.d/default.conf:ro \
  --name fonte-nginx-bootstrap nginx
```

**3. Emita os certificados** (um por host — a assinatura e o `server_name` são por host):

```bash
for host in adm ops release static; do
  docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot \
    certonly --webroot -w /var/www/certbot \
    -d $host.fontedemisericordia.com.br \
    --email <email> --agree-tos --no-eff-email
done
```

**4. Derrube o nginx de bootstrap e suba a stack completa** — agora com a config final, que
encontra os certificados no volume `certbot_conf`:

```bash
docker rm -f fonte-nginx-bootstrap
docker compose -f docker-compose.prod.yml up -d
```

**5. Prove a renovação** (não basta a emissão inicial ter funcionado):

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot renew --dry-run
```

> **Renovação exige reload.** Certificado renovado sem `nginx -s reload` **não vale**: o nginx
> segue servindo o antigo até reiniciar, e o site cai quando o velho expira. O serviço `nginx`
> do compose já recarrega sozinho a cada 6h justamente por isso — se você trocar esse `command`,
> reponha o reload por outro caminho (cron no host ou `--deploy-hook`).

## 9.4 Criar o bucket no MinIO

O bucket é **privado**: nenhuma policy anônima de leitura. O que libera o objeto é a URL
assinada emitida pela API (`StorageUrlInterceptor`). Bucket público anula o presign inteiro e
deixa prontuário e documento assinado acessíveis sem autenticação.

```bash
docker compose -f docker-compose.prod.yml exec minio \
  mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
docker compose -f docker-compose.prod.yml exec minio mc mb --ignore-existing local/fonte
docker compose -f docker-compose.prod.yml exec minio mc anonymous set none local/fonte
```

Crie também o **segundo** bucket do backup (story 20) se `BACKUP_ENABLED=true`:
`mc mb --ignore-existing local/fonte-backup`.

Verificação que prova o modelo de acesso: pegue a URL **canônica** de um arquivo (sem a query
`X-Amz-*`) e acesse direto — tem de ser **negado**. Se servir o arquivo, a policy está errada.

## 9.5 Popular banco e bucket

Ambiente pronto ≠ ambiente com dados. A carga do snapshot de produção (dump + acervo) é a
**story 188**.

> **Os scripts `pnpm` do `services/api/package.json` NÃO funcionam dentro da imagem.** Todos
> rodam via `npx ts-node src/database/*.ts`, e a imagem de produção só carrega o `dist/` — o
> `src/` não é copiado. Dentro do container, chame o JS compilado direto:
> `node dist/database/<script>.js`. Os scripts `pnpm` seguem válidos em desenvolvimento.

> **O restore exige banco VAZIO.** O dump traz schema **e** dados, inclusive a tabela
> `migrations` com as linhas da origem. Se as migrations já rodaram (o `CMD` da imagem roda
> `migration:run` a cada boot), o `pg_restore --clean` tenta derrubar o schema objeto por
> objeto sem `CASCADE` e trava nas FKs cruzadas — termina com `errors ignored on restore` e o
> banco fica num estado meio-restaurado que não serve.
>
> Por isso o import roda num container **avulso** (`run`, não `exec`): `run` não passa pelo
> `CMD`, então não dispara migration no meio da operação.

**1. Derrube a API** para ninguém recriar schema durante a carga:

```bash
docker compose -f docker-compose.prod.yml stop api
```

**2. Zere o banco** (pule só se ele nunca subiu):

```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U fonte -d postgres \
  -c "DROP DATABASE IF EXISTS fonte;"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U fonte -d postgres \
  -c "CREATE DATABASE fonte OWNER fonte;"
```

**3. Importe** o zip gerado pelo `backup:export` — montado no container avulso (não use
`docker cp` para `/tmp`: o diretório some no recreate do container):

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -v /opt/fonte/fonte-backup-AAAA-MM-DD.zip:/tmp/backup.zip \
  --entrypoint node api dist/database/backup-import.js /tmp/backup.zip --yes
```

Espere `✓ Banco restaurado e N arquivo(s) reenviado(s).` **sem** linha de `errors ignored`.

**4. Suba a API.** O `migration:run` do boot encontra as migrations já aplicadas (vieram no
dump) e não faz nada:

```bash
docker compose -f docker-compose.prod.yml up -d api
```

**5. Rebase das URLs** — o `upload()` grava URL absoluta, então o dump restaurado ainda aponta
para o endpoint de origem. O import reenvia os objetos com a mesma key, então é troca de
prefixo:

```bash
docker compose -f docker-compose.prod.yml exec -T api \
  node dist/database/rewrite-storage-urls.js --from https://<endpoint-antigo>/<bucket-antigo>
```

O `--to` sai do `.env` (`AWS_ENDPOINT_URL` + `AWS_S3_BUCKET_NAME`). **Rode uma segunda vez:**
tem de reescrever **zero** linhas. É assim que se confere que terminou — e que o rebase é
idempotente de verdade.

**6. Confirme no navegador:** login nos dois hosts, foto de residente renderizando, e a URL da
imagem começando com o host do storage **e contendo `X-Amz-Signature=`**. A URL canônica (sem a
query) tem de dar 403.

## 9.6 Deploy automático (GitHub Actions)

São dois workflows, e a separação é deliberada.

**`ci.yml`** roda a cada push na `main`, em dois estágios encadeados:

1. **`coverage-gate`** — suíte de todos os pacotes com o piso de cobertura. Já existia.
2. **`images`** — depende do gate (nada é publicado com a suíte vermelha), só em push na
   `main`. Builda `api` e `web` e publica no GHCR com duas tags: `latest` e o **SHA** do
   commit. O SHA é o que permite voltar sem rebuildar.

3. **`deploy`** — chama `deploy.yml` e manda o servidor puxar o que acabou de ser publicado.

**`deploy.yml`** é reutilizável: o CI o chama no passo 3, e ele também aceita **disparo manual**
(Actions → Deploy → Run workflow), útil para reimplantar sem commit — mudou o `.env` do
servidor, quer reaplicar o compose, ou está voltando de um rollback.

> **Todo push na `main` que passar no gate vai para produção**, sem aprovação no meio. Foi
> decisão consciente: *required reviewer* de GitHub Environment exige plano pago em repositório
> privado, e declarar `environment:` sem ele seria decoração sugerindo uma proteção inexistente.
> O que de fato limita o estrago é a chave SSH — o `authorized_keys` do VPS a amarra por
> `command=` ao `/opt/fonte/deploy.sh`, então ela não abre shell nem executa outra coisa.

### Configuração (uma vez)

**No VPS** — chave dedicada, amarrada a um único comando:

```bash
install -m 755 /opt/fonte/docker/deploy.sh /opt/fonte/deploy.sh
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /root/.ssh/gha_deploy -N ""
```

Acrescente a **pública** ao `/root/.ssh/authorized_keys` prefixada pelo forced command — é isto
que impede a chave de abrir shell:

```
command="/opt/fonte/deploy.sh",no-port-forwarding,no-agent-forwarding,no-pty,no-user-rc ssh-ed25519 AAAA... github-actions-deploy
```

> O forced command é o controle de verdade. Estar no grupo `docker` já equivale a root, então
> criar um usuário separado compraria pouco; o que limita o estrago é a chave não conseguir
> executar nada além do script.

**No GitHub** — Settings → Secrets and variables → Actions:

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP do servidor |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | conteúdo de `/root/.ssh/gha_deploy` (a **privada**) |

E Settings → Environments → **New environment** `production` → marque **Required reviewers** e
adicione você mesmo. Sem isso o deploy deixa de ter aprovação manual.

> **Pacote e permissão:** as imagens no GHCR foram criadas por um token pessoal. Para o
> `GITHUB_TOKEN` do Actions conseguir publicar, cada pacote precisa estar ligado ao
> repositório: Packages → `fonte-api` → Package settings → Manage Actions access → adicionar o
> repositório com role **Write**. Idem `fonte-web`. Sem isso o push falha com `denied`.

### Rollback

```bash
IMAGE_TAG=<sha-do-commit-bom> docker compose -f docker-compose.prod.yml up -d api nginx
```

## 9.7 Releases e APK do ops (`release.fonte`)

Uma release é a **versão da plataforma inteira** (tag git `vX.Y.Z`; a versão é o `version` de
`apps/ops.fonte/package.json`, de onde o `android.versionCode` deriva). Quem prepara é a skill
`/release` (`.claude/skills/fonte-release/`): escreve o changelog
(`apps/release.fonte/content/releases/vX.Y.Z.md`), faz o bump, o smoke do APK, o commit
`chore(release): vX.Y.Z` e a tag anotada — e **para**. O push é seu:

```bash
git push origin main --follow-tags
```

O push da tag dispara o `.github/workflows/release.yml`: confere tag × `package.json` × changelog,
compila o APK **assinado** em Linux (`arm64-v8a`), publica `ghcr.io/visb/fonte-apk:<versão>` (+
`:latest`) com `ops-<versão>.apk` e `latest.json`, reconstrói o `fonte-web` com o APK novo em
`/srv/release/downloads/` e chama o `deploy.yml`. Todo build da `main` copia o último
`fonte-apk:latest`; antes da primeira release, a home mostra "APK ainda não publicado".

Ensaio sem publicar: Actions → Release → Run workflow com uma tag existente e `publish`
desmarcado — builda e confere a assinatura do APK, sem imagem e sem deploy.

### DNS e certificado (uma vez)

1. Cloudflare: registro `A` `release` → IP do VPS, **nuvem cinza** (DNS only), como os demais — o
   certbot valida por HTTP na porta 80 e o nginx termina o TLS.
2. Com a stack no ar (o bloco da porta 80 já atende o ACME do host `release.`):

```bash
docker compose -f docker-compose.prod.yml run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d release.fontedemisericordia.com.br \
  --email <email> --agree-tos --no-eff-email
```

3. Habilite o host — o `server` do `release.` é **opcional**
   (`docker/nginx/sites/`): o `docker/nginx/enable-sites.sh` só o liga quando o certificado
   existe, no boot do nginx e antes de cada reload de 6h. Para entrar na hora:

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

Por isso a config pode chegar à produção (deploy automático da `main`) **antes** do certificado
sem derrubar adm, ops e storage: até lá o host `release.` só não tem `server` 443 e cai no
catch-all da `default.conf`, que recusa o handshake TLS (antes ele abria o adm). A renovação
segue a do certbot (§9.3).

### Keystore de release do ops (uma vez — e o backup é para sempre)

O APK é assinado com uma keystore **fixa**. Sem ela o Android recusa atualizar por cima, e
desinstalar apaga o banco local e a **fila offline** do ops. **Perder a keystore = todo mundo
desinstala e reinstala.** Ela nunca entra no git.

**Gerar** (máquina do responsável, JDK instalado):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore ops-release.keystore \
  -alias ops -keyalg RSA -keysize 4096 -validity 10000
```

**Cadastrar** em GitHub → Settings → Secrets and variables → Actions:

| Secret | Valor |
|---|---|
| `OPS_KEYSTORE_BASE64` | `base64 -w0 ops-release.keystore` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("ops-release.keystore"))`) |
| `OPS_KEYSTORE_PASSWORD` | senha da keystore |
| `OPS_KEY_ALIAS` | `ops` (o `-alias` usado acima) |
| `OPS_KEY_PASSWORD` | senha da chave (em PKCS12, a mesma da keystore) |

Faltando qualquer um, o `release.yml` falha — nunca publica APK debug-signed. O passo
"Conferir assinatura" roda `apksigner verify --print-certs` e reprova certificado debug.

**Backup:** guarde o arquivo `.keystore` **e** as senhas em dois lugares fora do VPS e do GitHub
(ex.: cofre de senhas + mídia offline). Os secrets do GitHub não são recuperáveis — só
sobrescrevíveis.

**Build local assinado (opcional):** exporte `OPS_KEYSTORE_PATH` (caminho do arquivo),
`OPS_KEYSTORE_PASSWORD`, `OPS_KEY_ALIAS` e `OPS_KEY_PASSWORD` antes do `expo prebuild` e do
`gradlew`. Sem nenhuma delas o build sai debug-signed (smoke); com só parte delas o
`app.config.js` recusa a config.

**Rotação** (só se a chave vazar ou se perder): gere uma nova keystore, troque os quatro secrets e
publique uma release com `breaking: true` no changelog — todos precisam sincronizar as
pendências, desinstalar e instalar de novo, exatamente como na primeira versão assinada.

### Primeira versão assinada

Quem tem hoje o APK debug-signed (recebido por fora) precisa **desinstalar uma vez** para
instalar a `v1.0.0` — antes, abrir o app com internet e confirmar que a tela de pendências está
vazia. Da `v1.0.0` em diante, toda atualização instala por cima. Conferência manual a cada
release nova: instalar por cima num aparelho físico e confirmar que login, dados locais e fila
offline sobrevivem.

## 9.8 Limites conhecidos

- **MinIO no mesmo VPS não é backup** — os bytes ficam no mesmo disco do Postgres. Destino
  offsite segue em aberto (story 20).
- **CI/CD não entra neste corte:** o build e o push da imagem são manuais, feitos na máquina do
  operador. Mover isso para o GitHub Actions é o próximo passo natural — o caminho de
  distribuição (GHCR) já está provado.
- **Os scripts CLI do `services/api/package.json` são de desenvolvimento.** Usam
  `npx ts-node src/database/*.ts`; a imagem de produção não carrega `src/`. Dentro do
  container, chame `node dist/database/<script>.js` (ver §9.5).
- O `docker-compose.yml` de **dev** roda Postgres **16** enquanto produção roda **18** —
  divergência conhecida e registrada na story 189.

---

Louvado seja o nome do nosso senhor Jesus Cristo!
