import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  AssociateStatus,
  SubscriptionStatus,
  ChargeStatus,
} from '@fonte/types';
import { computeGrossUp } from '../modules/associate/gross-up';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

// Card fee rates — mirror associate-payment.service.ts defaults / env (Pagar.me).
const FEE_PCT = Number(process.env.PAGARME_CARD_FEE_PCT ?? '0.0399');
const FEE_FIXED = Number(process.env.PAGARME_CARD_FEE_FIXED ?? '0.39');

const fmtBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

/** First day of the month, `offset` months from `base` (UTC). */
function monthStart(base: Date, offset: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
}

interface ChargePlan {
  monthOffset: number; // relative to current month (0 = this month)
  status: ChargeStatus;
  paid: boolean;
}

interface AssociatePlan {
  name: string;
  whatsapp: string;
  email: string | null;
  contribution: number; // net BRL the Fonte receives
  dueDay: number;
  status: AssociateStatus;
  subscription: { status: SubscriptionStatus; canceled: boolean } | null;
  charges: ChargePlan[];
  notifications: { type: 'ADHESION' | 'REACTIVATION'; monthOffset: number }[];
}

// ── Demo associates — one per lifecycle status ────────────────────────────────
const PLANS: AssociatePlan[] = [
  {
    name: 'Maria das Graças Oliveira',
    whatsapp: '5562998877001',
    email: 'maria.gracas@example.com',
    contribution: 50,
    dueDay: 5,
    status: AssociateStatus.ACTIVE,
    subscription: { status: SubscriptionStatus.ACTIVE, canceled: false },
    charges: [
      { monthOffset: -2, status: ChargeStatus.PAID, paid: true },
      { monthOffset: -1, status: ChargeStatus.PAID, paid: true },
      { monthOffset: 0, status: ChargeStatus.PAID, paid: true },
    ],
    notifications: [{ type: 'ADHESION', monthOffset: -2 }],
  },
  {
    name: 'João Pedro Marinho',
    whatsapp: '5562998877002',
    email: 'joao.marinho@example.com',
    contribution: 100,
    dueDay: 10,
    status: AssociateStatus.ACTIVE,
    subscription: { status: SubscriptionStatus.ACTIVE, canceled: false },
    charges: [
      { monthOffset: -1, status: ChargeStatus.PAID, paid: true },
      { monthOffset: 0, status: ChargeStatus.PENDING, paid: false },
    ],
    notifications: [{ type: 'ADHESION', monthOffset: -1 }],
  },
  {
    name: 'Ana Beatriz Souza',
    whatsapp: '5562998877003',
    email: null,
    contribution: 30,
    dueDay: 15,
    status: AssociateStatus.PAST_DUE,
    subscription: { status: SubscriptionStatus.PAST_DUE, canceled: false },
    charges: [
      { monthOffset: -2, status: ChargeStatus.PAID, paid: true },
      { monthOffset: -1, status: ChargeStatus.FAILED, paid: false },
      { monthOffset: 0, status: ChargeStatus.FAILED, paid: false },
    ],
    notifications: [{ type: 'ADHESION', monthOffset: -2 }],
  },
  {
    name: 'Carlos Eduardo Lima',
    whatsapp: '5562998877004',
    email: 'carlos.lima@example.com',
    contribution: 75,
    dueDay: 20,
    status: AssociateStatus.CANCELED,
    subscription: { status: SubscriptionStatus.CANCELED, canceled: true },
    charges: [
      { monthOffset: -3, status: ChargeStatus.PAID, paid: true },
      { monthOffset: -2, status: ChargeStatus.PAID, paid: true },
    ],
    notifications: [
      { type: 'ADHESION', monthOffset: -3 },
      { type: 'REACTIVATION', monthOffset: -1 },
    ],
  },
  {
    name: 'Fernanda Ribeiro Alves',
    whatsapp: '5562998877005',
    email: 'fernanda.alves@example.com',
    contribution: 25,
    dueDay: 1,
    status: AssociateStatus.PENDING,
    subscription: null,
    charges: [],
    notifications: [],
  },
];

