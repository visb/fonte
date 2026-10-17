import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import {
  DOCUMENT_PRINT_CSS,
  A4_PAGE_WIDTH_PX,
  A4_MARGIN_TOP_PX,
  A4_MARGIN_X_PX,
} from '@fonte/doc-styles';
import { Repository } from 'typeorm';
import { ReceiptType, ResidentStatus, TemplateAvailability, TemplateKind } from '@fonte/types';
import { DocumentTemplateService } from './document-template.service';
import { DocumentTemplate } from './document-template.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';
import { StorageService } from '../storage/storage.service';
import { extractImageUrls } from '../storage/storage.util';

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
    // Story 93 — diff de imagens: por padrão sem imagens no bucket (no-op).
    extractBucketImageUrls: () => [],
    delete: async () => undefined,
    ...overrides,
  } as unknown as StorageService;
}

function makeService(
  repo: ReturnType<typeof makeRepo>,
  relativeRepo = makeRepo(),
  storage: StorageService = makeStorage(),
  staffRepo = makeRepo(),
) {
  return new DocumentTemplateService(
    repo as unknown as Repository<DocumentTemplate>,
    relativeRepo as unknown as Repository<Relative>,
    staffRepo as unknown as Repository<Staff>,
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

// Story 93 — ao salvar/remover, as imagens que saíram do conteúdo viram órfãs
// no bucket e devem ser apagadas (diff). Best-effort: falha não aborta o save.
describe('DocumentTemplateService image diff cleanup (story 93)', () => {
  const BASE = 'https://bucket';
  function makeCleanupStorage(deleteMock: jest.Mock): StorageService {
    return makeStorage({
      extractBucketImageUrls: ((h: string) => extractImageUrls(h, BASE)) as never,
      delete: deleteMock as never,
    });
  }

  it('apaga só as imagens removidas no update, mantendo as conservadas', async () => {
    const oldContent = `<img src="${BASE}/documents/a.png"><img src="${BASE}/documents/b.png">`;
    const newContent = `<img src="${BASE}/documents/a.png">`; // b.png removida
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: oldContent }),
    });
    const del = jest.fn().mockResolvedValue(undefined);
    const service = makeService(repo, makeRepo(), makeCleanupStorage(del));

    await service.update('tpl-1', { content: newContent });

    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(`${BASE}/documents/b.png`);
  });

  it('não apaga nada quando nenhuma imagem foi removida', async () => {
    const content = `<img src="${BASE}/documents/a.png">`;
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content }),
    });
    const del = jest.fn().mockResolvedValue(undefined);
    const service = makeService(repo, makeRepo(), makeCleanupStorage(del));

    await service.update('tpl-1', { content });

    expect(del).not.toHaveBeenCalled();
  });

  it('best-effort: falha do storage.delete não aborta o update', async () => {
    const oldContent = `<img src="${BASE}/documents/a.png">`;
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: oldContent }),
    });
    const del = jest.fn().mockRejectedValue(new Error('s3 down'));
    const service = makeService(repo, makeRepo(), makeCleanupStorage(del));

    await expect(
      service.update('tpl-1', { content: '<p>sem imagem</p>' }),
    ).resolves.toBeDefined();
    expect(del).toHaveBeenCalledWith(`${BASE}/documents/a.png`);
  });

  it('remove apaga todas as imagens do conteúdo do template', async () => {
    const content = `<img src="${BASE}/documents/a.png"><img src="${BASE}/documents/b.png">`;
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', content }),
    });
    const del = jest.fn().mockResolvedValue(undefined);
    const service = makeService(repo, makeRepo(), makeCleanupStorage(del));

    await service.remove('tpl-1');

    expect(repo.delete).toHaveBeenCalledWith('tpl-1');
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith(`${BASE}/documents/a.png`);
    expect(del).toHaveBeenCalledWith(`${BASE}/documents/b.png`);
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
      makeRepo() as unknown as Repository<Staff>,
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
    // Story 178 — o kind entra no WHERE: recibo nunca é documento de
    // acolhimento, nem por acidente de flag.
    expect(repo.find).toHaveBeenCalledWith({
      where: { signAtAdmission: true, kind: TemplateKind.RESIDENT },
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

  // Story 154 — a margem do PDF deixou de ser o `padding` do body (caixa do
  // FLUXO: só materializa no topo da 1ª página e no pé da última) e passou a ser
  // margem da PÁGINA, que se repete em todas. No Chrome, a margem passada ao
  // printToPDF tem precedência sobre o `@page` do CSS: se esta continuasse
  // zerada, o `@page` do DOCUMENT_PRINT_CSS seria ignorado no caminho principal
  // e a página 2 voltaria a sangrar até a borda do papel.
  describe('page margin (story 154)', () => {
    async function callPdf() {
      const repo = makeRepo({
        findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '<p>oi</p>' }),
      });
      const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
      const page = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('PDFDATA')),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (service as any).browserPromise = Promise.resolve({ newPage: jest.fn().mockResolvedValue(page) });
      await service.generatePdf('tpl-1', { id: 'res-1', name: 'João Silva' } as Resident);
      return page.pdf.mock.calls[0][0] as {
        format: string;
        margin: { top: string; bottom: string; left: string; right: string };
      };
    }

    it('passes all FOUR margins to page.pdf, from the shared constants', async () => {
      const options = await callPdf();
      expect(options.format).toBe('A4');
      expect(options.margin).toEqual({
        top: `${A4_MARGIN_TOP_PX}px`,
        bottom: `${A4_MARGIN_TOP_PX}px`,
        left: `${A4_MARGIN_X_PX}px`,
        right: `${A4_MARGIN_X_PX}px`,
      });
      // Valores reais da convenção — trava contra "constante nova com outro número".
      expect(options.margin).toEqual({ top: '48px', bottom: '48px', left: '40px', right: '40px' });
    });

    it('never sends the zeroed margin of the old convention (direct regression)', async () => {
      const options = await callPdf();
      for (const side of ['top', 'bottom', 'left', 'right'] as const) {
        expect(options.margin[side]).not.toBe('0');
      }
    });
  });
});

