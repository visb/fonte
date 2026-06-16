jest.mock('@fonte/types', () => ({
  AssociateStatus: {
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    PAST_DUE: 'PAST_DUE',
    CANCELED: 'CANCELED',
  },
  SubscriptionStatus: { ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  ChargeStatus: { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' },
}));

import { AssociateStatus } from '@fonte/types';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AssociateChargeScheduler } from './associate-charge.scheduler';
import { Associate } from './associate.entity';
import { AssociateChargeNotification } from './associate-charge-notification.entity';
import { WhatsAppClient } from './whatsapp/whatsapp.types';

// ─── Factories ──────────────────────────────────────────────────────────────

function makeAssociate(overrides: Partial<Associate> = {}): Associate {
  return {
    id: 'a-1',
    name: 'João Doador',
    whatsapp: '+5562999998888',
    email: null,
    contributionAmount: 50,
    dueDay: 1,
    status: AssociateStatus.PENDING,
    abacatepayCustomerId: null,
    paymentToken: 'token-uuid-1',
    subscriptions: [],
    charges: [],
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as unknown as Associate;
}

function makeWhatsApp(sent = true): jest.Mocked<WhatsAppClient> {
  return {
    sendTemplate: jest
      .fn()
      .mockResolvedValue({ sent, messageId: sent ? 'wamid.123' : null }),
  };
}

function makeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function makeScheduler(opts: {
  candidates: Associate[];
  whatsapp?: jest.Mocked<WhatsAppClient>;
  recentlyNotified?: boolean;
  config?: ConfigService;
  notifFindOne?: Associate | null;
}) {
  const associateRepo = {
    find: jest.fn().mockResolvedValue(opts.candidates),
    findOne: jest
      .fn()
      .mockResolvedValue(
        opts.notifFindOne === undefined ? opts.candidates[0] ?? null : opts.notifFindOne,
      ),
  } as unknown as Repository<Associate>;

  const saved: AssociateChargeNotification[] = [];
  const notificationRepo = {
    exists: jest.fn().mockResolvedValue(opts.recentlyNotified ?? false),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => {
      saved.push(v);
      return Promise.resolve(v);
    }),
  } as unknown as Repository<AssociateChargeNotification>;

  const whatsapp = opts.whatsapp ?? makeWhatsApp();
  const scheduler = new AssociateChargeScheduler(
    associateRepo,
    notificationRepo,
    whatsapp,
    opts.config ?? makeConfig(),
  );

  return { scheduler, associateRepo, notificationRepo, whatsapp, saved };
}

// ─── runDailyChargeCheck — selection ─────────────────────────────────────────

describe('AssociateChargeScheduler.runDailyChargeCheck — selection', () => {
  it('queries only PENDING and PAST_DUE associates (ignores ACTIVE/CANCELED in DB query)', async () => {
    const { scheduler, associateRepo } = makeScheduler({ candidates: [] });
    await scheduler.runDailyChargeCheck();

    const where = (associateRepo.find as jest.Mock).mock.calls[0][0].where;
    // In() is built with the two chargeable statuses.
    expect(JSON.stringify(where)).toContain('PENDING');
    expect(JSON.stringify(where)).toContain('PAST_DUE');
    expect(JSON.stringify(where)).not.toContain('ACTIVE');
    expect(JSON.stringify(where)).not.toContain('CANCELED');
  });

  it('sends ADHESION for a PENDING associate whose due_day already passed', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.PENDING, dueDay: 1 });
    const { scheduler, whatsapp, saved } = makeScheduler({ candidates: [assoc] });

    const result = await scheduler.runDailyChargeCheck();

    expect(whatsapp.sendTemplate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ associateId: 'a-1', type: 'ADHESION', channel: 'WHATSAPP' });
  });

  it('skips a PENDING associate whose due_day is still in the future this month', async () => {
    // today is the 1st-ish in tests, force a high due_day so it never triggers.
    const assoc = makeAssociate({ status: AssociateStatus.PENDING, dueDay: 31 });
    const { scheduler, whatsapp } = makeScheduler({ candidates: [assoc] });

    // Pin "today" to the 10th so dueDay 31 is in the future.
    jest.spyOn(Date.prototype, 'getUTCDate').mockReturnValue(10);
    const result = await scheduler.runDailyChargeCheck();
    jest.restoreAllMocks();

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, skipped: 1 });
  });

  it('sends REACTIVATION for a PAST_DUE associate regardless of due_day', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.PAST_DUE, dueDay: 31 });
    const { scheduler, whatsapp, saved } = makeScheduler({ candidates: [assoc] });

    const result = await scheduler.runDailyChargeCheck();

    expect(whatsapp.sendTemplate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(saved[0]).toMatchObject({ type: 'REACTIVATION' });
  });
});

