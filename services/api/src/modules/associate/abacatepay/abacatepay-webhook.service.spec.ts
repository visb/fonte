jest.mock('@fonte/types', () => ({
  AssociateStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  SubscriptionStatus: { ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  ChargeStatus: { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' },
}));

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AssociateStatus, ChargeStatus, SubscriptionStatus } from '@fonte/types';
import { AbacatePayWebhookService } from './abacatepay-webhook.service';
import { Associate } from '../associate.entity';
import { AssociateSubscription } from '../associate-subscription.entity';
import { AssociateCharge } from '../associate-charge.entity';

function makeConfig(secret: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'ABACATEPAY_WEBHOOK_SECRET' ? secret : undefined),
  } as unknown as ConfigService;
}

function setup(opts: {
  charge?: Partial<AssociateCharge> | null;
  subscription?: Partial<AssociateSubscription> | null;
  secret?: string | undefined;
}) {
  const charge = opts.charge
    ? ({ id: 'c1', status: ChargeStatus.PENDING, abacatepayChargeId: null, ...opts.charge } as AssociateCharge)
    : null;
  const subscription = opts.subscription
    ? ({ id: 's1', associateId: 'a1', status: SubscriptionStatus.ACTIVE, ...opts.subscription } as AssociateSubscription)
    : null;

  const associateRepo = { update: jest.fn().mockResolvedValue({}) } as unknown as Repository<Associate>;
  const subRepo = {
    findOne: jest.fn().mockResolvedValue(subscription),
    save: jest.fn((s) => Promise.resolve(s)),
  } as unknown as Repository<AssociateSubscription>;
  const chargeRepo = {
    findOne: jest.fn().mockResolvedValue(charge),
    save: jest.fn((c) => Promise.resolve(c)),
  } as unknown as Repository<AssociateCharge>;

  const service = new AbacatePayWebhookService(
    associateRepo,
    subRepo,
    chargeRepo,
    makeConfig('secret' in opts ? opts.secret : 'right_secret'),
  );
  return { service, associateRepo, subRepo, chargeRepo, charge, subscription };
}

describe('AbacatePayWebhookService', () => {
  describe('verifySecret', () => {
    it('accepts the matching secret', () => {
      const { service } = setup({ secret: 'right_secret' });
      expect(() => service.verifySecret('right_secret')).not.toThrow();
    });
    it('rejects a wrong/missing secret', () => {
      const { service } = setup({ secret: 'right_secret' });
      expect(() => service.verifySecret('wrong')).toThrow(UnauthorizedException);
      expect(() => service.verifySecret(undefined)).toThrow(UnauthorizedException);
    });
    it('rejects when no secret configured', () => {
      const { service } = setup({ secret: undefined });
      expect(() => service.verifySecret('anything')).toThrow(UnauthorizedException);
    });
  });

  describe('paid event', () => {
    it('marks charge PAID + subscription/associate ACTIVE', async () => {
      const { service, chargeRepo, subRepo, associateRepo } = setup({
        charge: { abacatepayChargeId: 'chg_1', status: ChargeStatus.PENDING },
        subscription: { status: SubscriptionStatus.ACTIVE, associateId: 'a1' },
      });
      const res = await service.handle({
        event: 'subscription.completed',
        data: { chargeId: 'chg_1', subscriptionId: 's_gw' },
      });
      expect(res.processed).toBe(true);
      expect(chargeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ChargeStatus.PAID }));
      expect(subRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: SubscriptionStatus.ACTIVE }));
      expect(associateRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a1' }),
        { status: AssociateStatus.ACTIVE },
      );
    });

    it('is idempotent: re-delivering a PAID charge is a no-op', async () => {
      const { service, chargeRepo } = setup({
        charge: { abacatepayChargeId: 'chg_1', status: ChargeStatus.PAID },
        subscription: null,
      });
      const res = await service.handle({ event: 'billing.paid', data: { chargeId: 'chg_1' } });
      expect(res.processed).toBe(true);
      expect(chargeRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('failed event', () => {
    it('marks charge FAILED + subscription/associate PAST_DUE', async () => {
      const { service, chargeRepo, subRepo, associateRepo } = setup({
        charge: { abacatepayChargeId: 'chg_2', status: ChargeStatus.PENDING },
        subscription: { status: SubscriptionStatus.ACTIVE, associateId: 'a1' },
      });
      const res = await service.handle({
        event: 'charge.failed',
        data: { chargeId: 'chg_2', subscriptionId: 's_gw' },
      });
      expect(res.processed).toBe(true);
      expect(chargeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: ChargeStatus.FAILED }));
      expect(subRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: SubscriptionStatus.PAST_DUE }));
      expect(associateRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a1' }),
        { status: AssociateStatus.PAST_DUE },
      );
    });
  });

  describe('canceled event', () => {
    it('marks subscription/associate CANCELED', async () => {
      const { service, subRepo, associateRepo } = setup({
        charge: null,
        subscription: { status: SubscriptionStatus.ACTIVE, associateId: 'a1' },
      });
      const res = await service.handle({ event: 'subscription.cancelled', data: { subscriptionId: 's_gw' } });
      expect(res.processed).toBe(true);
      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SubscriptionStatus.CANCELED, canceledAt: expect.any(Date) }),
      );
      expect(associateRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a1' }),
        { status: AssociateStatus.CANCELED },
      );
    });

    it('is idempotent: re-cancelling an already CANCELED subscription is a no-op', async () => {
      const { service, subRepo } = setup({
        charge: null,
        subscription: { status: SubscriptionStatus.CANCELED, associateId: 'a1' },
      });
      const res = await service.handle({ event: 'subscription.canceled', data: { subscriptionId: 's_gw' } });
      expect(res.processed).toBe(true);
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  it('ignores unhandled events', async () => {
    const { service } = setup({ charge: null, subscription: null });
    const res = await service.handle({ event: 'something.else', data: {} });
    expect(res.processed).toBe(false);
  });
});