// Story 152 — PDF combinado: os documentos são renderizados um a um e só depois
// mesclados, então o arquivo final tem a SOMA das páginas (nenhum documento
// começa na página onde o anterior terminou).
describe('DocumentTemplateService.generateCombinedPdf', () => {
  // PDF A4 real com `count` páginas, para o merge do pdf-lib ter o que copiar.
  async function pdfWithPages(count: number): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < count; i += 1) doc.addPage([595.28, 841.89]);
    return Buffer.from(await doc.save());
  }

  function makeCombinedService(templates: Record<string, { name: string; content: string }>) {
    const repo = makeRepo({
      findOne: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const found = templates[where.id];
        return Promise.resolve(found ? { id: where.id, ...found } : null);
      }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    const page = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = { newPage: jest.fn().mockResolvedValue(page) };
    (service as any).browserPromise = Promise.resolve(browser);
    return { service, repo, page, browser };
  }

  const resident = { id: 'res-1', name: 'João Silva' } as Resident;

  it('renders each template in the received order and merges every page', async () => {
    const { service, page } = makeCombinedService({
      'tpl-a': { name: 'Termo A', content: '<p>DOC-A</p>' },
      'tpl-b': { name: 'Termo B', content: '<p>DOC-B</p>' },
    });
    page.pdf
      .mockResolvedValueOnce(await pdfWithPages(2))
      .mockResolvedValueOnce(await pdfWithPages(3));

    const result = await service.generateCombinedPdf(['tpl-a', 'tpl-b'], resident);

    // Ordem da tela = ordem no arquivo final.
    expect(page.setContent.mock.calls[0][0]).toContain('DOC-A');
    expect(page.setContent.mock.calls[1][0]).toContain('DOC-B');
    // 2 + 3 páginas: nada foi concatenado dentro da mesma página.
    const merged = await PDFDocument.load(result.buffer);
    expect(merged.getPageCount()).toBe(5);
    expect(result.filename).toBe('joao-silva-documentos.pdf');
    expect(page.close).toHaveBeenCalledTimes(2);
  });

  it('honours the inverse order too (the caller decides the sequence)', async () => {
    const { service, page } = makeCombinedService({
      'tpl-a': { name: 'Termo A', content: '<p>DOC-A</p>' },
      'tpl-b': { name: 'Termo B', content: '<p>DOC-B</p>' },
    });
    page.pdf
      .mockResolvedValueOnce(await pdfWithPages(1))
      .mockResolvedValueOnce(await pdfWithPages(1));

    await service.generateCombinedPdf(['tpl-b', 'tpl-a'], resident);

    expect(page.setContent.mock.calls[0][0]).toContain('DOC-B');
    expect(page.setContent.mock.calls[1][0]).toContain('DOC-A');
  });

  it('rejects an empty selection without opening a browser page', async () => {
    const { service, browser } = makeCombinedService({});
    await expect(service.generateCombinedPdf([], resident)).rejects.toBeInstanceOf(BadRequestException);
    expect(browser.newPage).not.toHaveBeenCalled();
  });

  it('throws NotFound when any template id does not exist', async () => {
    const { service, page } = makeCombinedService({ 'tpl-a': { name: 'Termo A', content: '<p>A</p>' } });
    page.pdf.mockResolvedValue(await pdfWithPages(1));
    await expect(
      service.generateCombinedPdf(['tpl-a', 'nope'], resident),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closes every opened page when a render fails midway', async () => {
    const { service, page } = makeCombinedService({
      'tpl-a': { name: 'Termo A', content: '<p>A</p>' },
      'tpl-b': { name: 'Termo B', content: '<p>B</p>' },
    });
    page.pdf
      .mockResolvedValueOnce(await pdfWithPages(1))
      .mockRejectedValueOnce(new Error('render falhou'));

    await expect(service.generateCombinedPdf(['tpl-a', 'tpl-b'], resident)).rejects.toThrow('render falhou');
    expect(page.close).toHaveBeenCalledTimes(2);
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

  it.each([
    ['STABLE_UNION', 'União estável'],
    ['WIDOWED', 'Viúvo(a)'],
  ])('maps marital status %s to "%s" (story 210)', async (status, label) => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'Estado: {{maritalStatus}}' }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));

    const resident = { id: 'res-1', name: 'João', maritalStatus: status } as unknown as Resident;
    const html = await service.renderForResident('tpl-1', resident);
    expect(html).toContain(`Estado: ${label}`);
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
    // Story 154 — a margem chega ao HTML servido pelo botão "Imprimir" via @page
    // (esse caminho não passa pela opção `margin` do puppeteer).
    expect(html).toContain(`@page{size:A4;margin:${A4_MARGIN_TOP_PX}px ${A4_MARGIN_X_PX}px}`);
    // ...e o body não carrega mais a geometria da página (largura fixa/padding):
    // ele ocupa a área imprimível deixada pela margem da página.
    expect(html).toContain('width:100%');
    expect(html).not.toContain(`width:${A4_PAGE_WIDTH_PX}px`);
    expect(html).toContain('table.doc-table'); // story 21 — tabelas
    expect(html).toContain('img{max-width:100%}'); // story 22 — guarda de imagem
    expect(html).toContain('text-decoration:underline'); // story 27 — link visível
    expect(html).toContain('p:empty{min-height:1.2em}'); // story 27 — preserva linha em branco
    // Story 29 — o tracejado de célula de tabela sem borda é guia SÓ do editor; o PDF
    // mantém a tabela borderless e NÃO recebe a regra `dashed`.
    expect(html).not.toContain('dashed');
  });
});

