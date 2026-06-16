jest.mock('@fonte/types', () => ({
  AssociateStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  SubscriptionStatus: { ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  ChargeStatus: { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' },
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AssociateStatus, ChargeStatus, SubscriptionStatus } from '@fonte/types';
import { AssociatePaymentService } from './associate-payment.service';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';
import { PaymentGateway } from './gateway/gateway.types';

const TOKEN = 'token-uuid';
const ASSOCIATE_ID = 'associate-uuid';

function makeAssociate(overrides: Partial<Associate> = {}): Associate {
  return {
    id: ASSOCIATE_ID,
    name: 'João Doador',
    whatsapp: '+5562999998888',
    email: 'joao@example.com',
    contributionAmount: 50,
    dueDay: 10,
    status: 'PENDING',
    gatewayCustomerId: null,
    paymentToken: TOKEN,
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as unknown as Associate;
}

function makeMockGateway(): jest.Mocked<PaymentGateway> {
  return {
    createCustomer: jest.fn().mockResolvedValue({ customerId: 'cust_123' }),
    createSubscription: jest
      .fn()
      .mockResolvedValue({ subscriptionId: 'sub_123', chargeId: 'chg_123' }),
    cancelSubscription: jest.fn().mockResolvedValue({ canceled: true }),
  };
}

function makeConfig(pct = '0.035', fixed = '0.60'): ConfigService {
  return {
    get: (key: string) =>
      key === 'PAGARME_CARD_FEE_PCT' ? pct : key === 'PAGARME_CARD_FEE_FIXED' ? fixed : undefined,
  } as unknown as ConfigService;
}

function makeService(opts: {
  associate?: Associate | null;
  activeSub?: AssociateSubscription | null;
  gateway?: jest.Mocked<PaymentGateway>;
}) {
  const gateway = opts.gateway ?? makeMockGateway();
  const savedSubs: AssociateSubscription[] = [];
  const savedCharges: AssociateCharge[] = [];
  const savedAssociates: Associate[] = [];

  const repo = {
    findOne: jest.fn().mockResolvedValue(opts.associate ?? null),
    save: jest.fn((a) => {
      savedAssociates.push(a);
      return Promise.resolve(a);
    }),
  } as unknown as Repository<Associate>;

  const subRepo = {
    findOne: jest.fn().mockResolvedValue(opts.activeSub ?? null),
    create: jest.fn((d) => d),
    save: jest.fn((d) => {
      const saved = {
        id: 'newsub',
        createdAt: new Date('2026-06-10T00:00:00Z'),
        updatedAt: new Date('2026-06-10T00:00:00Z'),
        ...d,
      };
      savedSubs.push(saved);
      return Promise.resolve(saved);
    }),
  } as unknown as Repository<AssociateSubscription>;

  const chargeRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => {
      const saved = {
        id: 'newcharge',
        createdAt: new Date('2026-06-10T00:00:00Z'),
        updatedAt: new Date('2026-06-10T00:00:00Z'),
        ...d,
      };
      savedCharges.push(saved);
      return Promise.resolve(saved);
    }),
  } as unknown as Repository<AssociateCharge>;

  const service = new AssociatePaymentService(repo, subRepo, chargeRepo, gateway, makeConfig());
  return { service, gateway, repo, subRepo, chargeRepo, savedSubs, savedCharges, savedAssociates };
}

describe('AssociatePaymentService', () => {
  describe('getPublicView', () => {
    it('returns minimal data without leaking sensitive fields', async () => {
      const { service } = makeService({ associate: makeAssociate() });
      const view = await service.getPublicView(TOKEN);
      expect(view).toEqual({
        name: 'João Doador',
        suggestedAmount: 50,
        dueDay: 10,
        status: 'PENDING',
        hasActiveSubscription: false,
      });
      expect(view).not.toHaveProperty('whatsapp');
      expect(view).not.toHaveProperty('email');
      expect(view).not.toHaveProperty('gatewayCustomerId');
    });

    it('throws NotFound for unknown token', async () => {
      const { service } = makeService({ associate: null });
      await expect(service.getPublicView('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('subscribe', () => {
    it('uses fixed amount, computes gross-up, creates customer + subscription, persists PENDING charge', async () => {
      const { service, gateway, savedSubs, savedCharges } = makeService({
        associate: makeAssociate(),
      });

      const result = await service.subscribe(TOKEN, { cardToken: 'tok_abc' });

      expect(gateway.createCustomer).toHaveBeenCalledWith({
        name: 'João Doador',
        email: 'joao@example.com',
        phone: '+5562999998888',
      });
      // valor FIXO do cadastro (50); gross = (50 + 0.60) / 0.965 = 52.44
      expect(gateway.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust_123',
          cardToken: 'tok_abc',
          grossAmount: 52.44,
          interval: 'month',
          externalId: ASSOCIATE_ID,
        }),
      );

      const sub = savedSubs[0];
      expect(sub.netAmount).toBe(50);
      expect(sub.grossAmount).toBe(52.44);
      expect(sub.feeAmount).toBe(2.44);
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(sub.gatewaySubscriptionId).toBe('sub_123');

      const charge = savedCharges[0];
      expect(charge.status).toBe(ChargeStatus.PENDING);
      expect(charge.gatewayChargeId).toBe('chg_123');
      expect(charge.grossAmount).toBe(52.44);

      expect(result.checkoutUrl).toBeNull();
      expect(result.charge.status).toBe(ChargeStatus.PENDING);
    });

    it('reuses existing customer id (no second createCustomer)', async () => {
      const { service, gateway } = makeService({
        associate: makeAssociate({ gatewayCustomerId: 'cust_existing' }),
      });
      await service.subscribe(TOKEN, { cardToken: 'tok' });
      expect(gateway.createCustomer).not.toHaveBeenCalled();
      expect(gateway.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cust_existing' }),
      );
    });

    it('rejects when an active subscription already exists', async () => {
      const { service, gateway } = makeService({
        associate: makeAssociate(),
        activeSub: { id: 's1', status: SubscriptionStatus.ACTIVE } as AssociateSubscription,
      });
      await expect(service.subscribe(TOKEN, { cardToken: 'tok' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(gateway.createSubscription).not.toHaveBeenCalled();
    });

    it('throws NotFound for unknown token', async () => {
      const { service } = makeService({ associate: null });
      await expect(service.subscribe('nope', { cardToken: 'tok' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('cancels at the gateway and marks subscription + associate CANCELED', async () => {
      const { service, gateway, savedSubs, savedAssociates } = makeService({
        associate: makeAssociate({ status: AssociateStatus.ACTIVE }),
        activeSub: {
          id: 's1',
          associateId: ASSOCIATE_ID,
          gatewaySubscriptionId: 'sub_123',
          status: SubscriptionStatus.ACTIVE,
          createdAt: new Date('2026-06-10T00:00:00Z'),
          updatedAt: new Date('2026-06-10T00:00:00Z'),
        } as AssociateSubscription,
      });

      const result = await service.cancelSubscription(ASSOCIATE_ID);

      expect(gateway.cancelSubscription).toHaveBeenCalledWith('sub_123');
      expect(savedSubs[0].status).toBe(SubscriptionStatus.CANCELED);
      expect(savedSubs[0].canceledAt).toBeInstanceOf(Date);
      expect(savedAssociates[0].status).toBe(AssociateStatus.CANCELED);
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
    });

    it('throws NotFound when there is no cancelable subscription', async () => {
      const { service, gateway } = makeService({
        associate: makeAssociate({ status: AssociateStatus.PENDING }),
        activeSub: null,
      });
      await expect(service.cancelSubscription(ASSOCIATE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(gateway.cancelSubscription).not.toHaveBeenCalled();
    });

    it('throws NotFound for unknown associate', async () => {
      const { service } = makeService({ associate: null });
      await expect(service.cancelSubscription('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
