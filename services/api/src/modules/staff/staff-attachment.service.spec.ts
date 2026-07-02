import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StaffAttachmentService } from './staff-attachment.service';
import { StaffAttachment } from './staff-attachment.entity';
import { Staff } from './staff.entity';
import { StorageService } from '../storage/storage.service';

function pdfFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    originalname: 'contrato.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4'),
    ...overrides,
  } as Express.Multer.File;
}

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest
      .fn()
      .mockImplementation((v) =>
        Promise.resolve({ id: 'att-1', createdAt: new Date(), ...v }),
      ),
    softRemove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeStaffRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    exists: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeStorage(overrides: Record<string, jest.Mock> = {}) {
  return {
    decodeOriginalName: jest.fn().mockImplementation((n: string) => n),
    uniqueFilename: jest.fn().mockReturnValue('uniq.pdf'),
    upload: jest.fn().mockResolvedValue('/uploads/attachments/staff/uniq.pdf'),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeService(
  repo: ReturnType<typeof makeRepo> = makeRepo(),
  staffRepo: ReturnType<typeof makeStaffRepo> = makeStaffRepo(),
  storage: ReturnType<typeof makeStorage> = makeStorage(),
) {
  return new StaffAttachmentService(
    repo as unknown as Repository<StaffAttachment>,
    staffRepo as unknown as Repository<Staff>,
    storage as unknown as StorageService,
  );
}

function attachment(partial: Partial<StaffAttachment> = {}): StaffAttachment {
  return {
    id: 'att-1',
    staffId: 'staff-1',
    fileUrl: '/uploads/attachments/staff/uniq.pdf',
    fileName: 'contrato.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    createdByUserId: 'user-1',
    createdAt: new Date(),
    deletedAt: null,
    ...partial,
  } as StaffAttachment;
}

describe('StaffAttachmentService.addAttachment', () => {
  it('404 quando o servo não existe (ou está soft-deletado)', async () => {
    const staffRepo = makeStaffRepo({ exists: jest.fn().mockResolvedValue(false) });
    const service = makeService(makeRepo(), staffRepo);

    await expect(
      service.addAttachment('missing', pdfFile(), 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita quando o arquivo não veio no multipart', async () => {
    const service = makeService();
    await expect(
      service.addAttachment('staff-1', undefined as never, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita mimetype fora da allowlist (defesa contra upload arbitrário)', async () => {
    const storage = makeStorage();
    const service = makeService(makeRepo(), makeStaffRepo(), storage);

    await expect(
      service.addAttachment(
        'staff-1',
        pdfFile({ mimetype: 'application/x-msdownload', originalname: 'a.exe' }),
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('sobe o arquivo em attachments/staff e persiste com o autor', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const service = makeService(repo, makeStaffRepo(), storage);

    const result = await service.addAttachment('staff-1', pdfFile(), 'user-1');

    expect(storage.upload).toHaveBeenCalledWith(
      'attachments/staff',
      'uniq.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(repo.save).toHaveBeenCalled();
    expect(result.staffId).toBe('staff-1');
    expect(result.fileName).toBe('contrato.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.sizeBytes).toBe(1024);
    expect(result.createdByUserId).toBe('user-1');
    expect(typeof result.createdAt).toBe('string');
  });

  it('aceita imagem (png) — anexo genérico, não restrito a documento', async () => {
    const service = makeService();
    const result = await service.addAttachment(
      'staff-1',
      pdfFile({ mimetype: 'image/png', originalname: 'foto.png' }),
      'user-1',
    );
    expect(result.mimeType).toBe('image/png');
  });
});

describe('StaffAttachmentService.listAttachments', () => {
  it('404 quando o servo não existe', async () => {
    const staffRepo = makeStaffRepo({ exists: jest.fn().mockResolvedValue(false) });
    const service = makeService(makeRepo(), staffRepo);
    await expect(service.listAttachments('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lista por staffId ordenado do mais recente (find padrão exclui soft-deletados)', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([attachment()]),
    });
    const service = makeService(repo);

    const rows = await service.listAttachments('staff-1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { staffId: 'staff-1' },
      order: { createdAt: 'DESC' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('att-1');
  });
});

describe('StaffAttachmentService.removeAttachment', () => {
  it('404 quando o anexo não existe no servo', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    await expect(
      service.removeAttachment('staff-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deleta o registro e apaga o objeto no bucket', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue(attachment()),
    });
    const storage = makeStorage();
    const service = makeService(repo, makeStaffRepo(), storage);

    await service.removeAttachment('staff-1', 'att-1');

    expect(storage.delete).toHaveBeenCalledWith(
      '/uploads/attachments/staff/uniq.pdf',
    );
    expect(repo.softRemove).toHaveBeenCalled();
  });

  it('delete no bucket é best-effort: falha no storage loga e o soft delete segue', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue(attachment()),
    });
    const storage = makeStorage({
      delete: jest.fn().mockRejectedValue(new Error('bucket offline')),
    });
    const service = makeService(repo, makeStaffRepo(), storage);

    await expect(
      service.removeAttachment('staff-1', 'att-1'),
    ).resolves.toBeUndefined();
    expect(repo.softRemove).toHaveBeenCalled();
  });
});