// Story 159 — {{exitDate}}: a contraparte de {{entryDate}}. Diverge de propósito
// das demais datas: sem saída imprime 'não informado', NUNCA o traço
// `___/___/______` que `formatDate(null)` devolveria (decisão 1 do plano).
describe('DocumentTemplateService {{exitDate}} (story 159)', () => {
  // Renderiza um template com o `resident` dado; sem responsável (não interessa aqui).
  async function renderWith(resident: Partial<Resident>, content = 'Saída: {{exitDate}}') {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content }),
    });
    const relativeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo, relativeRepo);
    return service.renderForResident('tpl-1', {
      id: 'res-1',
      name: 'João',
      ...resident,
    } as Resident);
  }

  it('filho COM data de saída → dd/mm/aaaa em UTC (mesma regra do {{entryDate}})', async () => {
    // '2026-03-09' em UTC é 09/03/2026: sem o timeZone: 'UTC' do formatDate a data
    // retrocederia um dia em fuso negativo (America/Sao_Paulo).
    const html = await renderWith({ exitDate: '2026-03-09' as unknown as Date });
    expect(html).toContain('Saída: 09/03/2026');
    expect(html).not.toContain('{{exitDate}}');
  });

  it('filho SEM data de saída → exatamente "não informado", nunca o traço (decisão 1)', async () => {
    const html = await renderWith({ exitDate: null });
    expect(html).toContain('Saída: não informado');
    expect(html).not.toContain('___/___/______');
    expect(html).not.toContain('{{exitDate}}');
  });

  it('exitDate ausente no objeto (undefined) → também "não informado"', async () => {
    const html = await renderWith({});
    expect(html).toContain('Saída: não informado');
    expect(html).not.toContain('___/___/______');
  });

  it('template sem o token → HTML inalterado', async () => {
    const semToken = await renderWith({ exitDate: '2026-03-09' as unknown as Date }, '<p>Sem token nenhum</p>');
    expect(semToken).toContain('<p>Sem token nenhum</p>');
    expect(semToken).not.toContain('09/03/2026');
    expect(semToken).not.toContain('não informado');
  });

  it('{{exitDate}} repetido → todas as ocorrências substituídas (replace global)', async () => {
    const content = 'A: {{exitDate}} | B: {{exitDate}} | C: {{exitDate}}';
    const comData = await renderWith({ exitDate: '2026-03-09' as unknown as Date }, content);
    expect(comData).toContain('A: 09/03/2026 | B: 09/03/2026 | C: 09/03/2026');
    expect(comData).not.toContain('{{exitDate}}');

    const semData = await renderWith({ exitDate: null }, content);
    expect(semData).toContain('A: não informado | B: não informado | C: não informado');
  });

  // REGRESSÃO — a decisão 1 vale SÓ para a saída: a entrada nula continua caindo
  // no traço, que ali é justamente o convite a preencher à mão.
  it('regressão: {{entryDate}} nulo segue imprimindo ___/___/______', async () => {
    const content = 'Entrada: {{entryDate}} | Saída: {{exitDate}}';
    const html = await renderWith({ entryDate: null, exitDate: null }, content);
    expect(html).toContain('Entrada: ___/___/______');
    expect(html).toContain('Saída: não informado');
  });

  it('entrada e saída preenchidas convivem no mesmo render', async () => {
    const html = await renderWith(
      { entryDate: '2025-01-15' as unknown as Date, exitDate: '2026-03-09' as unknown as Date },
      'Entrada: {{entryDate}} | Saída: {{exitDate}}',
    );
    expect(html).toContain('Entrada: 15/01/2025 | Saída: 09/03/2026');
  });
});

// Story 153 — {{responsibleWithRelationship}}: variável ÚNICA e condicional que
// decide o texto pelo que existe de fato, no lugar do rodapé escrito à mão
// `{{responsibleName}}({{responsibleRelationship}})` (que imprimia
// `não informado(não informado)` para acolhido sem responsável).
describe('DocumentTemplateService {{responsibleWithRelationship}} (story 153)', () => {
  // Renderiza um template cujo conteúdo é SÓ o token novo, com o `responsible`
  // que o relativeRepo devolver.
  async function renderWith(responsible: unknown, content = '{{responsibleWithRelationship}}') {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content }),
    });
    const relativeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(responsible) });
    const service = makeService(repo, relativeRepo);
    return service.renderForResident('tpl-1', { id: 'res-1', name: 'João' } as Resident);
  }

  it('nome + parentesco → "Nome (Parentesco)" com espaço antes do parêntese (decisão 1)', async () => {
    const html = await renderWith({ name: 'Maria Souza', relationship: 'Mãe' });
    expect(html).toContain('Maria Souza (Mãe)');
  });

  it('parentesco null → só o nome, sem parênteses vazios (decisão 2)', async () => {
    const html = await renderWith({ name: 'Maria Souza', relationship: null });
    expect(html).toContain('Maria Souza');
    expect(html).not.toContain('Maria Souza (');
  });

  it('parentesco só de espaços → só o nome (decisão 4 — trim antes de decidir)', async () => {
    const html = await renderWith({ name: 'Maria Souza', relationship: '   ' });
    expect(html).toContain('Maria Souza');
    expect(html).not.toContain('Maria Souza (');
  });

  it('sem responsável → o literal "Responsável" (decisão 3)', async () => {
    const html = await renderWith(null);
    expect(html).toContain('Responsável');
    // Nunca o lixo que a story veio consertar.
    expect(html).not.toContain('não informado');
  });

  it('responsável com nome em branco → "Responsável", nunca um parentesco órfão (decisão 5)', async () => {
    const html = await renderWith({ name: '  ', relationship: 'Mãe' });
    expect(html).toContain('Responsável');
    expect(html).not.toContain('(Mãe)');
  });

  // Decisão 6 — a variável nova é ADITIVA: templates já salvos em produção usam
  // o par antigo e têm que continuar rendendo exatamente igual, inclusive o
  // fallback 'não informado'. Nenhum token é prefixo de outro dentro das chaves
  // duplas, então {{responsibleName}} não é sequestrado pelo token novo.
  it('regressão: {{responsibleName}} e {{responsibleRelationship}} seguem inalterados no mesmo render', async () => {
    const content =
      'A: {{responsibleName}}({{responsibleRelationship}}) | B: {{responsibleWithRelationship}}';
    const withData = await renderWith({ name: 'Maria Souza', relationship: 'Mãe' }, content);
    expect(withData).toContain('A: Maria Souza(Mãe)');
    expect(withData).toContain('B: Maria Souza (Mãe)');

    const withoutData = await renderWith(null, content);
    expect(withoutData).toContain('A: não informado(não informado)');
    expect(withoutData).toContain('B: Responsável');
  });
});

