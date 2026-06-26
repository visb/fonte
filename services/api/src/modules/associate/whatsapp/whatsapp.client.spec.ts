import { ConfigService } from '@nestjs/config';
import { MetaWhatsAppClient } from './whatsapp.client';
import { SendTemplateInput } from './whatsapp.types';

function makeClient(env: Record<string, string | undefined>) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  const client = new MetaWhatsAppClient(config);
  jest.spyOn((client as any).logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn((client as any).logger, 'error').mockImplementation(() => undefined);
  return client;
}

const baseInput: SendTemplateInput = {
  toE164: '+5562999998888',
  templateName: 'cobranca_associado',
  variables: ['Maria', 'R$ 50,00'],
  urlButtonParam: 'pay-token',
};

describe('MetaWhatsAppClient link builders', () => {
  it('builds payment and cancel links trimming trailing slash', () => {
    const client = makeClient({ APP_ASSOCIADOS_URL: 'https://app.fonte.org/' });
    expect(client.buildPaymentLink('tok')).toBe('https://app.fonte.org/p/tok');
    expect(client.buildCancelLink('tok')).toBe('https://app.fonte.org/cancelar/tok');
  });

  it('handles a missing base URL gracefully', () => {
    const client = makeClient({});
    expect(client.buildPaymentLink('tok')).toBe('/p/tok');
  });
});

describe('MetaWhatsAppClient.sendTemplate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  it('returns sent:false when credentials are missing (best-effort)', async () => {
    const client = makeClient({});
    const result = await client.sendTemplate(baseInput);
    expect(result).toEqual({ sent: false, messageId: null });
  });

  it('sends the template and returns the message id on success', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid.123' }] }),
    });
    (global as any).fetch = fetchMock;
    const client = makeClient({
      META_WA_PHONE_NUMBER_ID: 'pn1',
      META_WA_TOKEN: 'tkn',
      APP_ASSOCIADOS_URL: 'https://app.fonte.org',
    });

    const result = await client.sendTemplate({
      ...baseInput,
      cancelUrlButtonParam: 'cancel-token',
    });

    expect(result).toEqual({ sent: true, messageId: 'wamid.123' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/v21.0/pn1/messages');
    const body = JSON.parse(options.body);
    // includes the second cancel URL button (index '1')
    expect(body.template.components.some((c: any) => c.index === '1')).toBe(true);
  });

  it('uses a provided full urlLink instead of deriving it', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ messages: [{ id: 'm2' }] }),
    });
    (global as any).fetch = fetchMock;
    const client = makeClient({
      META_WA_PHONE_NUMBER_ID: 'pn1',
      META_WA_TOKEN: 'tkn',
      META_WA_API_VERSION: 'v20.0',
    });

    await client.sendTemplate({ ...baseInput, urlLink: 'https://portal/pay/abc' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const button = body.template.components.find((c: any) => c.type === 'button');
    expect(button.parameters[0].text).toBe('https://portal/pay/abc');
    expect(fetchMock.mock.calls[0][0]).toContain('/v20.0/');
  });

  it('returns sent:false when the API responds with an error payload', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: { message: 'bad' } }),
    });
    (global as any).fetch = fetchMock;
    const client = makeClient({ META_WA_PHONE_NUMBER_ID: 'pn1', META_WA_TOKEN: 'tkn' });
    const result = await client.sendTemplate(baseInput);
    expect(result).toEqual({ sent: false, messageId: null });
  });

  it('returns sent:false on a network error', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    (global as any).fetch = fetchMock;
    const client = makeClient({ META_WA_PHONE_NUMBER_ID: 'pn1', META_WA_TOKEN: 'tkn' });
    const result = await client.sendTemplate(baseInput);
    expect(result).toEqual({ sent: false, messageId: null });
  });
});
