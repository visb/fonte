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
    bannerKey: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  } as unknown as Event;
}

function makeService(
  events: Partial<Repository<Event>>,
  registrations: Partial<Repository<EventRegistration>>,
) {
  return new EventRegistrationService(
    events as Repository<Event>,
    registrations as Repository<EventRegistration>,
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
      save: jest.fn().mockResolvedValue({ id: 'reg-uuid', eventId: 'event-uuid', name: 'Maria' }),
    };
    const service = makeService(events, registrations);

    const result = await service.register('event-uuid', validDto);

    expect(result).toEqual({ id: 'reg-uuid', eventId: 'event-uuid', name: 'Maria' });
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

  it('lança NotFound para evento inexistente', async () => {
    const events = { findOne: jest.fn().mockResolvedValue(null) };
    const service = makeService(events, { find: jest.fn() });
    await expect(service.listRegistrations('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