// Story 128 — a variável {{signature}} injeta o bloco de assinatura do usuário
// que gera o documento: imagem + linha de 25 "_" + nome. Story 137 — a role NÃO
// é mais impressa abaixo da assinatura e o nome deixou de ser negrito.
describe('DocumentTemplateService signature block (story 128)', () => {
  const SIGNATURE_LINE = '_'.repeat(25);

  function makeSigningStorage(overrides: Partial<StorageService> = {}): StorageService {
    return makeStorage({
      canonicalizeS3Url: ((u: string) => u) as never,
      isS3Url: (() => true) as never,
      signUrl: (async (u: string) => `${u}?X-Amz-signed`) as never,
      ...overrides,
    });
  }

  function makeStaffRepo(staff: unknown) {
    return makeRepo({ findOne: jest.fn().mockResolvedValue(staff) });
  }

  it('renders <img>, the 25-underscore line and name with a signature', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'Eu, {{name}}. {{signature}}' }),
    });
    const staffRepo = makeStaffRepo({
      name: 'João Silva',
      signatureUrl: 'https://s3/sig.png',
      user: { role: 'COORDINATOR' },
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), makeSigningStorage(), staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(html).toContain('<img class="doc-signature-img" src="https://s3/sig.png?X-Amz-signed"');
    expect(html).toContain(SIGNATURE_LINE);
    expect(html).not.toContain('_'.repeat(26));
    expect(html).toContain('João Silva');
    expect(html).not.toContain('{{signature}}');
    // as demais variáveis seguem substituídas
    expect(html).toContain('Eu, Ana.');
  });

  // Story 137 — a role deixou de ser impressa abaixo da assinatura: nem o label
  // PT (Coordenador/Administrador/Servo) nem o <div class="doc-signature-role">.
  it('does NOT print the signer role below the signature (story 137)', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '{{signature}}' }),
    });
    const staffRepo = makeStaffRepo({
      name: 'João Silva',
      signatureUrl: 'https://s3/sig.png',
      user: { role: 'COORDINATOR' },
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), makeSigningStorage(), staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(html).toContain('João Silva');
    expect(html).not.toContain('doc-signature-role');
    expect(html).not.toContain('Coordenador');
    expect(html).not.toContain('Administrador');
    // "Servo" é substring de outras palavras; garantimos que o label PT da role
    // não sai como bloco próprio verificando a ausência da div dedicada acima.
  });

  // Story 137 — o CSS do bloco não aplica negrito ao nome nem carrega mais a
  // regra .doc-signature-role.
  it('CSS does not bold the signer name and drops the role rule (story 137)', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '{{signature}}' }),
    });
    const staffRepo = makeStaffRepo({ name: 'João Silva', signatureUrl: 'https://s3/sig.png', user: { role: 'ADMIN' } });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), makeSigningStorage(), staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(html).not.toContain('.doc-signature-name{font-weight:600}');
    expect(html).not.toContain('.doc-signature-role');
    // a regra do nome segue existindo, agora com peso normal
    expect(html).toContain('.doc-signature-name{font-weight:normal}');
  });

  it('renders the line + name but NO <img> when the signer has no signature', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '{{signature}}' }),
    });
    const staffRepo = makeStaffRepo({ name: 'João Silva', signatureUrl: null, user: { role: 'COORDINATOR' } });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), makeSigningStorage(), staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(html).toContain(SIGNATURE_LINE);
    expect(html).toContain('João Silva');
    // sem <img> no corpo — o CSS `.doc-signature-img{}` sempre existe no <style>,
    // então checamos a tag de imagem real, não a classe.
    expect(html).not.toContain('<img class="doc-signature-img"');
  });

  it('never leaves {{signature}} raw when there is no signer at all', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'Assino: {{signature}}' }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident);

    expect(html).not.toContain('{{signature}}');
    expect(html).toContain(SIGNATURE_LINE);
  });

  it('does not add any signature block when the template omits {{signature}}', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'Só o nome: {{name}}' }),
    });
    const staffRepo = makeStaffRepo({ name: 'João', signatureUrl: 'https://s3/sig.png', user: { role: 'ADMIN' } });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), makeSigningStorage(), staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    // sem bloco de assinatura no corpo — o CSS `.doc-signature{}` sempre existe
    // no <style>, então checamos a div real do bloco.
    expect(html).not.toContain('<div class="doc-signature">');
    expect(html).toContain('Só o nome: Ana');
  });

  it('signs the signature URL before injecting it (story 76 regression)', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '{{signature}}' }),
    });
    const signUrl = jest.fn().mockResolvedValue('https://s3/sig.png?X-Amz-signed');
    const storage = makeSigningStorage({ signUrl: signUrl as never });
    const staffRepo = makeStaffRepo({ name: 'João', signatureUrl: 'https://s3/sig.png', user: { role: 'ADMIN' } });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), storage, staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(signUrl).toHaveBeenCalledWith('https://s3/sig.png');
    expect(html).toContain('src="https://s3/sig.png?X-Amz-signed"');
    expect(html).not.toContain('src="https://s3/sig.png"');
  });

  // Story 135 — em modo local (não-S3) a assinatura sai como caminho relativo
  // /uploads/... que o puppeteer não resolve; resolveSigner passa por toDataUri
  // para inline como data URI. Em S3, segue presignando (sem regressão).
  it('inlines the signature as a data URI in non-S3 mode', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '{{signature}}' }),
    });
    const toDataUri = jest.fn().mockResolvedValue('data:image/png;base64,AAAA');
    const storage = makeStorage({
      canonicalizeS3Url: ((u: string) => u) as never,
      isS3Url: (() => false) as never,
      toDataUri: toDataUri as never,
    });
    const staffRepo = makeStaffRepo({
      name: 'João',
      signatureUrl: '/uploads/signatures/sig.png',
      user: { role: 'ADMIN' },
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), storage, staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(toDataUri).toHaveBeenCalledWith('/uploads/signatures/sig.png');
    expect(html).toContain('<img class="doc-signature-img" src="data:image/png;base64,AAAA"');
    expect(html).not.toContain('src="/uploads/');
  });

  it('keeps presigning (never inlines) in S3 mode — no regression', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '{{signature}}' }),
    });
    const signUrl = jest.fn().mockResolvedValue('https://s3/sig.png?X-Amz-signed');
    const toDataUri = jest.fn();
    const storage = makeSigningStorage({ signUrl: signUrl as never, toDataUri: toDataUri as never });
    const staffRepo = makeStaffRepo({ name: 'João', signatureUrl: 'https://s3/sig.png', user: { role: 'ADMIN' } });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), storage, staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(signUrl).toHaveBeenCalledWith('https://s3/sig.png');
    expect(toDataUri).not.toHaveBeenCalled();
    expect(html).toContain('src="https://s3/sig.png?X-Amz-signed"');
  });

  it('resolves no signer when the user has no staff profile', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '{{signature}}' }),
    });
    const staffRepo = makeStaffRepo(null);
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), makeSigningStorage(), staffRepo);

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'ghost-user');

    expect(html).toContain(SIGNATURE_LINE);
    expect(html).not.toContain('<img class="doc-signature-img"');
  });
});

