import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '@fonte/types';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function seed() {
  await ds.initialize();

  const email = 'admin@fonte.com';
  const existing = await ds.query('SELECT id FROM users WHERE email = $1', [email]);

  const passwordHash = await bcrypt.hash('admin123', 10);

  if (existing.length > 0) {
    await ds.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    console.log('✓ Senha do usuário admin redefinida:');
  } else {
    await ds.query(
      `INSERT INTO users (id, email, password_hash, role, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, true)`,
      [email, passwordHash, Role.ADMIN],
    );
    console.log('✓ Usuário admin criado:');
  }

  console.log('  Email: admin@fonte.com');
  console.log('  Senha: admin123');

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
