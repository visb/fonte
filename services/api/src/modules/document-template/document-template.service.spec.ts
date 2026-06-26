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

// Storage stub: identity transforms by default so existing tests are unaffected.
// Tests that assert signing/stripping pass their own spies via `storage`.
function makeStorage(overrides: Partial<StorageService> = {}): StorageService {
  return {
    stripContentSignatures: (html: string) => html,
    signContentUrls: async (html: string) => html,
    ...overrides,
  } as unknown as StorageService;
}

function makeService(
  repo: ReturnType<typeof makeRepo>,
  relativeRepo = makeRepo(),
  storage: StorageService = makeStorage(),
) {
  return new DocumentTemplateService(
    repo as unknown as Repository<DocumentTemplate>,
    relativeRepo as unknown as Repository<Relative>,
    storage,
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

// Story 76 — o content guarda a URL CANÔNICA (sem assinatura, que expira em
// 24h); a assinatura é aplicada na hora de servir (GET/PDF). Sem isso, a URL
// assinada gravada no <img src> expirava e a imagem quebrava.
describe('DocumentTemplateService signed-url handling (story 76)', () => {
  it('strips signatures from content before persisting on create', async () => {
    const repo = makeRepo();
    const strip = jest.fn().mockReturnValue('<img src="https://s3/doc.png">');
    const service = makeService(repo, makeRepo(), makeStorage({ stripContentSignatures: strip }));

    await service.create('Termo', '<img src="https://s3/doc.png?X-Amz-sig">');

    expect(strip).toHaveBeenCalledWith('<img src="https://s3/doc.png?X-Amz-sig">');
    expect(repo.create.mock.calls[0][0].content).toBe('<img src="https://s3/doc.png">');
  });

  it('strips signatures from content before persisting on update', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '' }),
    });
    const strip = jest.fn().mockReturnValue('<img src="https://s3/doc.png">');
    const service = makeService(repo, makeRepo(), makeStorage({ stripContentSignatures: strip }));

    await service.update('tpl-1', { content: '<img src="https://s3/doc.png?X-Amz-sig">' });

    expect(strip).toHaveBeenCalledWith('<img src="https://s3/doc.png?X-Amz-sig">');
    expect(repo.update.mock.calls[0][1]).toMatchObject({ content: '<img src="https://s3/doc.png">' });
  });

  it('does not call strip on update when content is not provided', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '' }),
    });
    const strip = jest.fn((h: string) => h);
    const service = makeService(repo, makeRepo(), makeStorage({ stripContentSignatures: strip }));

    await service.update('tpl-1', { isRequired: true });

    expect(strip).not.toHaveBeenCalled();
    expect(repo.update.mock.calls[0][1]).toEqual({ isRequired: true });
  });

  it('signs content urls on findOne', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', content: '<img src="https://s3/doc.png">' }),
    });
    const sign = jest.fn().mockResolvedValue('<img src="https://s3/doc.png?X-Amz-signed">');
    const service = makeService(repo, makeRepo(), makeStorage({ signContentUrls: sign }));

    const result = await service.findOne('tpl-1');

    expect(sign).toHaveBeenCalledWith('<img src="https://s3/doc.png">');
    expect(result.content).toBe('<img src="https://s3/doc.png?X-Amz-signed">');
  });

  it('signs content urls for every template on findAll', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([
        { id: 'a', content: '<img src="https://s3/a.png">' },
        { id: 'b', content: '<img src="https://s3/b.png">' },
      ]),
    });
    const sign = jest.fn(async (h: string) => h.replace('">', '?signed">'));
    const service = makeService(repo, makeRepo(), makeStorage({ signContentUrls: sign }));

    const result = await service.findAll();

    expect(sign).toHaveBeenCalledTimes(2);
    expect(result[0].content).toBe('<img src="https://s3/a.png?signed">');
    expect(result[1].content).toBe('<img src="https://s3/b.png?signed">');
  });

  it('injects signed image urls into the PDF html (puppeteer must fetch a valid URL)', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'tpl-1',
        name: 'Termo',
        content: '<img src="https://s3/logo.png"><p>{{name}}</p>',
      }),
    });
    const sign = jest
      .fn()
      .mockResolvedValue('<img src="https://s3/logo.png?X-Amz-signed"><p>{{name}}</p>');
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), makeStorage({ signContentUrls: sign }));

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'João' } as Resident);

    expect(html).toContain('src="https://s3/logo.png?X-Amz-signed"');
    expect(html).not.toContain('src="https://s3/logo.png"><p>');
    expect(html).toContain('<p>João</p>');
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

describe('DocumentTemplateService.findAdmissionTemplates', () => {
  it('queries templates flagged for admission signing', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.findAdmissionTemplates();
    expect(repo.find).toHaveBeenCalledWith({
      where: { signAtAdmission: true },
      order: { name: 'ASC' },
    });
  });
});

describe('DocumentTemplateService.remove', () => {
  it('deletes after asserting the template exists', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', content: '' }),
    });
    const service = makeService(repo);
    await service.remove('tpl-1');
    expect(repo.delete).toHaveBeenCalledWith('tpl-1');
  });

  it('throws NotFound when the template is missing', async () => {
    const service = makeService(makeRepo());
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DocumentTemplateService.generatePdf', () => {
  it('renders via an injected browser and returns a slugified filename', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo de Adesão', content: '<p>{{name}}</p>' }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));

    const page = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('PDFDATA')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = { newPage: jest.fn().mockResolvedValue(page) };
    // Inject a ready browser so puppeteer is never actually launched.
    (service as any).browserPromise = Promise.resolve(browser);

    const result = await service.generatePdf('tpl-1', { id: 'res-1', name: 'João Silva' } as Resident);

    expect(result.filename).toBe('joao-silva-termo-de-adesao.pdf');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(page.close).toHaveBeenCalled();
  });
});

describe('DocumentTemplateService.onModuleDestroy', () => {
  it('closes an open browser', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const service = makeService(makeRepo());
    (service as any).browserPromise = Promise.resolve({ close });
    await service.onModuleDestroy();
    expect(close).toHaveBeenCalled();
  });

  it('no-ops when no browser was ever launched', async () => {
    const service = makeService(makeRepo());
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
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

  it('computes age, formats dates and maps marital status + responsible', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'tpl-1',
        name: 'Termo',
        content: 'Idade: {{age}}; Estado: {{maritalStatus}}; Resp: {{responsibleName}} ({{responsibleRelationship}})',
      }),
    });
    const relativeRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ name: 'Maria', relationship: 'Mãe', phone: '999' }),
    });
    const service = makeService(repo, relativeRepo);

    const resident = {
      id: 'res-1',
      name: 'João',
      birthDate: '2000-01-01',
      maritalStatus: 'MARRIED',
    } as unknown as Resident;
    const html = await service.renderForResident('tpl-1', resident);

    expect(html).toMatch(/Idade: \d+ anos/);
    expect(html).toContain('Estado: Casado(a)');
    expect(html).toContain('Resp: Maria (Mãe)');
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
    // Story 29 — o tracejado de célula de tabela sem borda é guia SÓ do editor; o PDF
    // mantém a tabela borderless e NÃO recebe a regra `dashed`.
    expect(html).not.toContain('dashed');
  });
});