// Story 136 — a assinatura deve honrar o text-align aplicado à linha do
// {{signature}} no editor. Quando o token é o único conteúdo de um <p …>, o
// PARÁGRAFO INTEIRO vira o <div class="doc-signature"> carregando o alinhamento
// no style (evita o <div>-em-<p> inválido que perdia o alinhamento e caía à
// esquerda). CSS: .doc-signature-img{display:inline-block} p/ o text-align
// centralizar a própria imagem.
describe('DocumentTemplateService signature alignment (story 136)', () => {
  const SIGNATURE_LINE = '_'.repeat(25);

  function makeSigningStorage(overrides: Partial<StorageService> = {}): StorageService {
    return makeStorage({
      canonicalizeS3Url: ((u: string) => u) as never,
      isS3Url: (() => true) as never,
      signUrl: (async (u: string) => `${u}?X-Amz-signed`) as never,
      ...overrides,
    });
  }

  function makeStaffRepo(staff: unknown) {
    return makeRepo({ findOne: jest.fn().mockResolvedValue(staff) });
  }

  function makeAlignService(content: string, staff: unknown = null) {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content }),
    });
    return makeService(
      repo,
      makeRepo({ findOne: jest.fn().mockResolvedValue(null) }),
      makeSigningStorage(),
      makeStaffRepo(staff),
    );
  }

  it.each(['center', 'right', 'left'])(
    'carries the paragraph text-align:%s into the signature block style',
    async (align) => {
      const service = makeAlignService(`<p style="text-align: ${align}">{{signature}}</p>`, {
        name: 'João Silva',
        signatureUrl: 'https://s3/sig.png',
        user: { role: 'COORDINATOR' },
      });

      const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

      expect(html).toContain(`<div class="doc-signature" style="text-align:${align}">`);
      // o parágrafo com o token nu some — não há <div> dentro de <p> nem token cru
      expect(html).not.toContain('{{signature}}');
      expect(html).not.toContain(`<p style="text-align: ${align}"><div`);
      expect(html).toContain(SIGNATURE_LINE);
    },
  );

  // Regressão produção — o editor embrulha o token num <span> de fonte e prefixa
  // `&nbsp;`, então o {{signature}} não é filho direto do <p>. O parágrafo mesmo
  // assim deve virar o bloco carregando o text-align do <p> (antes caía no
  // fallback inline sem alinhamento → assinatura não centralizava no PDF).
  it('carries the paragraph alignment when the token is wrapped in a <span> with &nbsp;', async () => {
    const content =
      '<p style="text-align: center;">' +
      '<span data-font-size="12" style="font-size: 12pt; line-height: 1.2;">&nbsp;{{signature}}</span>' +
      '</p>';
    const service = makeAlignService(content, {
      name: 'João Silva',
      signatureUrl: 'https://s3/sig.png',
      user: { role: 'COORDINATOR' },
    });

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(html).toContain('<div class="doc-signature" style="text-align:center">');
    // parágrafo inteiro substituído — sem <div> aninhado em <span>/<p> nem token cru
    expect(html).not.toContain('{{signature}}');
    expect(html).not.toContain('<span data-font-size="12"');
    expect(html).toContain(SIGNATURE_LINE);
  });

  it('emits no alignment style for a <p> without text-align (default left preserved)', async () => {
    const service = makeAlignService('<p>{{signature}}</p>', {
      name: 'João Silva',
      signatureUrl: 'https://s3/sig.png',
      user: { role: 'COORDINATOR' },
    });

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(html).toContain('<div class="doc-signature">');
    expect(html).not.toContain('style="text-align');
    expect(html).not.toContain('{{signature}}');
  });

  it('falls back to the bare-token replace when {{signature}} is inline in a paragraph', async () => {
    const service = makeAlignService('<p style="text-align: center">Assino: {{signature}} fim</p>', {
      name: 'João Silva',
      signatureUrl: 'https://s3/sig.png',
      user: { role: 'COORDINATOR' },
    });

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    // inline → fallback: bloco inserido sem style de alinhamento, texto ao redor intacto
    expect(html).toContain('<div class="doc-signature">');
    expect(html).not.toContain('{{signature}}');
    expect(html).toContain('Assino:');
    expect(html).toContain('fim');
  });

  it('honors alignment even when the signer has no signature image', async () => {
    const service = makeAlignService('<p style="text-align: center">{{signature}}</p>', {
      name: 'João Silva',
      signatureUrl: null,
      user: { role: 'COORDINATOR' },
    });

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident, 'user-1');

    expect(html).toContain('<div class="doc-signature" style="text-align:center">');
    expect(html).toContain(SIGNATURE_LINE);
    expect(html).toContain('João Silva');
    expect(html).not.toContain('<img class="doc-signature-img"');
  });

  it('CSS: .doc-signature-img uses display:inline-block so text-align centers the image', async () => {
    const service = makeAlignService('<p>oi</p>');

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'Ana' } as Resident);

    expect(html).toContain('.doc-signature-img{display:inline-block;height:64px');
    expect(html).not.toContain('.doc-signature-img{display:block');
  });
});

