import "dotenv/config";
import { writeFileSync } from "fs";
import { join } from "path";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { BackupService } from "../modules/backup/backup.service";

// Export local: baixa um snapshot completo (dump do banco + todos os arquivos
// do bucket) num .zip para guardar offsite na máquina do operador.
//
// Uso (de services/api, com .env apontando para PRODUÇÃO):
//   pnpm backup:export [diretório-de-saída]
//
// Requer pg_dump v16 instalado localmente.

const service = new BackupService(
  { get: (key: string) => process.env[key] } as unknown as ConfigService,
  {} as DataSource, // advisory lock não é usado no export
);

async function run() {
  const outDir = process.argv[2] ?? process.cwd();
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = join(outDir, `fonte-backup-${stamp}.zip`);

  console.log("Gerando dump do banco + baixando arquivos do bucket...");
  const zip = await service.exportToZip();
  writeFileSync(outPath, zip);
  console.log(`✓ Backup salvo em ${outPath} (${zip.length} bytes)`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
