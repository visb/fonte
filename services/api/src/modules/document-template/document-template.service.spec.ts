import { ConflictException, NotFoundException } from '@nestjs/common';
import { DOCUMENT_PRINT_CSS, A4_PAGE_WIDTH_PX } from '@fonte/doc-styles';
import { Repository } from 'typeorm';
import { DocumentTemplateService } from './document-template.service';
import { DocumentTemplate } from './document-template.entity';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { StorageService } from '../storage/storage.service';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'tpl-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(repo: ReturnType<typeof makeRepo>, relativeRepo = makeRepo()) {
  return new DocumentTemplateService(
    repo as unknown as Repository<DocumentTemplate>,
    relativeRepo as unknown as Repository<Relative>,
    {} as StorageService,
  );
}

describe('DocumentTemplateService.findOne', () => {
  it('throws NotFound when missing', async () => {
    const service = makeService(makeRepo());
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DocumentTemplateService.create', () => {
  it('rejects a duplicate name', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'tpl-1' }) });
    const service = makeService(repo);
    await expect(service.create('Termo', '<p></p>')).rejects.toBeInstanceOf(ConflictException);
  });

  it('persists a new template', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.create('Termo', '<p>hi</p>', true);
    expect(repo.save).toHaveBeenCalled();
    expect(repo.create.mock.calls[0][0]).toMatchObject({ name: 'Termo', isRequired: true });
  });
});

describe('DocumentTemplateService.update', () => {
  it('rejects renaming to an existing template name', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'tpl-1' }) // findOne(id) in update
        .mockResolvedValueOnce({ id: 'tpl-2' }), // name conflict
    });
    const service = makeService(repo);
    await expect(service.update('tpl-1', { name: 'Outro' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('DocumentTemplateService.uploadImage', () => {
  // Story 22 — trava: a imagem é enviada ao storage SEM nenhum tratamento
  // (sem resize/recompress/conversão). Os bytes e o mimetype originais devem
  // chegar intactos ao StorageService.upload.
  it('passes the original file.buffer and file.mimetype to storage untouched', async () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03]);
    const upload = jest.fn().mockResolvedValue('/uploads/documents/doc-123.png');
    const uniqueFilename = jest.fn().mockReturnValue('doc-123.png');
    const storage = { upload, uniqueFilename } as unknown as StorageService;

    const service = new DocumentTemplateService(
      makeRepo() as unknown as Repository<DocumentTemplate>,
      makeRepo() as unknown as Repository<Relative>,
      storage,
    );

    const file = {
      originalname: 'logo.png',
      buffer,
      mimetype: 'image/png',
    } as unknown as Express.Multer.File;

    const result = await service.uploadImage(file);

    expect(uniqueFilename).toHaveBeenCalledWith('logo.png', 'doc-');
    expect(upload).toHaveBeenCalledWith('documents', 'doc-123.png', buffer, 'image/png');
    // Mesma referência de buffer — nenhuma cópia/transformação intermediária.
    expect(upload.mock.calls[0][2]).toBe(buffer);
    expect(upload.mock.calls[0][3]).toBe('image/png');
    expect(result).toEqual({ url: '/uploads/documents/doc-123.png' });
  });
});

describe('DocumentTemplateService.renderForResident', () => {
  it('substitutes resident variables in the template content', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'Eu, {{name}}, CPF {{cpf}}.' }),
    });
    const relativeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo, relativeRepo);

    const resident = { id: 'res-1', name: 'João', cpf: '12345678901' } as Resident;
    const html = await service.renderForResident('tpl-1', resident);

    expect(html).toContain('Eu, João, CPF 123.456.789-01.');
  });

  it('falls back to "não informado" for missing fields', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'RG: {{rg}}' }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'João' } as Resident);
    expect(html).toContain('RG: não informado');
  });

  // Story 24 — o PDF e o editor consomem o MESMO CSS de impressão
  // (@fonte/doc-styles). O <style> do HTML do PDF tem que conter exatamente o
  // DOCUMENT_PRINT_CSS compartilhado, garantindo que a quebra na tela case com
  // a do PDF (geometria A4 794×1123, base 12pt, tabela, imagem).
  it('injects the shared DOCUMENT_PRINT_CSS into the PDF html (single source of truth)', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '<p>oi</p>' }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'João' } as Resident);

    expect(html).toContain(DOCUMENT_PRINT_CSS);
    // Geometria/typografia consolidadas das stories 21/22/23 presentes no PDF.
    expect(html).toContain('font-size:12pt'); // story 23 — base unificada
    expect(html).toContain(`width:${A4_PAGE_WIDTH_PX}px`); // story 24 — A4 794px
    expect(html).toContain('table.doc-table'); // story 21 — tabelas
    expect(html).toContain('img{max-width:100%}'); // story 22 — guarda de imagem
    expect(html).toContain('text-decoration:underline'); // story 27 — link visível
    expect(html).toContain('p:empty{min-height:1.2em}'); // story 27 — preserva linha em branco
  });
});
