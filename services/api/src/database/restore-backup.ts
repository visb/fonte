import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { BackupService } from "../modules/backup/backup.service";

// Restore a partir do bucket de backup (nuvem).
//
// Uso (de services/api, com .env apontando para o destino):
//   pnpm backup:restore                 → lista os dumps disponíveis
//   pnpm backup:restore --db <key>      → restaura o banco a partir do dump (DESTRUTIVO)
//   pnpm backup:restore --files         → re-copia os arquivos do backup p/ produção
//
// Requer pg_restore v16 instalado localmente.

const service = new BackupService(
  { get: (key: string) => process.env[key] } as unknown as ConfigService,
  {} as DataSource,
);

async function run() {
  const args = process.argv.slice(2);
  const dbFlag = args.indexOf("--db");

  if (dbFlag !== -1) {
    const key = args[dbFlag + 1];
    if (!key) {
      console.error("Informe a chave do dump: pnpm backup:restore --db db/<arquivo>.dump");
      process.exit(1);
    }
    console.log(`Restaurando banco a partir de ${key} (destrutivo)...`);
    await service.restoreDatabaseFromBucket(key);
    console.log("✓ Banco restaurado.");
    return;
  }

  if (args.includes("--files")) {
    console.log("Re-copiando arquivos do bucket de backup para produção...");
    const { restored } = await service.restoreFilesFromBucket();
    console.log(`✓ ${restored} arquivo(s) restaurado(s).`);
    return;
  }

  const backups = await service.listBackups();
  if (backups.length === 0) {
    console.log("Nenhum backup encontrado no bucket.");
    return;
  }
  console.log("Dumps disponíveis (mais recente primeiro):");
  for (const b of backups) {
    console.log(`  ${b.key}\t${b.size} bytes\t${b.createdAt}`);
  }
  console.log("\nPara restaurar: pnpm backup:restore --db <key>");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
