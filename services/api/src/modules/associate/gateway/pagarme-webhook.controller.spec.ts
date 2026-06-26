import { PagarmeWebhookController } from './pagarme-webhook.controller';
import {
  PagarmeWebhookPayload,
  PagarmeWebhookService,
} from './pagarme-webhook.service';

describe('PagarmeWebhookController', () => {
  it('verifies auth then handles the payload', async () => {
    const verifyAuth = jest.fn();
    const handle = jest.fn().mockResolvedValue({ ok: true });
    const controller = new PagarmeWebhookController({
      verifyAuth,
      handle,
    } as unknown as PagarmeWebhookService);
    const payload = { type: 'charge.paid' } as PagarmeWebhookPayload;

    await expect(controller.handle('Basic abc', payload)).resolves.toEqual({ ok: true });
    expect(verifyAuth).toHaveBeenCalledWith('Basic abc');
    expect(handle).toHaveBeenCalledWith(payload);
  });

  it('propagates an auth failure before handling', async () => {
    const verifyAuth = jest.fn(() => {
      throw new Error('unauthorized');
    });
    const handle = jest.fn();
    const controller = new PagarmeWebhookController({
      verifyAuth,
      handle,
    } as unknown as PagarmeWebhookService);

    await expect(
      controller.handle(undefined, {} as PagarmeWebhookPayload),
    ).rejects.toThrow('unauthorized');
    expect(handle).not.toHaveBeenCalled();
  });
});
