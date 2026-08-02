# Plan: isolar `clear-bucket.spec` do `.env` da máquina

## Context

`services/api/src/database/clear-bucket.spec.ts:144` falha em qualquer máquina cujo `.env` do api
tenha credenciais S3 reais — o que inclui a máquina de desenvolvimento atual. Foi verificado na
`main` limpa, sem nenhuma mudança de código, durante a rodada 153-154.

**Causa raiz.** O teste chama `buildStorage()`
(`src/database/clear-bucket.ts:67-72`), que constrói um `ConfigService` falso lendo **`process.env`
direto**:

```ts
const config = { get: (key: string) => process.env[key] } as unknown as ConfigService;
return new StorageService(config);
```

O spec então afirma `expect(storage.isS3Mode()).toBe(false)`, com o comentário
`// No S3 env in the test process → local (non-S3) mode.` Essa premissa é **falsa**: o processo de
teste carrega o `.env` do api, que numa máquina configurada para o bucket real tem as variáveis S3
preenchidas. Resultado: `isS3Mode()` devolve `true` e o teste quebra — não por regressão, mas por
configuração de ambiente.

O sintoma é duplamente ruim: **falha em quem tem o ambiente completo e passa em quem não tem**, ou
seja, é exatamente ao contrário do que se espera de um teste. Além do ruído, ele treina a equipe a
ignorar vermelho na suíte — durante a rodada 153-154 foi preciso verificar manualmente, duas vezes,
que essa falha era pré-existente antes de cada merge.

⚠️ **Atenção de segurança ao implementar:** o `.env` local do api aponta para infraestrutura de
**produção** (banco e bucket). O `clear-bucket` é um script **destrutivo** (apaga todos os objetos
do bucket). Ao mexer neste spec, nunca executar `main()` nem `run({ argv: ['--yes'] })` contra
`process.env` real — todo teste tem que injetar `storage`/`bucketName` fabricados, como os testes
já existentes do `describe('clear-bucket run')` fazem corretamente.

### Decisões travadas

1. **O teste passa a controlar o ambiente que ele testa**, em vez de assumir um. Salvar
   `process.env` no `beforeEach`, deletar/definir explicitamente as chaves relevantes
   (`AWS_S3_BUCKET_NAME`, `AWS_ENDPOINT_URL` e as demais que o `StorageService` lê) e restaurar no
   `afterEach`. Teste que depende de ambiente tem que **construir** esse ambiente.
2. **Cobrir os dois ramos, não só um.** Hoje só existe o caso "sem S3 → modo local". Passa a haver
   também "com env S3 preenchido → `isS3Mode()` é `true`". O ramo que hoje acidentalmente executa
   nesta máquina vira caso de teste declarado.
3. **Valores fabricados e obviamente falsos** nas variáveis do caso S3 (`test-bucket`,
   `https://s3.invalid`) — nunca copiar credencial real do `.env`, nunca commitar segredo.
   `buildStorage()` só instancia o `StorageService`; não abre conexão. Confirmar isso ao
   implementar e, se o construtor fizer I/O, ajustar a abordagem.
4. **`src/database/clear-bucket.ts` não muda.** `buildStorage()` ler `process.env` é o
   comportamento correto para um script de CLI. O defeito está na premissa do teste, não na função.
   (Alternativa considerada e **rejeitada**: fazer `buildStorage` aceitar um env injetável só para
   agradar o teste — muda código de produção para acomodar um teste mal escrito.)
5. **Corrigir o comentário mentiroso da linha 143.** Ele afirma uma premissa de ambiente que a
   story acabou de derrubar; deixá-lo lá reproduz o erro na próxima leitura.

Não depende de nenhuma story em aberto. Encosta na [[20-backup-banco-bucket]] / no runbook
`fonte-backup`, de onde o `clear-bucket` faz parte do ferramental.

## Desenho

1. **`src/database/clear-bucket.spec.ts`**, no `describe('clear-bucket buildStorage')`:
   - `beforeEach`: guardar cópia de `process.env`; `afterEach`: restaurar (`process.env = { ...saved }`).
   - Caso **local**: apagar as chaves S3 do env → `expect(storage.isS3Mode()).toBe(false)`.
   - Caso **S3**: definir as chaves com valores fabricados → `expect(storage.isS3Mode()).toBe(true)`.
   - Reescrever o comentário da linha 143.
2. Levantar, ao implementar, **exatamente quais chaves** o `StorageService` consulta para decidir
   `isS3Mode()` (ler o service — não adivinhar pela lista do `clear-bucket.ts`) e limpar/definir
   todas elas. Limpar só `AWS_S3_BUCKET_NAME` pode não bastar.
3. **Varrer o restante da suíte** atrás do mesmo antipadrão — outros specs que leem `process.env`
   sem controlá-lo. Relatar o que achar; corrigir fora do `clear-bucket` só se for trivial e no
   mesmo espírito, senão vira story própria.
4. Sem mudança de rota, DTO, service ou schema ⇒ **sem alteração no
   `fonte-api.postman_collection.json`** e **sem migration**.

## Validação

Testes por camada tocada, sem `skip`/`only`/`xfail` injustificado.

- **`pnpm test:api`** — suíte verde. Especificamente, `clear-bucket.spec.ts` **8/8 → 9/9**, com a
  falha da linha 144 eliminada.
- **Casos a cobrir / o que o teste prova:**
  - `buildStorage()` devolve storage em **modo local** quando o env não tem as chaves S3;
  - `buildStorage()` devolve storage em **modo S3** quando as chaves estão presentes;
  - os 7 testes já existentes (`isConfirmed`, `run` com/sem `--yes`, bucket vazio, env faltando,
    fallback para `console`) continuam verdes e **continuam injetando** `storage`/`bucketName`
    fabricados, sem tocar `process.env` real;
  - `process.env` é restaurado ao fim — provado rodando `clear-bucket.spec` **junto da suíte
    completa** e não só isolado, para garantir que o teste não vaza ambiente para os vizinhos.
- **Prova de que o isolamento funciona (obrigatória):** rodar `pnpm test:api` **duas vezes** — uma
  com as variáveis S3 presentes no ambiente e outra com elas ausentes — e obter o **mesmo
  resultado** nas duas. É o ponto inteiro da story: o teste deixa de depender da máquina.
- **Nunca** executar o script contra o bucket real durante a validação (ver aviso de segurança no
  Context).

> **Gate de cobertura (trava a story):** todo caminho novo ou alterado tem teste correspondente —
> nenhum código novo entra sem teste. Rodar `pnpm test:api:cov`; **não reduzir** a cobertura dos
> módulos afetados; o ramo S3 do `buildStorage` passa a estar coberto. Sem `skip`/`only`/`xfail`
> sem justificativa no código (CLAUDE.md).

## Fora de escopo

- Mudar `buildStorage()` ou qualquer coisa em `src/database/clear-bucket.ts` (decisão 4).
- Mudar o `StorageService` ou a forma como ele decide `isS3Mode()`.
- Testar o `clear-bucket` contra um bucket real ou um MinIO/localstack — os testes seguem com
  storage fabricado.
- Refatorar outros specs acoplados a `process.env` (só relatar — decisão/passo 3).
- Rever a configuração do `.env` local da máquina ou separar env de teste do env de dev; é um
  problema real e adjacente, mas maior que esta story.
