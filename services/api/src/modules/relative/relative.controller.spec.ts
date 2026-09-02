import { BadRequestException } from '@nestjs/common';
import { Role } from '@fonte/types';
import { RelativeController } from './relative.controller';

function svc() {
  return {
    findMe: jest.fn().mockResolvedValue({ id: 'r1' }),
    updateMe: jest.fn().mockResolvedValue({ id: 'r1' }),
    uploadPhoto: jest.fn().mockResolvedValue({ id: 'r1' }),
    findByResident: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'r1' }),
    setResponsible: jest.fn().mockResolvedValue({ id: 'r1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    generateAccess: jest.fn().mockResolvedValue({ id: 'r1' }),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    findMyPaidReceivables: jest.fn().mockResolvedValue([]),
  };
}

// Story 193 — o service do recibo, injetado ao lado do RelativeService.
function receipts() {
  return {
    generateForResidentReceivable: jest.fn().mockResolvedValue({
      buffer: Buffer.from('%PDF-x'),
      filename: 'recibo-contribuicao-acolhido-000003.pdf',
      number: 3,
    }),
  };
}

function makeRes() {
  return { setHeader: jest.fn(), send: jest.fn() } as unknown as {
    setHeader: jest.Mock;
    send: jest.Mock;
  };
}

const img = { mimetype: 'image/png', size: 100, buffer: Buffer.from('x') } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('RelativeController', () => {
  it('self-service (me) routes delegate with userId', async () => {
    const s = svc();
    const c = new RelativeController(s as never, receipts() as never);
    await c.findMe({ userId: 'u1' } as never);
    await c.updateMe({ userId: 'u1' } as never, { name: 'x' } as never);
    await c.uploadPhoto({ userId: 'u1' } as never, img);
    expect(s.findMe).toHaveBeenCalledWith('u1');
    expect(s.updateMe).toHaveBeenCalledWith('u1', { name: 'x' });
    expect(s.uploadPhoto).toHaveBeenCalledWith('u1', img);
  });

  it('uploadPhoto rejects missing file, non-image and oversize', () => {
    const c = new RelativeController(svc() as never, receipts() as never);
    expect(() => c.uploadPhoto({ userId: 'u1' } as never, undefined)).toThrow(BadRequestException);
    expect(() =>
      c.uploadPhoto({ userId: 'u1' } as never, { mimetype: 'text/plain', size: 1 } as never),
    ).toThrow(BadRequestException);
    expect(() =>
      c.uploadPhoto({ userId: 'u1' } as never, { mimetype: 'image/png', size: 6 * 1024 * 1024 } as never),
    ).toThrow(BadRequestException);
  });

  it('admin routes delegate with scope/dto', async () => {
    const s = svc();
    const c = new RelativeController(s as never, receipts() as never);
    await c.findByResident('res1', { role: Role.SERVANT, userId: 'u1' } as never);
    await c.create({ name: 'x' } as never);
    await c.setResponsible('r1');
    await c.remove('r1');
    await c.generateAccess('r1', { email: 'a@b.com', password: 'pw' } as never);
    await c.resetPassword('r1', { password: 'pw2' } as never);
    expect(s.findByResident).toHaveBeenCalledWith('res1', { role: Role.SERVANT, userId: 'u1' });
    expect(s.generateAccess).toHaveBeenCalledWith('r1', 'a@b.com', 'pw');
    expect(s.resetPassword).toHaveBeenCalledWith('r1', 'pw2');
  });
});

// ─── Recibo do familiar (story 193) ───────────────────────────────────────────

describe('RelativeController — recibos do familiar (story 193)', () => {
  it('lista as parcelas pagas do PRÓPRIO filho (userId do token, nunca da URL)', async () => {
    const s = svc();
    const c = new RelativeController(s as never, receipts() as never);
    await c.findMyReceivables({ userId: 'u-fam' } as never);
    expect(s.findMyPaidReceivables).toHaveBeenCalledWith('u-fam');
  });

  it('baixa o recibo com o ESCOPO do familiar e devolve o PDF como anexo', async () => {
    const r = receipts();
    const c = new RelativeController(svc() as never, r as never);
    const res = makeRes();

    await c.downloadMyReceivableReceipt('rcv-1', { userId: 'u-fam' } as never, res as never);

    // O escopo é o do token: é ele que faz a parcela de outro filho dar 404.
    expect(r.generateForResidentReceivable).toHaveBeenCalledWith('rcv-1', 'u-fam', {
      relativeUserId: 'u-fam',
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="recibo-contribuicao-acolhido-000003.pdf"',
    );
    expect(res.send).toHaveBeenCalled();
  });

  it('erro do service sobe (o familiar precisa ver o 404, não um PDF vazio)', async () => {
    const r = receipts();
    r.generateForResidentReceivable.mockRejectedValue(new Error('boom'));
    const c = new RelativeController(svc() as never, r as never);
    const res = makeRes();
    await expect(
      c.downloadMyReceivableReceipt('rcv-1', { userId: 'u-fam' } as never, res as never),
    ).rejects.toThrow('boom');
    expect(res.send).not.toHaveBeenCalled();
  });
});