async function seed() {
  await ds.initialize();

  const today = new Date();

  // ── Clear previous demo associates (cascade children) ──────────────────────
  const demoNumbers = PLANS.map((p) => p.whatsapp);
  const existing = await ds.query<{ id: string }[]>(
    `SELECT id FROM associates WHERE whatsapp = ANY($1)`,
    [demoNumbers],
  );
  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    await ds.query(`DELETE FROM associate_charge_notifications WHERE associate_id = ANY($1)`, [ids]);
    await ds.query(`DELETE FROM associate_charges WHERE associate_id = ANY($1)`, [ids]);
    await ds.query(`DELETE FROM associate_subscriptions WHERE associate_id = ANY($1)`, [ids]);
    await ds.query(`DELETE FROM associates WHERE id = ANY($1)`, [ids]);
  }

  let associateCount = 0;
  let subscriptionCount = 0;
  let chargeCount = 0;
  let notificationCount = 0;

  for (const plan of PLANS) {
    const { net, fee, gross } = computeGrossUp(plan.contribution, FEE_PCT, FEE_FIXED);
    const associateId = randomUUID();
    const paymentToken = randomUUID();

    await ds.query(
      `INSERT INTO associates
         (id, name, whatsapp, email, contribution_amount, due_day, status,
          gateway_customer_id, payment_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        associateId,
        plan.name,
        plan.whatsapp,
        plan.email,
        net,
        plan.dueDay,
        plan.status,
        plan.subscription ? `cus_demo_${plan.dueDay}` : null,
        paymentToken,
      ],
    );
    associateCount++;

    let subscriptionId: string | null = null;
    if (plan.subscription) {
      subscriptionId = randomUUID();
      const startedAt = monthStart(today, -3);
      const canceledAt = plan.subscription.canceled ? monthStart(today, -1) : null;
      await ds.query(
        `INSERT INTO associate_subscriptions
           (id, associate_id, gateway_subscription_id, net_amount, fee_amount,
            gross_amount, status, started_at, canceled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          subscriptionId,
          associateId,
          `sub_demo_${plan.dueDay}`,
          net,
          fee,
          gross,
          plan.subscription.status,
          startedAt,
          canceledAt,
        ],
      );
      subscriptionCount++;
    }

    for (const c of plan.charges) {
      const dueMonth = monthStart(today, c.monthOffset);
      const dueDate = new Date(
        Date.UTC(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth(), plan.dueDay),
      );
      const paidAt = c.paid
        ? new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), plan.dueDay, 12, 0, 0))
        : null;
      await ds.query(
        `INSERT INTO associate_charges
           (id, associate_id, subscription_id, gateway_charge_id, net_amount,
            fee_amount, gross_amount, status, due_date, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          randomUUID(),
          associateId,
          subscriptionId,
          `ch_demo_${plan.dueDay}_${c.monthOffset}`,
          net,
          fee,
          gross,
          c.status,
          toISODate(dueDate),
          paidAt,
        ],
      );
      chargeCount++;
    }

    for (const n of plan.notifications) {
      const sentAt = monthStart(today, n.monthOffset);
      await ds.query(
        `INSERT INTO associate_charge_notifications
           (id, associate_id, channel, type, sent_at)
         VALUES ($1, $2, 'WHATSAPP', $3, $4)`,
        [randomUUID(), associateId, n.type, sentAt],
      );
      notificationCount++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✓ Associates seed complete');
  console.log(`  Fee rates:     ${(FEE_PCT * 100).toFixed(2)}% + ${fmtBRL(FEE_FIXED)} fixed`);
  console.log(`  Associates:    ${associateCount}`);
  for (const plan of PLANS) {
    console.log(`    • ${plan.name.padEnd(28)} ${plan.status.padEnd(9)} ${fmtBRL(plan.contribution)}/mês`);
  }
  console.log(`  Subscriptions: ${subscriptionCount}`);
  console.log(`  Charges:       ${chargeCount}`);
  console.log(`  Notifications: ${notificationCount}\n`);

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Associates seed failed:', err);
  process.exit(1);
});