// ─── runDailyChargeCheck — dedupe ────────────────────────────────────────────

describe('AssociateChargeScheduler.runDailyChargeCheck — dedupe', () => {
  it('skips an associate already notified within the 5-day window', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.PAST_DUE });
    const { scheduler, whatsapp, notificationRepo } = makeScheduler({
      candidates: [assoc],
      recentlyNotified: true,
    });

    const result = await scheduler.runDailyChargeCheck();

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, skipped: 1 });
  });

  it('queries the dedupe window at ~5 days before now', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.PAST_DUE });
    const { scheduler, notificationRepo } = makeScheduler({ candidates: [assoc] });

    await scheduler.runDailyChargeCheck();

    const whereArg = (notificationRepo.exists as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.associateId).toBe('a-1');
    // sentAt is a MoreThanOrEqual(Date) FindOperator about 5 days back.
    const operatorValue = (whereArg.sentAt as { value: Date }).value;
    const diffDays = (Date.now() - operatorValue.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(4.5);
    expect(diffDays).toBeLessThan(5.5);
  });
});

// ─── runDailyChargeCheck — best-effort send ──────────────────────────────────

describe('AssociateChargeScheduler.runDailyChargeCheck — best-effort', () => {
  it('does not persist a log when WhatsApp send fails (so it retries next run)', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.PAST_DUE });
    const { scheduler, notificationRepo } = makeScheduler({
      candidates: [assoc],
      whatsapp: makeWhatsApp(false),
    });

    const result = await scheduler.runDailyChargeCheck();

    expect(notificationRepo.save).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, skipped: 1 });
  });

  it('builds the payment link from payment_token (via urlButtonParam)', async () => {
    const assoc = makeAssociate({
      status: AssociateStatus.PAST_DUE,
      paymentToken: 'pay-token-xyz',
    });
    const { scheduler, whatsapp } = makeScheduler({
      candidates: [assoc],
      config: makeConfig({ META_WA_TEMPLATE_NAME: 'cobranca_associado' }),
    });

    await scheduler.runDailyChargeCheck();

    expect(whatsapp.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        toE164: '+5562999998888',
        templateName: 'cobranca_associado',
        urlButtonParam: 'pay-token-xyz',
        variables: ['João Doador'],
      }),
    );
  });
});

// ─── chargeManually ──────────────────────────────────────────────────────────

describe('AssociateChargeScheduler.chargeManually', () => {
  it('sends and logs for a PENDING associate (ignoring due_day for manual trigger)', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.PENDING, dueDay: 31 });
    const { scheduler, whatsapp, saved } = makeScheduler({
      candidates: [assoc],
      notifFindOne: assoc,
    });

    const result = await scheduler.chargeManually('a-1');

    expect(whatsapp.sendTemplate).toHaveBeenCalledTimes(1);
    expect(saved[0]).toMatchObject({ type: 'ADHESION' });
    expect(result).toEqual({ sent: true, skipped: false });
  });

  it('skips when associate not found', async () => {
    const { scheduler, whatsapp } = makeScheduler({
      candidates: [],
      notifFindOne: null,
    });

    const result = await scheduler.chargeManually('missing');

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, skipped: true });
  });

  it('skips an ACTIVE associate (not chargeable)', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.ACTIVE });
    const { scheduler, whatsapp } = makeScheduler({
      candidates: [assoc],
      notifFindOne: assoc,
    });

    const result = await scheduler.chargeManually('a-1');

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, skipped: true });
  });

  it('skips when already notified within the dedupe window', async () => {
    const assoc = makeAssociate({ status: AssociateStatus.PAST_DUE });
    const { scheduler, whatsapp } = makeScheduler({
      candidates: [assoc],
      notifFindOne: assoc,
      recentlyNotified: true,
    });

    const result = await scheduler.chargeManually('a-1');

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, skipped: true });
  });
});
