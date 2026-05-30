import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { DataSource } from 'typeorm';
import { StreetSaleType } from '@fonte/types';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

// Deterministic pseudo-random — same inputs always produce same output
function rng(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

interface SaleEntry {
  houseId: string;
  staffId: string | null;
  date: string;
  type: StreetSaleType;
  quantity: number;
  amountPix: number;
  amountCash: number;
  amountCard: number;
}

// Returns all dates in [start, end) that match the given weekdays (0=Sun … 6=Sat)
function datesForWeekdays(start: Date, end: Date, weekdays: number[]): Date[] {
  const result: Date[] = [];
  const cur = new Date(start);
  while (cur < end) {
    if (weekdays.includes(cur.getUTCDay())) {
      result.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildSales(
  houses: { id: string; name: string }[],
  staffByHouse: Map<string, string | null>,
  periodStart: Date,
  periodEnd: Date,
): SaleEntry[] {
  const entries: SaleEntry[] = [];

  // Bread: Mon Tue Wed Thu Fri Sat — 6 days/week
  const breadDays = datesForWeekdays(periodStart, periodEnd, [1, 2, 3, 4, 5, 6]);
  // Pizza: Tue Fri Sat — 3 days/week
  const pizzaDays = datesForWeekdays(periodStart, periodEnd, [2, 5, 6]);

  for (let hi = 0; hi < houses.length; hi++) {
    const house = houses[hi];
    const staffId = staffByHouse.get(house.id) ?? null;
    const hSeed = (hi + 1) * 1000;

    for (const d of breadDays) {
      const ts = d.getTime();
      const s1 = hSeed + ts / 86400000;

      const total = 15000 + Math.floor(rng(s1) * 45000);       // R$150–R$600
      const pix   = Math.floor(total * (0.40 + rng(s1 + 1) * 0.15));
      const cash  = Math.floor(total * (0.28 + rng(s1 + 2) * 0.12));
      const card  = total - pix - cash;
      const qty   = 20 + Math.floor(rng(s1 + 3) * 60);         // 20–80 units

      entries.push({
        houseId: house.id, staffId, date: toISO(d),
        type: StreetSaleType.BREAD,
        quantity: qty, amountPix: pix, amountCash: cash, amountCard: card,
      });
    }

    for (const d of pizzaDays) {
      const ts = d.getTime();
      const s1 = hSeed + ts / 86400000 + 500;

      const total = 25000 + Math.floor(rng(s1) * 65000);       // R$250–R$900
      const pix   = Math.floor(total * (0.42 + rng(s1 + 1) * 0.13));
      const cash  = Math.floor(total * (0.25 + rng(s1 + 2) * 0.15));
      const card  = total - pix - cash;
      const qty   = 8 + Math.floor(rng(s1 + 3) * 22);          // 8–30 pizzas

      entries.push({
        houseId: house.id, staffId, date: toISO(d),
        type: StreetSaleType.PIZZA,
        quantity: qty, amountPix: pix, amountCash: cash, amountCard: card,
      });
    }
  }

  return entries;
}

async function seed() {
  await ds.initialize();

  // ── Discover existing houses & staff ────────────────────────────────────────
  const houses = await ds.query<{ id: string; name: string }[]>(
    `SELECT id, name FROM houses ORDER BY name`,
  );

  if (houses.length === 0) {
    console.error('No houses found. Run the main seed first (pnpm seed:api) or create at least one house.');
    await ds.destroy();
    process.exit(1);
  }

  // For each house, grab any coordinator/staff user id
  const staffByHouse = new Map<string, string | null>();
  for (const h of houses) {
    const rows = await ds.query<{ id: string }[]>(
      `SELECT s.id FROM staff s
       JOIN users u ON u.id = s.user_id
       WHERE s.house_id = $1
         AND u.role IN ('COORDINATOR', 'ADMIN')
       LIMIT 1`,
      [h.id],
    );
    staffByHouse.set(h.id, rows[0]?.id ?? null);
  }

  // ── Period: last 4 calendar months ──────────────────────────────────────────
  const today = new Date();
  const periodEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, 1));

  // ── Clear previous demo data and regenerate ──────────────────────────────────
  await ds.query(`DELETE FROM street_sales`);

  const entries = buildSales(houses, staffByHouse, periodStart, periodEnd);

  // Batch insert in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const placeholders = chunk.map((_, j) => {
      const base = j * 8;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    }).join(', ');

    const values = chunk.flatMap((e) => [
      e.houseId, e.staffId, e.date, e.type,
      e.quantity, e.amountPix, e.amountCash, e.amountCard,
    ]);

    await ds.query(
      `INSERT INTO street_sales
         (id, house_id, registered_by, date, type, quantity, amount_pix, amount_cash, amount_card)
       VALUES ${chunk.map((_, j) => {
         const b = j * 8;
         return `(gen_random_uuid(), $${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, $${b+6}, $${b+7}, $${b+8})`;
       }).join(', ')}`,
      values,
    );
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const breadCount = entries.filter((e) => e.type === StreetSaleType.BREAD).length;
  const pizzaCount = entries.filter((e) => e.type === StreetSaleType.PIZZA).length;

  const breadTotal = entries
    .filter((e) => e.type === StreetSaleType.BREAD)
    .reduce((acc, e) => acc + e.amountPix + e.amountCash + e.amountCard, 0);

  const pizzaTotal = entries
    .filter((e) => e.type === StreetSaleType.PIZZA)
    .reduce((acc, e) => acc + e.amountPix + e.amountCash + e.amountCard, 0);

  const fmt = (centavos: number) =>
    (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  console.log('\n✓ Street sales seed complete');
  console.log(`  Period:  ${toISO(periodStart)} → ${toISO(periodEnd)}`);
  console.log(`  Houses:  ${houses.map((h) => h.name).join(', ')}`);
  console.log(`  Bread:   ${breadCount} entries  →  ${fmt(breadTotal)}`);
  console.log(`  Pizza:   ${pizzaCount} entries  →  ${fmt(pizzaTotal)}`);
  console.log(`  Total:   ${entries.length} records inserted\n`);

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
