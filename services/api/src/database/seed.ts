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

  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].id;
    await ds.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    console.log('✓ Senha do usuário admin redefinida:');
  } else {
    const inserted = await ds.query(
      `INSERT INTO users (id, email, password_hash, role, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, true)
       RETURNING id`,
      [email, passwordHash, Role.ADMIN],
    );
    userId = inserted[0].id;
    console.log('✓ Usuário admin criado:');
  }

  console.log('  Email: admin@fonte.com');
  console.log('  Senha: admin123');

  const existingStaff = await ds.query('SELECT id FROM staff WHERE user_id = $1', [userId]);
  if (existingStaff.length === 0) {
    await ds.query(
      `INSERT INTO staff (id, name, user_id, house_id, phone, photo_url, support_group_id)
       VALUES (gen_random_uuid(), $1, $2, NULL, NULL, NULL, NULL)`,
      ['Administrador', userId],
    );
    console.log('✓ Staff profile criado para admin');
  }

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
