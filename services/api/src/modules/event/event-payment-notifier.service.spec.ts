import { EventPaymentNotifierService } from './event-payment-notifier.service';
import { EventRegistration } from './event-registration.entity';

function makeConfig(values: Record<string, string | undefined> = {}) {
  return { get: (key: string) => values[key] } as never;
}

function makeMail(sent = true) {
  return {
    sendMail: jest.fn().mockResolvedValue({ sent, messageId: sent ? 'm1' : null }),
  };
}

function makeWhatsApp(sent = true) {
  return {
    sendTemplate: jest
      .fn()
      .mockResolvedValue({ sent, messageId: sent ? 'w1' : null }),
  };
}

function makeRegistration(
  overrides: Partial<EventRegistration> = {},
): EventRegistration {
  return {
    id: 'reg-1',
    name: 'Maria',
    contact: '+5562999998888',
    email: 'maria@example.com',
    paymentToken: 'tok-1',
    ...overrides,
  } as EventRegistration;
}

const PORTAL = 'https://portal.fonte.org';

describe('EventPaymentNotifierService (story 70)', () => {
  it('monta o link da página de pagamento a partir do PORTAL_URL', () => {
    const service = new EventPaymentNotifierService(
      makeMail() as never,
      makeWhatsApp() as never,
      makeConfig({ PORTAL_URL: `${PORTAL}/` }),
    );
    expect(service.buildPaymentLink('tok-1')).toBe(`${PORTAL}/pagamento/tok-1`);
  });

  it('envia por email E WhatsApp com o link correto quando há email + telefone E.164', async () => {
    const mail = makeMail();
    const whatsapp = makeWhatsApp();
    const service = new EventPaymentNotifierService(
      mail as never,
      whatsapp as never,
      makeConfig({ PORTAL_URL: PORTAL }),
    );

    const result = await service.sendPaymentLink(makeRegistration(), 'Retiro');

    expect(result).toEqual({ email: true, whatsapp: true });
    expect(mail.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'maria@example.com',
        text: expect.stringContaining(`${PORTAL}/pagamento/tok-1`),
      }),
    );
    expect(whatsapp.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        toE164: '+5562999998888',
        urlLink: `${PORTAL}/pagamento/tok-1`,
        variables: ['Maria', 'Retiro'],
      }),
    );
  });

  it('pula email quando a inscrição não tem email', async () => {
    const mail = makeMail();
    const whatsapp = makeWhatsApp();
    const service = new EventPaymentNotifierService(
      mail as never,
      whatsapp as never,
      makeConfig({ PORTAL_URL: PORTAL }),
    );

    const result = await service.sendPaymentLink(
      makeRegistration({ email: null }),
      'Retiro',
    );

    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(result.email).toBe(false);
    expect(result.whatsapp).toBe(true);
  });

  it('pula WhatsApp quando o contato não é E.164', async () => {
    const mail = makeMail();
    const whatsapp = makeWhatsApp();
    const service = new EventPaymentNotifierService(
      mail as never,
      whatsapp as never,
      makeConfig({ PORTAL_URL: PORTAL }),
    );

    const result = await service.sendPaymentLink(
      makeRegistration({ contact: '11999990000' }),
      'Retiro',
    );

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(result.whatsapp).toBe(false);
    expect(result.email).toBe(true);
  });

  it('best-effort: sem token de pagamento não envia nada', async () => {
    const mail = makeMail();
    const whatsapp = makeWhatsApp();
    const service = new EventPaymentNotifierService(
      mail as never,
      whatsapp as never,
      makeConfig({ PORTAL_URL: PORTAL }),
    );

    const result = await service.sendPaymentLink(
      makeRegistration({ paymentToken: null }),
      'Retiro',
    );

    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({ email: false, whatsapp: false });
  });

  it('best-effort: falha de um canal não impede o outro nem lança', async () => {
    const mail = { sendMail: jest.fn().mockRejectedValue(new Error('boom')) };
    const whatsapp = makeWhatsApp();
    const service = new EventPaymentNotifierService(
      mail as never,
      whatsapp as never,
      makeConfig({ PORTAL_URL: PORTAL }),
    );

    const result = await service.sendPaymentLink(makeRegistration(), 'Retiro');

    expect(result.email).toBe(false);
    expect(result.whatsapp).toBe(true);
  });
});
