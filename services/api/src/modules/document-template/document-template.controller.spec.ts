import { BadRequestException } from '@nestjs/common';
import { DocumentTemplateController } from './document-template.controller';

function svc() {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'd1' }),
    create: jest.fn().mockResolvedValue({ id: 'd1' }),
    uploadImage: jest.fn().mockResolvedValue({ url: '/u/x.png' }),
    update: jest.fn().mockResolvedValue({ id: 'd1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}
const img = { mimetype: 'image/png', size: 100, buffer: Buffer.from('x') } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('DocumentTemplateController', () => {
  it('create applies defaults for omitted flags', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.create('Termo', undefined as never, undefined, undefined);
    // availableFor/kind/receiptType omitidos chegam crus (undefined) — quem
    // aplica os defaults (ALL, RESIDENT) e valida contra os enums é o service
    // (stories 160 e 178).
    expect(s.create).toHaveBeenCalledWith('Termo', '', false, false, undefined, undefined, undefined);
  });

  it('create forwards explicit flags', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.create('Termo', 'body', true, true);
    expect(s.create).toHaveBeenCalledWith('Termo', 'body', true, true, undefined, undefined, undefined);
  });

  it('create forwards availableFor to the service (story 160)', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.create('Termo', 'body', false, false, 'INACTIVE_ONLY');
    expect(s.create).toHaveBeenCalledWith(
      'Termo', 'body', false, false, 'INACTIVE_ONLY', undefined, undefined,
    );
  });

  // Story 178 — kind e receiptType passam CRUS: as invariantes (RECEIPT exige
  // receiptType, RESIDENT o proíbe) são regra de negócio e vivem no service.
  it('create forwards kind e receiptType crus ao service (story 178)', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.create('Recibo', 'body', false, false, undefined, 'RECEIPT', 'ASSOCIATE_CONTRIBUTION');
    expect(s.create).toHaveBeenCalledWith(
      'Recibo', 'body', false, false, undefined, 'RECEIPT', 'ASSOCIATE_CONTRIBUTION',
    );
  });

  it('findAll repassa o kind da query (default fica no service — story 178)', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.findAll('RECEIPT');
    expect(s.findAll).toHaveBeenCalledWith('RECEIPT');
    await c.findAll();
    expect(s.findAll).toHaveBeenLastCalledWith(undefined);
  });

  it('update inclui kind/receiptType só quando enviados (story 178)', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.update('d1', undefined, undefined, undefined, undefined, undefined, 'RECEIPT', 'PIZZA_SALE');
    expect(s.update).toHaveBeenCalledWith('d1', { kind: 'RECEIPT', receiptType: 'PIZZA_SALE' });
  });

  it('update builds a partial only with provided fields', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.update('d1', 'New name', undefined, true, undefined);
    expect(s.update).toHaveBeenCalledWith('d1', { name: 'New name', isRequired: true });
  });

  it('update includes availableFor only when provided (story 160)', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.update('d1', undefined, undefined, undefined, undefined, 'ACTIVE_ONLY');
    expect(s.update).toHaveBeenCalledWith('d1', { availableFor: 'ACTIVE_ONLY' });
  });

  it('findAll/findOne/remove delegate', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.findAll();
    await c.findOne('d1');
    await c.remove('d1');
    expect(s.findOne).toHaveBeenCalledWith('d1');
    expect(s.remove).toHaveBeenCalledWith('d1');
  });

  it('uploadImage validates presence, mimetype and size', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await expect(c.uploadImage(undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.uploadImage({ mimetype: 'text/plain', size: 1 } as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.uploadImage({ mimetype: 'image/png', size: 6 * 1024 * 1024 } as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.uploadImage(img)).resolves.toEqual({ url: '/u/x.png' });
  });
});
