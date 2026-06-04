import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role, ResidentStatus, StaffPermissionType, MessageStatus, WishlistStatus } from '@fonte/types';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL_TEST,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function truncateTables(ds: DataSource) {
  await ds.query(`
    TRUNCATE TABLE
      street_sales,
      support_group_relative_checkins,
      support_group_checkins,
      support_group_meetings,
      support_groups,
      wishlist_items,
      messages,
      storeroom_movements,
      storeroom_items,
      incidents,
      ministry_tasks,
      ministry_staff,
      ministries,
      routine_entries,
      relatives,
      resident_usage_sessions,
      residents,
      staff_permissions,
      staff,
      house_rules,
      house_photos,
      houses,
      users,
      app_settings
    RESTART IDENTITY CASCADE
  `);
}

async function seed() {
  await ds.initialize();

  await truncateTables(ds);

  const passwordHash = await bcrypt.hash('admin123', 10);
  const coordHash = await bcrypt.hash('coord123', 10);
  const operatorHash = await bcrypt.hash('operator123', 10);
  const residentHash = await bcrypt.hash('resident123', 10);
  const relativeHash = await bcrypt.hash('familiar123', 10);

  // Admin user
  const [adminUser] = await ds.query<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password)
     VALUES (gen_random_uuid(), $1, $2, $3, true, false) RETURNING id`,
    ['admin@fonte.com', passwordHash, Role.ADMIN],
  );

  // Coordinator user
  const [coordUser] = await ds.query<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password)
     VALUES (gen_random_uuid(), $1, $2, $3, true, false) RETURNING id`,
    ['coord@fonte.com', coordHash, Role.COORDINATOR],
  );

  // Operator user
  const [operatorUser] = await ds.query<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password)
     VALUES (gen_random_uuid(), $1, $2, $3, true, false) RETURNING id`,
    ['operator@fonte.com', operatorHash, Role.SERVANT],
  );

  // Resident user (for kiosk login)
  const [residentUser] = await ds.query<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password)
     VALUES (gen_random_uuid(), $1, $2, $3, true, false) RETURNING id`,
    ['resident@teste.com', residentHash, Role.RESIDENT],
  );

  // Relative user
  const [relativeUser] = await ds.query<{ id: string }[]>(
    `INSERT INTO users (id, email, password_hash, role, is_active, must_change_password)
     VALUES (gen_random_uuid(), $1, $2, $3, true, false) RETURNING id`,
    ['familiar@fonte.com', relativeHash, Role.RELATIVE],
  );

  // Admin staff record (needed so admin shows up in staff list)
  await ds.query(
    `INSERT INTO staff (id, name, user_id, house_id)
     VALUES (gen_random_uuid(), $1, $2, NULL)`,
    ['Admin Teste', adminUser.id],
  );

  // House
  const [house] = await ds.query<{ id: string }[]>(
    `INSERT INTO houses (id, name, general_capacity, staff_capacity, address, phone)
     VALUES (gen_random_uuid(), $1, 10, 5, $2, $3) RETURNING id`,
    ['Casa Teste', 'Rua das Flores, 123', '(11) 99999-9999'],
  );

  // Coordinator staff linked to house
  await ds.query(
    `INSERT INTO staff (id, name, user_id, house_id)
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    ['Coordenador Teste', coordUser.id, house.id],
  );

  // Operator staff linked to house
  const [operatorStaff] = await ds.query<{ id: string }[]>(
    `INSERT INTO staff (id, name, user_id, house_id)
     VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`,
    ['Operador Teste', operatorUser.id, house.id],
  );

  // Operator permissions: send messages + moderate
  await ds.query(
    `INSERT INTO staff_permissions (id, staff_id, permission_type)
     VALUES (gen_random_uuid(), $1, $2), (gen_random_uuid(), $1, $3)`,
    [operatorStaff.id, StaffPermissionType.SEND_MESSAGES_TO_FAMILIES, StaffPermissionType.MODERATE_MESSAGES],
  );

  // Resident linked to house, with userId (access already generated)
  const [resident] = await ds.query<{ id: string }[]>(
    `INSERT INTO residents (id, name, house_id, status, entry_date, user_id)
     VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, $4) RETURNING id`,
    ['João Testador', house.id, ResidentStatus.ACTIVE, residentUser.id],
  );

  // Relative linked to resident, with userId + mustChangePassword false
  const [relative] = await ds.query<{ id: string }[]>(
    `INSERT INTO relatives (id, name, resident_id, relationship, user_id)
     VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`,
    ['Maria Testadora', resident.id, 'Mãe', relativeUser.id],
  );

  // Approved wishlist item for resident
  await ds.query(
    `INSERT INTO wishlist_items (id, resident_id, description, quantity, status, created_by_user_id, approved_by_user_id, approved_at)
     VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5, NOW())`,
    [resident.id, 'Bermuda azul tamanho M', WishlistStatus.APPROVED, relativeUser.id, operatorUser.id],
  );

  // Approved message in relative/resident thread
  await ds.query(
    `INSERT INTO messages (id, resident_id, relative_id, sender_user_id, content, status, approved_by_user_id, approved_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
    [resident.id, relative.id, relativeUser.id, 'Olá, como você está?', MessageStatus.APPROVED, operatorUser.id],
  );

  // Support group with meeting (for checkin flow)
  const [supportGroup] = await ds.query<{ id: string }[]>(
    `INSERT INTO support_groups (id, name, church_name, address, day_of_week)
     VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`,
    ['Grupo Esperança', 'Igreja Esperança', 'Rua dos Grupos, 456', 0],
  );

  await ds.query(
    `INSERT INTO support_group_meetings (id, support_group_id, date, checkin_token)
     VALUES (gen_random_uuid(), $1, CURRENT_DATE, gen_random_uuid())`,
    [supportGroup.id],
  );

  // Ministry linked to house
  await ds.query(
    `INSERT INTO ministries (id, name, house_id)
     VALUES (gen_random_uuid(), $1, $2)`,
    ['Cozinha', house.id],
  );

  // Storeroom item linked to house
  await ds.query(
    `INSERT INTO storeroom_items (id, name, unit, current_quantity, house_id)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
    ['Arroz', 'kg', 10, house.id],
  );

  console.log('✓ Banco de testes populado:');
  console.log('  Admin:        admin@fonte.com / admin123');
  console.log('  Coordenador:  coord@fonte.com / coord123');
  console.log('  Operador:     operator@fonte.com / operator123');
  console.log('  Residente:    resident@teste.com / resident123');
  console.log('  Familiar:     familiar@fonte.com / familiar123');
  console.log('  Casa:         Casa Teste');
  console.log('  Acolhido:     João Testador (com acesso gerado)');
  console.log('  Familiar:     Maria Testadora (com acesso gerado)');
  console.log('  Ministério:   Cozinha');
  console.log('  Dispensa:     Arroz (10 kg)');
  console.log('  Wishlist:     Bermuda azul tamanho M (aprovado)');
  console.log('  Mensagem:     "Olá, como você está?" (aprovada)');
  console.log('  Grupo apoio:  Grupo Esperança (reunião hoje)');

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Erro no seed de testes:', err);
  process.exit(1);
});
