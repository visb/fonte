import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });
import { DataSource } from 'typeorm';

// Caminhos relativos AO PRÓPRIO ARQUIVO, não ao cwd. Em dev isto roda via
// ts-node a partir de `src/`; na imagem de produção roda o `dist/` compilado,
// onde `src/` sequer é copiado. Globs fixos em 'src/**' faziam o
// `migration:run` do boot casar zero arquivos e sair com SUCESSO — a tabela
// `migrations` era criada vazia e o schema nunca existia (a API subia, e só
// quebrava no primeiro request que tocasse uma tabela).
//
// A extensão vem do arquivo corrente porque o build emite 362 `.d.ts` ao lado
// dos `.js`: um glob `*.{ts,js}` casaria os dois e o TypeORM tentaria carregar
// declaração de tipo como entity/migration.
//
// `replace` normaliza a barra: em Windows `__dirname` vem com `\`, que o glob
// do TypeORM não casa.
const here = __dirname.replace(/\\/g, '/');
const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [`${here}/../**/*.entity.${ext}`],
  migrations: [`${here}/migrations/*.${ext}`],
  synchronize: false,
});
