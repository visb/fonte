import "dotenv/config";
import { DataSource } from "typeorm";
import {
  rebaseHtmlStorageUrls,
  rebaseStorageUrl,
} from "../modules/storage/storage.util";

// Rebase das URLs de storage persistidas no banco (story 188).
//
// O `upload()` grava a URL absoluta (`${publicBaseUrl}/${key}`), então trocar de
// provider deixa toda referência apontando para o endpoint antigo. Como o
// `backup:import` reenvia os objetos com a mesma key, a correção é troca de
// prefixo.
//
// Uso (de services/api, com .env apontando para o DESTINO):
//   pnpm storage:rebase-urls --from https://t3.storageapi.dev/<bucket-antigo>
//   pnpm storage:rebase-urls --from <base-antiga> --to <base-nova>
//
// Sem `--to`, usa `${AWS_ENDPOINT_URL}/${AWS_S3_BUCKET_NAME}` do .env corrente.
// Idempotente: rodar de novo não altera linha nenhuma.

/** Column groups to rebase. `html` columns hold rich text with <img src>. */
export interface RebaseTarget {
  table: string;
  columns: string[];
  kind: "url" | "html";
}

export const REBASE_TARGETS: RebaseTarget[] = [
  { table: "activity_attachments", columns: ["file_url"], kind: "url" },
  { table: "bible_course_class_photos", columns: ["file_url"], kind: "url" },
  { table: "house_photos", columns: ["url"], kind: "url" },
  { table: "messages", columns: ["attachment_url"], kind: "url" },
  {
    table: "payables",
    columns: ["attachment_url", "payment_receipt_url"],
    kind: "url",
  },
  { table: "relatives", columns: ["photo_url"], kind: "url" },
  { table: "resident_attachments", columns: ["file_url"], kind: "url" },
  { table: "resident_documents", columns: ["signed_file_url"], kind: "url" },
  { table: "resident_follow_ups", columns: ["attachment_url"], kind: "url" },
  { table: "resident_receivables", columns: ["attachment_url"], kind: "url" },
  {
    table: "residents",
    columns: ["photo_url", "photo_thumb_url"],
    kind: "url",
  },
  { table: "staff", columns: ["photo_url", "signature_url"], kind: "url" },
  { table: "staff_attachments", columns: ["file_url"], kind: "url" },
  { table: "document_templates", columns: ["content"], kind: "html" },
];

export interface RebaseResult {
  /** Rows actually updated, keyed by `table.column`. */
  updated: Record<string, number>;
  total: number;
}

/**
 * Rewrites every storage URL from `fromBase` to `toBase`, in one transaction.
 * Only rows whose value actually changes are written, so the run is idempotent
 * and the reported counts are honest.
 */
export async function rebaseStorageUrls(
  dataSource: DataSource,
  fromBase: string,
  toBase: string,
): Promise<RebaseResult> {
  if (!fromBase) throw new Error("--from é obrigatório (base de origem)");
  if (!toBase) throw new Error("--to vazio: informe a base de destino");
  if (fromBase === toBase) {
    throw new Error("--from e --to são iguais: nada a reescrever");
  }

  const updated: Record<string, number> = {};
  let total = 0;

  await dataSource.transaction(async (manager) => {
    for (const { table, columns, kind } of REBASE_TARGETS) {
      for (const column of columns) {
        const rows = await manager.query<Array<{ id: string; value: string }>>(
          `SELECT id, "${column}" AS value FROM ${table} WHERE "${column}" IS NOT NULL`,
        );

        let count = 0;
        for (const row of rows) {
          const next =
            kind === "html"
              ? rebaseHtmlStorageUrls(row.value, fromBase, toBase)
              : rebaseStorageUrl(row.value, fromBase, toBase);
          if (next === row.value) continue;
          await manager.query(
            `UPDATE ${table} SET "${column}" = $1 WHERE id = $2`,
            [next, row.id],
          );
          count++;
        }

        updated[`${table}.${column}`] = count;
        total += count;
      }
    }
  });

  return { updated, total };
}

/** Value of `--name`, or undefined if absent or followed by another flag. */
export function readFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const value = args[idx + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

export interface StorageEnv {
  AWS_ENDPOINT_URL?: string;
  AWS_S3_BUCKET_NAME?: string;
}

/**
 * Resolves the two bases from argv + env. `--from` is required and has no
 * default on purpose: guessing the source base and getting it wrong rewrites
 * the whole acervo to an invalid address, silently.
 */
export function resolveBases(
  args: string[],
  env: StorageEnv,
): { fromBase: string; toBase: string } {
  const fromBase = readFlag(args, "--from");
  if (!fromBase) {
    throw new Error(
      "Uso: pnpm storage:rebase-urls --from <base-antiga> [--to <base-nova>]\n" +
        "Sem --to, usa AWS_ENDPOINT_URL/AWS_S3_BUCKET_NAME do .env.",
    );
  }

  const toBase = readFlag(args, "--to");
  if (toBase) return { fromBase, toBase };

  const { AWS_ENDPOINT_URL, AWS_S3_BUCKET_NAME } = env;
  if (!AWS_ENDPOINT_URL || !AWS_S3_BUCKET_NAME) {
    throw new Error(
      "Sem --to, é preciso AWS_ENDPOINT_URL e AWS_S3_BUCKET_NAME no .env.",
    );
  }
  return { fromBase, toBase: `${AWS_ENDPOINT_URL}/${AWS_S3_BUCKET_NAME}` };
}

async function run() {
  const { fromBase, toBase } = resolveBases(process.argv.slice(2), process.env);

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
  });
  await dataSource.initialize();

  console.log(`De  : ${fromBase}`);
  console.log(`Para: ${toBase}\n`);

  try {
    const { updated, total } = await rebaseStorageUrls(
      dataSource,
      fromBase,
      toBase,
    );
    for (const [target, count] of Object.entries(updated)) {
      if (count > 0) console.log(`  ${target}: ${count}`);
    }
    console.log(`\n✓ ${total} linha(s) reescrita(s).`);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
