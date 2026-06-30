import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventRegistrationService } from './event-registration.service';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';

const NOW = new Date('2026-06-17T12:00:00.000Z');

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-uuid',
    title: 'Retiro',
    description: 'Encontro',
    startAt: new Date('2026-07-01T12:00:00.000Z'),
    endAt: null,
    location: 'Sede',
    capacity: null,
    registrationEnabled: true,
    registrationFields: [],
    bannerKey: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  } as unknown as Event;
}

type StorageMock = {
  decodeOriginalName: jest.Mock;
  uniqueFilename: jest.Mock;
  upload: jest.Mock;
  delete: jest.Mock;
  keyFromUrl: jest.Mock;
};

function makeStorage(overrides: Partial<StorageMock> = {}): StorageMock {
  return {
    decodeOriginalName: jest.fn((n: string) => n),
    uniqueFilename: jest.fn((n: string, prefix = '') => `${prefix}${n}`),
    upload: jest
      .fn()
      .mockResolvedValue('https://bucket/event-registrations/reg_file.pdf'),
    delete: jest.fn().mockResolvedValue(undefined),
    // Por padrão devolve a "key" de uma URL do bucket fictício, null p/ o resto.
    keyFromUrl: jest.fn((url: string | null) =>
      typeof url === 'string' && url.startsWith('https://bucket/')
        ? url.slice('https://bucket/'.length)
        : null,
    ),
    ...overrides,
  };
}

function makeConfig(pct = '0.0399', fixed = '0.39') {
  return {
    get: (key: string) =>
      key === 'PAGARME_CARD_FEE_PCT' ? pct : key === 'PAGARME_CARD_FEE_FIXED' ? fixed : undefined,
  } as never;
}

function makeNotifier() {
  return {
    sendPaymentLink: jest.fn().mockResolvedValue({ email: false, whatsapp: false }),
  };
}