// Story 157 — {{residentPhoto}}: a SEGUNDA variável de bloco do sistema. Com
// foto cadastrada imprime a imagem em 4×4 cm; sem foto imprime a MOLDURA VAZIA
// rotulada "Foto" (análogo à linha de 25 "_" da assinatura), para colar a foto à
// mão. Nunca bloqueia a geração e nunca sai crua no papel.
describe('DocumentTemplateService resident photo block (story 157)', () => {
  function makeSigningStorage(overrides: Partial<StorageService> = {}): StorageService {
    return makeStorage({
      canonicalizeS3Url: ((u: string) => (u.includes('?') ? u.slice(0, u.indexOf('?')) : u)) as never,
      isS3Url: ((u: string) => u.startsWith('https://s3/')) as never,
      signUrl: (async (u: string) => `${u}?X-Amz-signed`) as never,
      toDataUri: (async (u: string) => u) as never,
      ...overrides,
    });
  }

  // Renderiza `content` para um resident arbitrário (o que interessa é o photoUrl).
  function makePhotoService(content: string, storage: StorageService = makeSigningStorage()) {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content }),
    });
    return makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }), storage);
  }

  function residentWith(photoUrl: string | null): Resident {
    return { id: 'res-1', name: 'Ana', photoUrl } as Resident;
  }

  it('acolhido COM foto → <img class="doc-photo-img"> com a URL assinada, sem moldura vazia', async () => {
    const service = makePhotoService('<p>Foto:</p>{{residentPhoto}}');

    const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'));

    expect(html).toContain(
      '<img class="doc-photo-img" src="https://s3/residents/ana.jpg?X-Amz-signed" alt="Foto"/>',
    );
    // a moldura vazia é o caminho do "sem foto" — não sai junto com a imagem
    expect(html).not.toContain('<div class="doc-photo-placeholder">Foto</div>');
    expect(html).not.toContain('{{residentPhoto}}');
  });

  it('acolhido SEM foto → moldura vazia rotulada "Foto", sem nenhum <img> de foto', async () => {
    const service = makePhotoService('{{residentPhoto}}');

    const html = await service.renderForResident('tpl-1', residentWith(null));

    expect(html).toContain('<div class="doc-photo-placeholder">Foto</div>');
    // o CSS `.doc-photo-img{...}` sempre existe no <style>, então checamos a TAG
    expect(html).not.toContain('<img class="doc-photo-img"');
    expect(html).not.toContain('{{residentPhoto}}');
  });

  // Story 135 — em modo local a foto é `/uploads/residents/...`, que o puppeteer
  // não resolve (setContent não tem base URL): tem que virar data URI.
  it('modo não-S3 → a src sai como data URI (regressão da story 135)', async () => {
    const toDataUri = jest.fn().mockResolvedValue('data:image/jpeg;base64,AAAA');
    const storage = makeStorage({
      canonicalizeS3Url: ((u: string) => u) as never,
      isS3Url: (() => false) as never,
      toDataUri: toDataUri as never,
    });
    const service = makePhotoService('{{residentPhoto}}', storage);

    const html = await service.renderForResident('tpl-1', residentWith('/uploads/residents/ana.jpg'));

    expect(toDataUri).toHaveBeenCalledWith('/uploads/residents/ana.jpg');
    expect(html).toContain('<img class="doc-photo-img" src="data:image/jpeg;base64,AAAA"');
    expect(html).not.toContain('src="/uploads/');
  });

  // Decisão 5 — canonicaliza ANTES de assinar: uma URL que já chega assinada não
  // pode ganhar uma segunda query de assinatura.
  it('URL já assinada na entrada → assinada UMA vez só (decisão 5)', async () => {
    const signUrl = jest.fn().mockResolvedValue('https://s3/residents/ana.jpg?X-Amz-fresh');
    const storage = makeSigningStorage({ signUrl: signUrl as never });
    const service = makePhotoService('{{residentPhoto}}', storage);

    const html = await service.renderForResident(
      'tpl-1',
      residentWith('https://s3/residents/ana.jpg?X-Amz-Signature=velha&X-Amz-Expires=900'),
    );

    expect(signUrl).toHaveBeenCalledTimes(1);
    expect(signUrl).toHaveBeenCalledWith('https://s3/residents/ana.jpg');
    expect(html).toContain('src="https://s3/residents/ana.jpg?X-Amz-fresh"');
    expect(html).not.toContain('X-Amz-Signature=velha');
  });

  // A URL presignada carrega `$` e `&`: o replace tem que ser por FUNÇÃO, senão
  // `$'`/`$&` viriam interpretados como padrão de substituição.
  it('URL presignada com $ e & entra literal no src (replace por função)', async () => {
    const signed = "https://s3/residents/ana.jpg?X-Amz-Signature=a$'b&X-Amz-Expires=900";
    const storage = makeSigningStorage({ signUrl: (async () => signed) as never });
    const service = makePhotoService('{{residentPhoto}}', storage);

    const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'));

    expect(html).toContain(`src="${signed}"`);
  });

  it.each(['center', 'right', 'left'])(
    'token sozinho num <p style="text-align:%s"> → o bloco herda o alinhamento e o <p> some',
    async (align) => {
      const service = makePhotoService(`<p style="text-align: ${align}">{{residentPhoto}}</p>`);

      const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'));

      expect(html).toContain(`<div class="doc-photo" style="text-align:${align}">`);
      // sem <div> dentro de <p> e sem token cru
      expect(html).not.toContain(`<p style="text-align: ${align}"><div`);
      expect(html).not.toContain('{{residentPhoto}}');
    },
  );

  it('token embrulhado em <span> com &nbsp; também troca o parágrafo inteiro', async () => {
    const content =
      '<p style="text-align: center;">' +
      '<span data-font-size="12" style="font-size: 12pt; line-height: 1.2;">&nbsp;{{residentPhoto}}</span>' +
      '</p>';
    const service = makePhotoService(content);

    const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'));

    expect(html).toContain('<div class="doc-photo" style="text-align:center">');
    expect(html).not.toContain('<span data-font-size="12"');
    expect(html).not.toContain('{{residentPhoto}}');
  });

  it('<p> sem text-align → bloco sem style de alinhamento (default à esquerda)', async () => {
    const service = makePhotoService('<p>{{residentPhoto}}</p>');

    const html = await service.renderForResident('tpl-1', residentWith(null));

    expect(html).toContain('<div class="doc-photo">');
    expect(html).not.toContain('style="text-align');
  });

  it('ocorrência inline no meio do parágrafo → fallback, nunca token cru no papel', async () => {
    const service = makePhotoService('<p style="text-align: center">Foto: {{residentPhoto}} fim</p>');

    const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'));

    // inline → bloco sem style de alinhamento, texto ao redor preservado
    expect(html).toContain('<div class="doc-photo">');
    expect(html).not.toContain('{{residentPhoto}}');
    expect(html).toContain('Foto:');
    expect(html).toContain('fim');
  });

  it('N ocorrências → um bloco por token', async () => {
    const service = makePhotoService('<p>{{residentPhoto}}</p><p>x {{residentPhoto}} y</p>');

    const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'));

    expect(html.match(/<div class="doc-photo"/g)).toHaveLength(2);
    expect(html).not.toContain('{{residentPhoto}}');
  });

  it('template sem o token → nenhum bloco de foto no corpo', async () => {
    const service = makePhotoService('<p>Só o nome: {{name}}</p>');

    const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'));

    // o CSS `.doc-photo-*` sempre existe no <style>; checamos a div real do bloco
    expect(html).not.toContain('<div class="doc-photo"');
    expect(html).toContain('Só o nome: Ana');
  });

  it('acolhido sem foto NÃO impede o render (a foto nunca bloqueia a geração)', async () => {
    const service = makePhotoService('<p>{{name}}</p>{{residentPhoto}}');

    await expect(
      service.renderForResident('tpl-1', residentWith(null)),
    ).resolves.toContain('doc-photo-placeholder');
  });

  it('CSS: quadrado fixo de 151px com object-fit:cover, moldura do mesmo tamanho', async () => {
    const service = makePhotoService('<p>oi</p>');

    const html = await service.renderForResident('tpl-1', residentWith(null));

    expect(html).toContain(
      '.doc-photo-img{width:151px;height:151px;object-fit:cover;display:inline-block;vertical-align:top}',
    );
    expect(html).toContain('.doc-photo-placeholder{width:151px;height:151px;');
  });

  // Regressão da extração do replaceBlockToken: as DUAS variáveis de bloco
  // convivem no mesmo template sem uma comer a outra.
  it('{{signature}} e {{residentPhoto}} no mesmo template saem os dois blocos', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'tpl-1',
        name: 'Termo',
        content: '<p style="text-align: center">{{residentPhoto}}</p><p>{{signature}}</p>',
      }),
    });
    const staffRepo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ name: 'João Silva', signatureUrl: null }),
    });
    const service = makeService(
      repo,
      makeRepo({ findOne: jest.fn().mockResolvedValue(null) }),
      makeSigningStorage(),
      staffRepo,
    );

    const html = await service.renderForResident('tpl-1', residentWith('https://s3/residents/ana.jpg'), 'user-1');

    expect(html).toContain('<div class="doc-photo" style="text-align:center">');
    expect(html).toContain('<div class="doc-signature">');
    expect(html).toContain('João Silva');
    expect(html).toContain('_'.repeat(25));
    expect(html).not.toContain('{{residentPhoto}}');
    expect(html).not.toContain('{{signature}}');
  });
});

