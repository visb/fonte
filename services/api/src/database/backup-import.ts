import "dotenv/config";
import { readFileSync } from "fs";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { BackupService } from "../modules/backup/backup.service";

// Import local (DESTRUTIVO): restaura banco + arquivos a partir de um .zip
// gerado por `backup:export`. Sobrescreve o banco (pg_restore --clean) e
// reenvia os arquivos para o bucket configurado.
//
// Uso (de services/api, com .env apontando para o destino):
//   pnpm backup:import <arquivo.zip> --yes
//
// Requer pg_restore v16 instalado localmente.

const service = new BackupService(
  { get: (key: string) => process.env[key] } as unknown as ConfigService,
  {} as DataSource,
);

async function run() {
  const zipPath = process.argv[2];
  const confirmed = process.argv.includes("--yes");

  if (!zipPath || zipPath.startsWith("--")) {
    console.error("Uso: pnpm backup:import <arquivo.zip> --yes");
    process.exit(1);
  }
  if (!confirmed) {
    console.error(
      "Operação destrutiva: vai sobrescrever o banco e o bucket apontados no .env.\n" +
        "Confirme adicionando --yes ao comando.",
    );
    process.exit(1);
  }

  console.log(`Restaurando a partir de ${zipPath}...`);
  const zip = readFileSync(zipPath);
  const { filesRestored } = await service.importFromZip(zip);
  console.log(`✓ Banco restaurado e ${filesRestored} arquivo(s) reenviado(s).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
