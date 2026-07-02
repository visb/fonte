import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventAudience } from '@fonte/types';
import { EventInviteService } from './event-invite.service';
import { Event } from './event.entity';
import { Staff } from '../staff/staff.entity';

/**
 * WhatsApp SEMPRE mockado (sem credencial Meta no ambiente): a API real nunca
 * é chamada — mock via token de injeção WHATSAPP_CLIENT, como nos demais specs.
 */

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-uuid',
    title: 'Retiro dos Servos',
    description: 'Encontro interno',
    startAt: new Date('2026-08-01T18:00:00.000Z'),
    endAt: null,
    location: 'Sede',
    audience: EventAudience.INTERNAL,
    registrationEnabled: false,
    ...overrides,
  } as unknown as Event;
}

function makeStaff(id: string, whatsapp: string | null): Staff {
  return { id, name: `Servo ${id}`, whatsapp } as unknown as Staff;
}

function makeConfig(values: Record<string, string | undefined> = {}) {
  return { get: (key: string) => values[key] } as never;
}

function makeService(opts: {
  event?: Event | null;
  staff?: Staff[];
  sendTemplate?: jest.Mock;
  config?: never;
}) {
  const events = {
    findOne: jest.fn().mockResolvedValue(opts.event === undefined ? makeEvent() : opts.event),
  };
  const staffRepo = { find: jest.fn().mockResolvedValue(opts.staff ?? []) };
  const sendTemplate =
    opts.sendTemplate ?? jest.fn().mockResolvedValue({ sent: true, messageId: 'wamid.1' });
  const config =
    opts.config ??
    makeConfig({
      APP_ASSOCIADOS_URL: 'https://portal.fonte.org/',
      META_WA_TEMPLATE_NAME_EVENT_INVITE: 'convite_evento_teste',
    });
  const service = new EventInviteService(
    events as unknown as Repository<Event>,
    staffRepo as unknown as Repository<Staff>,
    { sendTemplate },
    config,
  );
  return { service, events, staffRepo, sendTemplate };
}

beforeEach(() => jest.clearAllMocks());

describe('EventInviteService.inviteStaff', () => {
  it('envia o template por servo com número válido, com variáveis e link corretos', async () => {
    const { service, sendTemplate } = makeService({
      staff: [makeStaff('s1', '11977773000'), makeStaff('s2', '5562988887777')],
    });

    const result = await service.inviteStaff('event-uuid', ['s1', 's2']);

    expect(result.sent).toEqual(['s1', 's2']);
    expect(result.skipped).toEqual([]);
    expect(sendTemplate).toHaveBeenCalledTimes(2);
    expect(sendTemplate).toHaveBeenCalledWith({
      toE164: '+5511977773000',
      templateName: 'convite_evento_teste',
      variables: ['Retiro dos Servos', expect.stringContaining('/2026'), 'Sede'],
      urlButtonParam: 'event-uuid',
      // Link de detalhe montado a partir de APP_ASSOCIADOS_URL (sem barra dupla).
      urlLink: 'https://portal.fonte.org/eventos/event-uuid',
    });
    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ toE164: '+5562988887777' }),
    );
  });

  it('servo sem número válido entra em skipped (NO_WHATSAPP) sem chamar envio', async () => {
    const { service, sendTemplate } = makeService({
      staff: [makeStaff('s1', null), makeStaff('s2', '123'), makeStaff('s3', '11977773000')],
    });

    const result = await service.inviteStaff('event-uuid', ['s1', 's2', 's3']);

    expect(result.sent).toEqual(['s3']);
    expect(result.skipped).toEqual([
      { staffId: 's1', reason: 'NO_WHATSAPP' },
      { staffId: 's2', reason: 'NO_WHATSAPP' },
    ]);
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });

  it('staffId desconhecido entra em skipped (NOT_FOUND)', async () => {
    const { service } = makeService({ staff: [makeStaff('s1', '11977773000')] });

    const result = await service.inviteStaff('event-uuid', ['s1', 'ghost']);

    expect(result.sent).toEqual(['s1']);
    expect(result.skipped).toEqual([{ staffId: 'ghost', reason: 'NOT_FOUND' }]);
  });

  it('falha de um envio não aborta os demais (best-effort → SEND_FAILED)', async () => {
    const sendTemplate = jest
      .fn()
      .mockResolvedValueOnce({ sent: false, messageId: null })
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ sent: true, messageId: 'wamid.9' });
    const { service } = makeService({
      staff: [
        makeStaff('s1', '11977771000'),
        makeStaff('s2', '11977772000'),
        makeStaff('s3', '11977773000'),
      ],
      sendTemplate,
    });

    const result = await service.inviteStaff('event-uuid', ['s1', 's2', 's3']);

    expect(result.sent).toEqual(['s3']);
    expect(result.skipped).toEqual([
      { staffId: 's1', reason: 'SEND_FAILED' },
      { staffId: 's2', reason: 'SEND_FAILED' },
    ]);
    expect(sendTemplate).toHaveBeenCalledTimes(3);
  });

  it('deduplica staffIds repetidos (um envio por servo)', async () => {
    const { service, sendTemplate } = makeService({
      staff: [makeStaff('s1', '11977773000')],
    });

    const result = await service.inviteStaff('event-uuid', ['s1', 's1', 's1']);

    expect(result.sent).toEqual(['s1']);
    expect(sendTemplate).toHaveBeenCalledTimes(1);
  });

  it('evento sem local usa fallback na variável do template', async () => {
    const { service, sendTemplate } = makeService({
      event: makeEvent({ location: null }),
      staff: [makeStaff('s1', '11977773000')],
    });

    await service.inviteStaff('event-uuid', ['s1']);

    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: ['Retiro dos Servos', expect.any(String), 'a definir'],
      }),
    );
  });

  it('usa o template default quando a env não está configurada', async () => {
    const { service, sendTemplate } = makeService({
      staff: [makeStaff('s1', '11977773000')],
      config: makeConfig({ PORTAL_URL: 'https://portal.fonte.org' }) as never,
    });

    await service.inviteStaff('event-uuid', ['s1']);

    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: 'convite_evento',
        urlLink: 'https://portal.fonte.org/eventos/event-uuid',
      }),
    );
  });

  it('lança NotFound quando o evento não existe (sem nenhum envio)', async () => {
    const { service, sendTemplate } = makeService({
      event: null,
      staff: [makeStaff('s1', '11977773000')],
    });

    await expect(service.inviteStaff('missing', ['s1'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sendTemplate).not.toHaveBeenCalled();
  });
});