function makeService(
  events: Partial<Repository<Event>>,
  registrations: Partial<Repository<EventRegistration>>,
  storage: StorageMock = makeStorage(),
  config = makeConfig(),
  notifier = makeNotifier(),
) {
  return new EventRegistrationService(
    events as Repository<Event>,
    registrations as Repository<EventRegistration>,
    storage as never,
    config,
    notifier as never,
  );
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

const validDto = { name: 'Maria', contact: '11999990000', email: null };

describe('EventRegistrationService.register', () => {
  it('cria a inscrição dentro da janela e sem lotação', async () => {
    const event = makeEvent();
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'reg-uuid', ...v })),
    };
    const service = makeService(events, registrations);

    const result = await service.register('event-uuid', validDto);

    // Evento grátis: sem token, status NONE.
    expect(result).toMatchObject({
      id: 'reg-uuid',
      eventId: 'event-uuid',
      name: 'Maria',
      paymentStatus: 'NONE',
      paymentToken: null,
    });
    expect(registrations.save).toHaveBeenCalled();
  });

  it('rejeita inscrição em evento já ocorrido (400)', async () => {
    const event = makeEvent({ startAt: new Date('2026-06-01T12:00:00.000Z') });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn(), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(service.register('event-uuid', validDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(registrations.save).not.toHaveBeenCalled();
  });

  it('rejeita quando a janela ainda não abriu (400)', async () => {
    const event = makeEvent({
      registrationOpensAt: new Date('2026-06-20T12:00:00.000Z'),
    });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn(), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(service.register('event-uuid', validDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita quando a janela já fechou (400)', async () => {
    const event = makeEvent({
      registrationClosesAt: new Date('2026-06-10T12:00:00.000Z'),
    });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn(), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(service.register('event-uuid', validDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita quando a capacidade está esgotada (409)', async () => {
    const event = makeEvent({ capacity: 2 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(2), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(service.register('event-uuid', validDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(registrations.save).not.toHaveBeenCalled();
  });

  it('aceita quando ainda há vaga (capacity não cheia)', async () => {
    const event = makeEvent({ capacity: 2 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue({ id: 'reg-uuid', eventId: 'event-uuid', name: 'Maria' }),
    };
    const service = makeService(events, registrations);

    const result = await service.register('event-uuid', validDto);
    expect(result.id).toBe('reg-uuid');
  });

  it('lança NotFound para evento inexistente', async () => {
    const events = { findOne: jest.fn().mockResolvedValue(null) };
    const registrations = { count: jest.fn(), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(service.register('missing', validDto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita inscrição em evento com inscrição desligada (404)', async () => {
    const event = makeEvent({ registrationEnabled: false });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn(), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(service.register('event-uuid', validDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(registrations.save).not.toHaveBeenCalled();
  });
});

describe('EventRegistrationService.register — pagamento (story 69)', () => {
  it('evento pago: gera token, status PENDING e amount_cents com gross-up', async () => {
    const event = makeEvent({ paymentEnabled: true, priceCents: 5000 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const created: Record<string, unknown>[] = [];
    const registrations = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v) => {
        created.push(v);
        return v;
      }),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'reg-uuid', ...v })),
    };
    // Taxa 3,99% + R$0,39 sobre R$50,00 → gross = round2((50+0.39)/(1-0.0399)) = 52.48 → 5248c.
    const service = makeService(events, registrations, makeStorage(), makeConfig('0.0399', '0.39'));

    const result = await service.register('event-uuid', validDto);

    expect(result.paymentStatus).toBe('PENDING');
    expect(typeof result.paymentToken).toBe('string');
    expect(result.paymentToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    const arg = created[0];
    expect(arg.paymentStatus).toBe('PENDING');
    expect(arg.amountCents).toBe(5248);
  });

  it('evento pago: dispara o link de pagamento (email + WhatsApp) best-effort (story 70)', async () => {
    const event = makeEvent({ paymentEnabled: true, priceCents: 5000 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'reg-uuid', ...v })),
    };
    const notifier = makeNotifier();
    const service = makeService(events, registrations, makeStorage(), makeConfig(), notifier);

    await service.register('event-uuid', validDto);

    expect(notifier.sendPaymentLink).toHaveBeenCalledTimes(1);
    const [reg, title] = notifier.sendPaymentLink.mock.calls[0];
    expect(reg.paymentStatus).toBe('PENDING');
    expect(typeof reg.paymentToken).toBe('string');
    expect(title).toBe('Retiro');
  });

  it('evento grátis NÃO dispara envio de link (story 70)', async () => {
    const event = makeEvent();
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'reg-uuid', ...v })),
    };
    const notifier = makeNotifier();
    const service = makeService(events, registrations, makeStorage(), makeConfig(), notifier);

    await service.register('event-uuid', validDto);

    expect(notifier.sendPaymentLink).not.toHaveBeenCalled();
  });

  it('grossUpCents arredonda corretamente o valor cobrado', () => {
    const service = makeService(
      { findOne: jest.fn() },
      { count: jest.fn(), create: jest.fn(), save: jest.fn() },
      makeStorage(),
      makeConfig('0.0399', '0.39'),
    );
    expect(service.grossUpCents(5000)).toBe(5248);
    expect(service.grossUpCents(10000)).toBe(10456);
  });
});

describe('EventRegistrationService.register — custom answers (story 68)', () => {
  const shirtField = {
    id: 'shirt',
    label: 'Tamanho',
    type: 'select' as const,
    required: true,
    order: 0,
    options: ['P', 'M', 'G'],
  };

  it('persiste só os fieldIds conhecidos das respostas', async () => {
    const event = makeEvent({ registrationFields: [shirtField] });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    let savedAnswers: unknown;
    const registrations = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((v) => {
        savedAnswers = v.answers;
        return v;
      }),
      save: jest.fn().mockResolvedValue({ id: 'reg', eventId: 'event-uuid', name: 'Maria' }),
    };
    const service = makeService(events, registrations);

    await service.register('event-uuid', {
      ...validDto,
      answers: { shirt: 'M', bogus: 'x' },
    });

    expect(savedAnswers).toEqual({ shirt: 'M' });
  });

  it('rejeita quando um campo obrigatório falta (400)', async () => {
    const event = makeEvent({ registrationFields: [shirtField] });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(0), create: jest.fn(), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(
      service.register('event-uuid', { ...validDto, answers: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registrations.save).not.toHaveBeenCalled();
  });

  it('rejeita valor fora das options de select (400)', async () => {
    const event = makeEvent({ registrationFields: [shirtField] });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(0), create: jest.fn(), save: jest.fn() };
    const service = makeService(events, registrations);

    await expect(
      service.register('event-uuid', { ...validDto, answers: { shirt: 'XL' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EventRegistrationService.uploadRegistrationFile (story 68)', () => {
  const file = {
    originalname: 'comprovante.pdf',
    buffer: Buffer.from('x'),
    mimetype: 'application/pdf',
  } as Express.Multer.File;

  it('grava o arquivo e devolve a fileKey', async () => {
    const event = makeEvent();
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const storage = makeStorage();
    const service = makeService(events, {}, storage);

    const result = await service.uploadRegistrationFile('event-uuid', file);

    expect(storage.upload).toHaveBeenCalledWith(
      'event-registrations',
      expect.stringContaining('reg_'),
      file.buffer,
      'application/pdf',
    );
    expect(result.fileKey).toBe('https://bucket/event-registrations/reg_file.pdf');
  });

  it('lança NotFound para evento com inscrição desligada', async () => {
    const event = makeEvent({ registrationEnabled: false });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const service = makeService(events, {}, makeStorage());

    await expect(service.uploadRegistrationFile('event-uuid', file)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('EventRegistrationService.deleteRegistration (story 93)', () => {
  function makeRegistration(answers: Record<string, unknown> = {}) {
    return {
      id: 'reg-uuid',
      eventId: 'event-uuid',
      answers,
      deletedAt: null,
    } as unknown as EventRegistration;
  }

  it('remove a inscrição e apaga do bucket os comprovantes anexados', async () => {
    const registration = makeRegistration({
      f1: 'https://bucket/event-registrations/reg_old.pdf',
      f2: 'texto comum',
    });
    const registrations = {
      findOne: jest.fn().mockResolvedValue(registration),
      softRemove: jest.fn().mockResolvedValue(registration),
    };
    const storage = makeStorage();
    const service = makeService({}, registrations, storage);

    await service.deleteRegistration('event-uuid', 'reg-uuid');

    expect(registrations.softRemove).toHaveBeenCalledWith(registration);
    // Apaga só a key do comprovante (campo file), não o texto comum.
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith('event-registrations/reg_old.pdf');
  });

  it('não apaga nada quando a inscrição não tem comprovante', async () => {
    const registration = makeRegistration({ nome: 'Maria' });
    const registrations = {
      findOne: jest.fn().mockResolvedValue(registration),
      softRemove: jest.fn().mockResolvedValue(registration),
    };
    const storage = makeStorage();
    const service = makeService({}, registrations, storage);

    await service.deleteRegistration('event-uuid', 'reg-uuid');

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('falha do storage não aborta a remoção (best-effort)', async () => {
    const registration = makeRegistration({
      f1: 'https://bucket/event-registrations/reg_old.pdf',
    });
    const registrations = {
      findOne: jest.fn().mockResolvedValue(registration),
      softRemove: jest.fn().mockResolvedValue(registration),
    };
    const storage = makeStorage({
      delete: jest.fn().mockRejectedValue(new Error('s3 down')),
    });
    const service = makeService({}, registrations, storage);

    await expect(
      service.deleteRegistration('event-uuid', 'reg-uuid'),
    ).resolves.toBeUndefined();
    expect(registrations.softRemove).toHaveBeenCalled();
  });

  it('lança NotFound quando a inscrição não existe', async () => {
    const registrations = {
      findOne: jest.fn().mockResolvedValue(null),
      softRemove: jest.fn(),
    };
    const service = makeService({}, registrations, makeStorage());

    await expect(
      service.deleteRegistration('event-uuid', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(registrations.softRemove).not.toHaveBeenCalled();
  });
});

describe('EventRegistrationService.getPublicView', () => {
  it('calcula vagas restantes e marca a inscrição aberta', async () => {
    const event = makeEvent({ capacity: 10 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(3) };
    const service = makeService(events, registrations);

    const view = await service.getPublicView('event-uuid');

    expect(view.capacity).toBe(10);
    expect(view.spotsLeft).toBe(7);
    expect(view.registrationOpen).toBe(true);
    // Não vaza chave crua do banner além do esperado.
    expect(view).not.toHaveProperty('bannerKey');
  });

  it('marca a inscrição fechada quando esgotado (spotsLeft 0)', async () => {
    const event = makeEvent({ capacity: 3 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(3) };
    const service = makeService(events, registrations);

    const view = await service.getPublicView('event-uuid');
    expect(view.spotsLeft).toBe(0);
    expect(view.registrationOpen).toBe(false);
  });

  it('vagas ilimitadas → spotsLeft null', async () => {
    const event = makeEvent({ capacity: null });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(100) };
    const service = makeService(events, registrations);

    const view = await service.getPublicView('event-uuid');
    expect(view.spotsLeft).toBeNull();
    expect(view.registrationOpen).toBe(true);
  });

  it('evento passado → inscrição fechada', async () => {
    const event = makeEvent({ startAt: new Date('2026-06-01T12:00:00.000Z') });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(0) };
    const service = makeService(events, registrations);

    const view = await service.getPublicView('event-uuid');
    expect(view.registrationOpen).toBe(false);
  });

  it('lança NotFound para evento inexistente', async () => {
    const events = { findOne: jest.fn().mockResolvedValue(null) };
    const service = makeService(events, { count: jest.fn() });
    await expect(service.getPublicView('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança NotFound para evento com inscrição desligada (não vaza interno)', async () => {
    const event = makeEvent({ registrationEnabled: false });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const service = makeService(events, { count: jest.fn() });
    await expect(service.getPublicView('event-uuid')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('expõe os registrationFields para o portal renderizar (story 68)', async () => {
    const fields = [
      { id: 'shirt', label: 'Tamanho', type: 'select' as const, required: true, order: 0, options: ['P', 'M'] },
    ];
    const event = makeEvent({ registrationFields: fields });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = { count: jest.fn().mockResolvedValue(0) };
    const service = makeService(events, registrations);

    const view = await service.getPublicView('event-uuid');
    expect(view.registrationFields).toEqual(fields);
  });
});

describe('EventRegistrationService.listPublic', () => {
  it('lista apenas eventos futuros, ordenados por start_at', async () => {
    const future = makeEvent({ id: 'f', startAt: new Date('2026-07-01T12:00:00.000Z') });
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([future]),
    };
    const events = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const registrations = { count: jest.fn().mockResolvedValue(0) };
    const service = makeService(events, registrations);

    const list = await service.listPublic();

    expect(qb.where).toHaveBeenCalledWith('e.start_at >= :now', expect.any(Object));
    // Story 67: filtra por inscrição habilitada.
    expect(qb.andWhere).toHaveBeenCalledWith('e.registration_enabled = true');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('f');
  });
});

describe('EventRegistrationService.listRegistrations', () => {
  it('lista inscritos do evento (uso admin)', async () => {
    const event = makeEvent();
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'r1',
          eventId: 'event-uuid',
          name: 'Maria',
          contact: '11999990000',
          email: null,
          createdAt: NOW,
        },
      ]),
    };
    const service = makeService(events, registrations);

    const list = await service.listRegistrations('event-uuid');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Maria');
  });

  it('inclui as answers custom de cada inscrito (story 68)', async () => {
    const event = makeEvent();
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'r1',
          eventId: 'event-uuid',
          name: 'Maria',
          contact: '11999990000',
          email: null,
          answers: { shirt: 'M', file1: 'event-registrations/x.pdf' },
          createdAt: NOW,
        },
      ]),
    };
    const service = makeService(events, registrations);

    const list = await service.listRegistrations('event-uuid');
    expect(list[0].answers).toEqual({ shirt: 'M', file1: 'event-registrations/x.pdf' });
  });

  it('inclui paymentStatus e amountCents de cada inscrito (story 69)', async () => {
    const event = makeEvent({ paymentEnabled: true, priceCents: 5000 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registrations = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'r1',
          eventId: 'event-uuid',
          name: 'Maria',
          contact: '11999990000',
          email: null,
          answers: {},
          paymentStatus: 'PAID',
          amountCents: 5248,
          createdAt: NOW,
        },
      ]),
    };
    const service = makeService(events, registrations);

    const list = await service.listRegistrations('event-uuid');
    expect(list[0].paymentStatus).toBe('PAID');
    expect(list[0].amountCents).toBe(5248);
  });

  it('lança NotFound para evento inexistente', async () => {
    const events = { findOne: jest.fn().mockResolvedValue(null) };
    const service = makeService(events, { find: jest.fn() });
    await expect(service.listRegistrations('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('EventRegistrationService.resendPaymentLink (story 70)', () => {
  it('reenvia o link por email + WhatsApp p/ inscrição paga', async () => {
    const event = makeEvent({ paymentEnabled: true, priceCents: 5000 });
    const events = { findOne: jest.fn().mockResolvedValue(event) };
    const registration = {
      id: 'reg-1',
      eventId: 'event-uuid',
      name: 'Maria',
      paymentStatus: 'PENDING',
      paymentToken: 'tok-1',
    };
    const registrations = { findOne: jest.fn().mockResolvedValue(registration) };
    const notifier = makeNotifier();
    notifier.sendPaymentLink.mockResolvedValue({ email: true, whatsapp: true });
    const service = makeService(events, registrations, makeStorage(), makeConfig(), notifier);

    const result = await service.resendPaymentLink('event-uuid', 'reg-1');

    expect(notifier.sendPaymentLink).toHaveBeenCalledWith(registration, 'Retiro');
    expect(result).toEqual({ email: true, whatsapp: true });
  });

  it('lança NotFound quando a inscrição não existe', async () => {
    const events = { findOne: jest.fn() };
    const registrations = { findOne: jest.fn().mockResolvedValue(null) };
    const service = makeService(events, registrations);
    await expect(
      service.resendPaymentLink('event-uuid', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita reenvio p/ inscrição grátis (sem token de pagamento)', async () => {
    const registration = {
      id: 'reg-1',
      eventId: 'event-uuid',
      name: 'Maria',
      paymentStatus: 'NONE',
      paymentToken: null,
    };
    const events = { findOne: jest.fn() };
    const registrations = { findOne: jest.fn().mockResolvedValue(registration) };
    const notifier = makeNotifier();
    const service = makeService(events, registrations, makeStorage(), makeConfig(), notifier);

    await expect(
      service.resendPaymentLink('event-uuid', 'reg-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(notifier.sendPaymentLink).not.toHaveBeenCalled();
  });
});
