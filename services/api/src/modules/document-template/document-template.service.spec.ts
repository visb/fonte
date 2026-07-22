import { ConflictException, NotFoundException } from '@nestjs/common';
import { DOCUMENT_PRINT_CSS, A4_PAGE_WIDTH_PX } from '@fonte/doc-styles';
import { Repository } from 'typeorm';
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
