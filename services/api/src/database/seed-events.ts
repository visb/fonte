import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { DataSource } from 'typeorm';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

interface EventSeed {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  capacity: number | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  registrations: { name: string; contact: string; email: string | null }[];
}

// Returns a Date offset by `days` (and optional hour) from now, in UTC.
function at(days: number, hour = 19, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function buildEvents(): EventSeed[] {
  return [
    // ── Past event (already happened, registration closed) ──────────────────
    {
      title: 'Culto de Ação de Graças',
      description:
        'Celebração com toda a comunidade, famílias e voluntários. Louvor, partilha de testemunhos e ceia comunitária.',
      startAt: at(-30, 19),
      endAt: at(-30, 22),
      location: 'Sede Fonte de Misericórdia — Salão Principal',
      capacity: 200,
      registrationOpensAt: at(-60),
      registrationClosesAt: at(-31),
      registrations: [
        { name: 'Maria Aparecida Souza', contact: '(11) 98123-4567', email: 'maria.souza@example.com' },
        { name: 'João Batista Lima', contact: '(11) 99876-5432', email: null },
        { name: 'Ana Clara Ferreira', contact: 'ana.ferreira@example.com', email: 'ana.ferreira@example.com' },
      ],
    },

    // ── Ongoing registration, near future, limited capacity ─────────────────
    {
      title: 'Retiro de Famílias 2026',
      description:
        'Fim de semana de oração, palestras e atividades para familiares dos internos. Inclui almoço e material de apoio.',
      startAt: at(14, 8),
      endAt: at(15, 17),
      location: 'Chácara Betânia — Estrada do Campo, km 12',
      capacity: 80,
      registrationOpensAt: at(-7),
      registrationClosesAt: at(10),
      registrations: [
        { name: 'Pedro Henrique Alves', contact: '(11) 97654-3210', email: 'pedro.alves@example.com' },
        { name: 'Luana Rodrigues', contact: '(11) 96543-2109', email: null },
      ],
    },

    // ── Future, unlimited capacity, no registration window ──────────────────
    {
      title: 'Bazar Beneficente Fonte',
      description:
        'Venda de pães, pizzas e artesanato produzidos pelas casas. Renda revertida para manutenção da comunidade.',
      startAt: at(45, 9),
      endAt: at(45, 16),
      location: 'Praça Central — Centro',
      capacity: null,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrations: [],
    },

    // ── Future, registration not yet open ───────────────────────────────────
    {
      title: 'Formatura — Turma de Reintegração',
      description:
        'Cerimônia de conclusão do programa de recuperação. Momento de celebração com famílias, padrinhos e equipe.',
      startAt: at(90, 19, 30),
      endAt: at(90, 22),
      location: 'Sede Fonte de Misericórdia — Auditório',
      capacity: 150,
      registrationOpensAt: at(30),
      registrationClosesAt: at(85),
      registrations: [],
    },

    // ── Small workshop, almost full ─────────────────────────────────────────
    {
      title: 'Oficina de Panificação',
      description:
        'Curso prático de produção de pães para voluntários e familiares interessados em apoiar a padaria da casa.',
      startAt: at(21, 14),
      endAt: at(21, 17),
      location: 'Casa São José — Cozinha Industrial',
      capacity: 12,
      registrationOpensAt: at(-3),
      registrationClosesAt: at(18),
      registrations: [
        { name: 'Carlos Eduardo Pinto', contact: '(11) 95432-1098', email: 'carlos.pinto@example.com' },
        { name: 'Fernanda Gomes', contact: '(11) 94321-0987', email: null },
        { name: 'Roberto Carlos Dias', contact: 'roberto.dias@example.com', email: 'roberto.dias@example.com' },
        { name: 'Juliana Martins', contact: '(11) 93210-9876', email: null },
        { name: 'Marcos Vinícius Costa', contact: '(11) 92109-8765', email: 'marcos.costa@example.com' },
      ],
    },
  ];
}

async function seed() {
  await ds.initialize();

  const events = buildEvents();

  // Clear previous demo data (registrations cascade via FK, but delete explicitly to be safe).
  await ds.query(`DELETE FROM event_registrations`);
  await ds.query(`DELETE FROM events`);

  let totalRegistrations = 0;

  for (const e of events) {
    const inserted = await ds.query<{ id: string }[]>(
      `INSERT INTO events
         (id, title, description, start_at, end_at, location, capacity,
          banner_key, registration_opens_at, registration_closes_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NULL, $7, $8)
       RETURNING id`,
      [
        e.title,
        e.description,
        e.startAt.toISOString(),
        e.endAt?.toISOString() ?? null,
        e.location,
        e.capacity,
        e.registrationOpensAt?.toISOString() ?? null,
        e.registrationClosesAt?.toISOString() ?? null,
      ],
    );
    const eventId = inserted[0].id;

    for (const r of e.registrations) {
      await ds.query(
        `INSERT INTO event_registrations (id, event_id, name, contact, email)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
        [eventId, r.name, r.contact, r.email],
      );
      totalRegistrations++;
    }
  }

  console.log('\n✓ Events seed complete');
  console.log(`  Events:        ${events.length}`);
  console.log(`  Registrations: ${totalRegistrations}`);
  for (const e of events) {
    console.log(
      `    • ${e.title} — ${e.startAt.toISOString().slice(0, 10)} (${e.registrations.length} inscritos)`,
    );
  }
  console.log('');

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
