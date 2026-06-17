import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { DataSource } from 'typeorm';
import { PayableCategory, PayableStatus } from '@fonte/types';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

interface PayableSeed {
  description: string;
  amount: number; // centavos
  dueDate: string;
  category: PayableCategory;
  supplier: string | null;
  status: PayableStatus;
  paidAt: string | null;
  notes: string | null;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Data relativa ao "hoje" para o seed sempre ter contas vencidas, a vencer e pagas.
function buildPayables(): PayableSeed[] {
  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offset);
    return iso(d);
  };

  return [
    // ── Vencidas (OPEN, due_date no passado) ───────────────────────────────────
    {
      description: 'Conta de energia - mês passado',
      amount: 187_45,
      dueDate: day(-12),
      category: PayableCategory.UTILITIES,
      supplier: 'Enel',
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: 'Casa sede',
    },
    {
      description: 'Conta de água - mês passado',
      amount: 96_30,
      dueDate: day(-7),
      category: PayableCategory.UTILITIES,
      supplier: 'Saneago',
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: null,
    },
    {
      description: 'Manutenção do telhado',
      amount: 1_250_00,
      dueDate: day(-3),
      category: PayableCategory.MAINTENANCE,
      supplier: 'Reformas Silva',
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: 'Goteira no refeitório',
    },

    // ── A vencer (OPEN, due_date no futuro) ────────────────────────────────────
    {
      description: 'Internet e telefonia',
      amount: 219_90,
      dueDate: day(5),
      category: PayableCategory.UTILITIES,
      supplier: 'Vivo',
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: null,
    },
    {
      description: 'Compra de mantimentos',
      amount: 2_340_00,
      dueDate: day(8),
      category: PayableCategory.SUPPLIES,
      supplier: 'Atacadão',
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: 'Cesta básica do mês',
    },
    {
      description: 'Gás de cozinha (3 botijões)',
      amount: 360_00,
      dueDate: day(10),
      category: PayableCategory.SUPPLIES,
      supplier: 'Ultragaz',
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: null,
    },
    {
      description: 'Salário - cozinheira',
      amount: 1_650_00,
      dueDate: day(15),
      category: PayableCategory.PAYROLL,
      supplier: null,
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: null,
    },
    {
      description: 'Material de limpeza',
      amount: 480_75,
      dueDate: day(18),
      category: PayableCategory.SUPPLIES,
      supplier: 'Distribuidora Higiene+',
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: null,
    },
    {
      description: 'INSS / encargos',
      amount: 890_00,
      dueDate: day(20),
      category: PayableCategory.TAXES,
      supplier: null,
      status: PayableStatus.OPEN,
      paidAt: null,
      notes: 'Guia do mês',
    },

    // ── Pagas (PAID) ───────────────────────────────────────────────────────────
    {
      description: 'Conta de energia - 2 meses atrás',
      amount: 201_10,
      dueDate: day(-42),
      category: PayableCategory.UTILITIES,
      supplier: 'Enel',
      status: PayableStatus.PAID,
      paidAt: day(-40),
      notes: null,
    },
    {
      description: 'Manutenção elétrica',
      amount: 540_00,
      dueDate: day(-30),
      category: PayableCategory.MAINTENANCE,
      supplier: 'Elétrica Luz',
      status: PayableStatus.PAID,
      paidAt: day(-29),
      notes: 'Troca de disjuntores',
    },
    {
      description: 'Compra de medicamentos',
      amount: 730_55,
      dueDate: day(-25),
      category: PayableCategory.OTHER,
      supplier: 'Farmácia Popular',
      status: PayableStatus.PAID,
      paidAt: day(-25),
      notes: null,
    },
    {
      description: 'Salário - auxiliar de serviços',
      amount: 1_500_00,
      dueDate: day(-20),
      category: PayableCategory.PAYROLL,
      supplier: null,
      status: PayableStatus.PAID,
      paidAt: day(-20),
      notes: null,
    },
  ];
}

async function seed() {
  await ds.initialize();

  // Autor das contas: qualquer ADMIN existente (created_by é nullable).
  const adminRows = await ds.query<{ id: string }[]>(
    `SELECT u.id FROM users u WHERE u.role = 'ADMIN' LIMIT 1`,
  );
  const createdBy = adminRows[0]?.id ?? null;

  // Limpa dados de demonstração anteriores e regenera.
  await ds.query(`DELETE FROM payables`);

  const entries = buildPayables();

  const placeholders = entries
    .map((_, j) => {
      const b = j * 9;
      return `(gen_random_uuid(), $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9})`;
    })
    .join(', ');

  const values = entries.flatMap((e) => [
    e.description,
    e.amount,
    e.dueDate,
    e.category,
    e.supplier,
    e.status,
    e.paidAt,
    e.notes,
    createdBy,
  ]);

  await ds.query(
    `INSERT INTO payables
       (id, description, amount, due_date, category, supplier, status, paid_at, notes, created_by)
     VALUES ${placeholders}`,
    values,
  );

  const fmt = (centavos: number) =>
    (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const open = entries.filter((e) => e.status === PayableStatus.OPEN);
  const paid = entries.filter((e) => e.status === PayableStatus.PAID);
  const sum = (list: PayableSeed[]) => list.reduce((acc, e) => acc + e.amount, 0);

  console.log('\n✓ Payables seed complete');
  console.log(`  Author (created_by): ${createdBy ?? '(nenhum admin encontrado — null)'}`);
  console.log(`  Em aberto: ${open.length} contas  →  ${fmt(sum(open))}`);
  console.log(`  Pagas:     ${paid.length} contas  →  ${fmt(sum(paid))}`);
  console.log(`  Total:     ${entries.length} registros inseridos\n`);

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
