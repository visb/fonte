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
    expect(s.create).toHaveBeenCalledWith('Termo', '', false, false);
  });

  it('create forwards explicit flags', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.create('Termo', 'body', true, true);
    expect(s.create).toHaveBeenCalledWith('Termo', 'body', true, true);
  });

  it('update builds a partial only with provided fields', async () => {
    const s = svc();
    const c = new DocumentTemplateController(s as never);
    await c.update('d1', 'New name', undefined, true, undefined);
    expect(s.update).toHaveBeenCalledWith('d1', { name: 'New name', isRequired: true });
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
