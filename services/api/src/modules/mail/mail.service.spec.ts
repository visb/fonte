import { ResendMailService } from './mail.service';

function makeConfig(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as never;
}

const input = {
  to: 'maria@example.com',
  subject: 'Assunto',
  text: 'corpo',
  html: '<p>corpo</p>',
};

describe('ResendMailService (story 70)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('best-effort: sem RESEND_API_KEY não chama a API e devolve { sent: false }', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as never);
    const service = new ResendMailService(makeConfig({}));

    const result = await service.sendMail(input);

    expect(result).toEqual({ sent: false, messageId: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('com credencial, envia via Resend e devolve o messageId', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-123' }),
    });
    global.fetch = fetchMock as never;
    const service = new ResendMailService(
      makeConfig({ RESEND_API_KEY: 'rk_test', MAIL_FROM: 'Fonte <x@y.org>' }),
    );

    const result = await service.sendMail(input);

    expect(result).toEqual({ sent: true, messageId: 'msg-123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer rk_test' }),
      }),
    );
  });

  it('best-effort: resposta de erro do provedor devolve { sent: false } e não lança', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: 'invalid' }),
    }) as never;
    const service = new ResendMailService(makeConfig({ RESEND_API_KEY: 'rk_test' }));

    const result = await service.sendMail(input);

    expect(result).toEqual({ sent: false, messageId: null });
  });

  it('best-effort: erro de rede devolve { sent: false } e não lança', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as never;
    const service = new ResendMailService(makeConfig({ RESEND_API_KEY: 'rk_test' }));

    await expect(service.sendMail(input)).resolves.toEqual({
      sent: false,
      messageId: null,
    });
  });
});