// ─── Disponibilidade por status do filho (story 160) ─────────────────────────
//
// A tela esconde o card, mas quem VETA é o service: ele é o choke point dos três
// caminhos de geração (render, PDF e PDF combinado) e a URL direta continuaria
// gerando o documento oculto sem esta guarda.

describe('DocumentTemplateService — disponibilidade por status (story 160)', () => {
  const MESSAGE = 'Este documento não está disponível para o status atual do acolhido';

  function makeAvailabilityService(availableFor?: TemplateAvailability) {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'tpl-1',
        name: 'Declaração de alta',
        content: '<p>{{name}}</p>',
        availableFor,
      }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
    const page = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('PDFDATA')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const browser = { newPage: jest.fn().mockResolvedValue(page) };
    (service as any).browserPromise = Promise.resolve(browser);
    return { service, browser, page };
  }

  function residentWithStatus(status: ResidentStatus): Resident {
    return { id: 'res-1', name: 'João Silva', status } as Resident;
  }

  describe('renderForResident', () => {
    it('ACTIVE_ONLY + filho em alta → BadRequest com a mensagem definida', async () => {
      const { service } = makeAvailabilityService(TemplateAvailability.ACTIVE_ONLY);
      const promise = service.renderForResident('tpl-1', residentWithStatus(ResidentStatus.DISCHARGED));
      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(MESSAGE);
    });

    it('ACTIVE_ONLY + filho ativo → renderiza normalmente', async () => {
      const { service } = makeAvailabilityService(TemplateAvailability.ACTIVE_ONLY);
      const html = await service.renderForResident('tpl-1', residentWithStatus(ResidentStatus.ACTIVE));
      expect(html).toContain('João Silva');
    });

    // Regressão da decisão 3: PRE_ADMISSION está do lado ATIVO, então um
    // documento de desligamento não pode ser gerado para quem acabou de chegar.
    it('INACTIVE_ONLY + filho em PRE_ADMISSION → recusa', async () => {
      const { service } = makeAvailabilityService(TemplateAvailability.INACTIVE_ONLY);
      await expect(
        service.renderForResident('tpl-1', residentWithStatus(ResidentStatus.PRE_ADMISSION)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('INACTIVE_ONLY + filho evadido → renderiza normalmente', async () => {
      const { service } = makeAvailabilityService(TemplateAvailability.INACTIVE_ONLY);
      const html = await service.renderForResident('tpl-1', residentWithStatus(ResidentStatus.EVADED));
      expect(html).toContain('João Silva');
    });

    it.each(Object.values(ResidentStatus))('ALL nunca recusa — status %s', async (status) => {
      const { service } = makeAvailabilityService(TemplateAvailability.ALL);
      await expect(service.renderForResident('tpl-1', residentWithStatus(status))).resolves.toContain('João Silva');
    });

    it('template legado (sem availableFor) nunca recusa', async () => {
      const { service } = makeAvailabilityService(undefined);
      await expect(
        service.renderForResident('tpl-1', residentWithStatus(ResidentStatus.ARCHIVED)),
      ).resolves.toContain('João Silva');
    });
  });

  describe('generatePdf', () => {
    it('ACTIVE_ONLY + filho em alta → BadRequest sem abrir página do browser', async () => {
      const { service, browser } = makeAvailabilityService(TemplateAvailability.ACTIVE_ONLY);
      await expect(
        service.generatePdf('tpl-1', residentWithStatus(ResidentStatus.DISCHARGED)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(browser.newPage).not.toHaveBeenCalled();
    });

    it('ACTIVE_ONLY + filho ativo → gera o PDF', async () => {
      const { service, browser } = makeAvailabilityService(TemplateAvailability.ACTIVE_ONLY);
      const result = await service.generatePdf('tpl-1', residentWithStatus(ResidentStatus.DISCIPLINE));
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(browser.newPage).toHaveBeenCalled();
    });
  });

  describe('generateCombinedPdf', () => {
    // Um incompatível no MEIO da lista reprova a requisição inteira: nada de PDF
    // parcial silencioso (decisão 7 do desenho).
    function makeCombined(templates: Record<string, { name: string; content: string; availableFor?: TemplateAvailability }>) {
      const repo = makeRepo({
        findOne: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          const found = templates[where.id];
          return Promise.resolve(found ? { id: where.id, ...found } : null);
        }),
      });
      const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));
      const page = {
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(Buffer.from('PDFDATA')),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const browser = { newPage: jest.fn().mockResolvedValue(page) };
      (service as any).browserPromise = Promise.resolve(browser);
      return { service, browser, page };
    }

    it('um template incompatível no meio da lista reprova TUDO, sem gerar PDF parcial', async () => {
      const { service, browser } = makeCombined({
        'tpl-a': { name: 'Ficha', content: '<p>A</p>' },
        'tpl-b': { name: 'Declaração de alta', content: '<p>B</p>', availableFor: TemplateAvailability.INACTIVE_ONLY },
        'tpl-c': { name: 'Contrato', content: '<p>C</p>' },
      });

      await expect(
        service.generateCombinedPdf(['tpl-a', 'tpl-b', 'tpl-c'], residentWithStatus(ResidentStatus.ACTIVE)),
      ).rejects.toThrow(MESSAGE);
      // Nenhuma página aberta: a validação acontece antes de qualquer render.
      expect(browser.newPage).not.toHaveBeenCalled();
    });

    it('todos compatíveis → gera o combinado normalmente', async () => {
      const { service, page } = makeCombined({
        'tpl-a': { name: 'Ficha', content: '<p>DOC-A</p>', availableFor: TemplateAvailability.ACTIVE_ONLY },
        'tpl-b': { name: 'Contrato', content: '<p>DOC-B</p>', availableFor: TemplateAvailability.ALL },
      });
      const pdf = await PDFDocument.create();
      pdf.addPage([595.28, 841.89]);
      page.pdf.mockResolvedValue(Buffer.from(await pdf.save()));

      const result = await service.generateCombinedPdf(
        ['tpl-a', 'tpl-b'],
        residentWithStatus(ResidentStatus.TEMP_LEAVE),
      );

      expect(result.filename).toBe('joao-silva-documentos.pdf');
      expect(page.setContent).toHaveBeenCalledTimes(2);
    });
  });
});

describe('DocumentTemplateService — validação do availableFor (story 160)', () => {
  it('create sem o campo grava ALL', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.create('Termo', '<p>x</p>');
    expect(repo.create.mock.calls[0][0]).toMatchObject({ availableFor: TemplateAvailability.ALL });
  });

  it('create persiste o valor recebido', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.create('Termo', '<p>x</p>', false, false, TemplateAvailability.INACTIVE_ONLY);
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      availableFor: TemplateAvailability.INACTIVE_ONLY,
    });
  });

  it('create com valor fora do enum → BadRequest, sem tocar o banco', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await expect(
      service.create('Termo', '<p>x</p>', false, false, 'SO_OS_LOIROS'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('update com valor fora do enum → BadRequest, sem tocar o banco', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '' }),
    });
    const service = makeService(repo);
    await expect(
      service.update('tpl-1', { availableFor: 'TALVEZ' as TemplateAvailability }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update com valor válido persiste', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '' }),
    });
    const service = makeService(repo);
    await service.update('tpl-1', { availableFor: TemplateAvailability.ACTIVE_ONLY });
    expect(repo.update.mock.calls[0][1]).toEqual({ availableFor: TemplateAvailability.ACTIVE_ONLY });
  });
});
