import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "../modules/storage/storage.service";

// Esvazia (wipe total) o bucket S3 PRINCIPAL apontado pelo .env corrente
// (`AWS_S3_BUCKET_NAME`): deleta todos os objetos, preserva o bucket. NÃO
// consulta o banco — diferente da limpeza de órfãos (story 93). O alvo é sempre
// o bucket principal do ambiente carregado no .env; não recebe nome por
// argumento (evita apontar para o bucket errado).
//
// Uso (de services/api, com .env apontando para o destino):
//   # dry-run (lista o que apagaria, NÃO apaga):
//   pnpm bucket:clear
//   # executa a deleção (DESTRUTIVO):
//   pnpm bucket:clear --yes

const SAMPLE_SIZE = 10;

// Decisão isolada e testável: só executa a deleção quando o operador confirma
// explicitamente com --yes. Sem a flag, o script fica em dry-run.
export function isConfirmed(argv: string[]): boolean {
  return argv.includes("--yes");
}

export interface RunDeps {
  storage: Pick<StorageService, "listBucketKeys" | "clearBucket">;
  argv: string[];
  bucketName?: string;
  endpoint?: string;
  logger?: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

// Orquestra dry-run/confirmação e logs; a lógica S3 mora no StorageService.
// Retorna o exit code (0 ok, 1 erro de configuração).
export async function run(deps: RunDeps): Promise<number> {
  const log = deps.logger?.log ?? console.log;
  const error = deps.logger?.error ?? console.error;

  if (!deps.bucketName || !deps.endpoint) {
    error(
      "AWS_S3_BUCKET_NAME e AWS_ENDPOINT_URL devem estar definidos no .env " +
        "para esvaziar o bucket (o script não roda em modo local/uploads).",
    );
    return 1;
  }

  log(`Bucket alvo: ${deps.bucketName} @ ${deps.endpoint}`);

  const keys = await deps.storage.listBucketKeys();
  if (keys.length === 0) {
    log("Bucket já vazio. Nada a fazer.");
    return 0;
  }

  if (!isConfirmed(deps.argv)) {
    log(`[dry-run] ${keys.length} objeto(s) seriam apagados. Amostra:`);
    for (const key of keys.slice(0, SAMPLE_SIZE)) log(`  - ${key}`);
    log("Nada foi apagado. Confirme com --yes para executar a deleção.");
    return 0;
  }

  const { deleted } = await deps.storage.clearBucket();
  log(`✓ ${deleted} objeto(s) apagado(s) de ${deps.bucketName}.`);
  return 0;
}

export function buildStorage(): StorageService {
  const config = {
    get: (key: string) => process.env[key],
  } as unknown as ConfigService;
  return new StorageService(config);
}

export async function main(): Promise<void> {
  const code = await run({
    storage: buildStorage(),
    argv: process.argv,
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    endpoint: process.env.AWS_ENDPOINT_URL,
  });
  process.exit(code);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
