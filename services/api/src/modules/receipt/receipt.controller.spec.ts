import type { Response } from 'express';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from './receipt.service';

function makeRes() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
  } as unknown as Response & { setHeader: jest.Mock; send: jest.Mock };
}

describe('ReceiptController', () => {
  it('delega ao service com o usuário do TOKEN e devolve o PDF como anexo', async () => {
    const service = {
      generateForAssociateCharge: jest
        .fn()
        .mockResolvedValue({ buffer: Buffer.from('%PDF-x'), filename: 'recibo-contribuicao-000007.pdf', number: 7 }),
    } as unknown as ReceiptService;
    const controller = new ReceiptController(service);
    const res = makeRes();

    await controller.downloadChargeReceipt('chg-1', { userId: 'user-1' } as never, res);

    expect(service.generateForAssociateCharge).toHaveBeenCalledWith('chg-1', 'user-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="recibo-contribuicao-000007.pdf"',
    );
    expect(res.send).toHaveBeenCalled();
  });

  it('erro do service sobe (o operador precisa ver o 400/404, não um PDF vazio)', async () => {
    const service = {
      generateForAssociateCharge: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as ReceiptService;
    const controller = new ReceiptController(service);
    const res = makeRes();
    await expect(
      controller.downloadChargeReceipt('chg-1', { userId: 'user-1' } as never, res),
    ).rejects.toThrow('boom');
    expect(res.send).not.toHaveBeenCalled();
  });
});
