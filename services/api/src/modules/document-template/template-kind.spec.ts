import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReceiptType, TemplateAvailability, TemplateKind } from '@fonte/types';
import { DocumentTemplateService } from './document-template.service';
import { DocumentTemplate } from './document-template.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';
import { StorageService } from '../storage/storage.service';

// Story 178 — invariantes de `kind` × `receiptType`, filtro por kind e as três
// guardas de geração de documento de filho. Spec própria (e não mais 300 linhas
// no já enorme document-template.service.spec.ts) porque o assunto é outro: a
// spec antiga fala do documento do filho, esta fala da separação entre mundos.

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

function makeStorage(): StorageService {
  return {
    stripContentSignatures: (html: string) => html,
    signContentUrls: async (html: string) => html,
    extractBucketImageUrls: () => [],
    delete: async () => undefined,
  } as unknown as StorageService;
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  return new DocumentTemplateService(
    repo as unknown as Repository<DocumentTemplate>,
    makeRepo() as unknown as Repository<Relative>,
    makeRepo() as unknown as Repository<Staff>,
    makeStorage(),
  );
}

const RESIDENT = { id: 'res-1', name: 'João', status: 'ACTIVE' } as unknown as Resident;

describe('create — invariantes de kind (story 178)', () => {
  it('RECEIPT sem receiptType → 400, sem tocar o banco', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await expect(
      service.create('Recibo', '<p>x</p>', false, false, undefined, TemplateKind.RECEIPT),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('RECEIPT com receiptType fora do enum → 400', async () => {
    const service = makeService(makeRepo());
    await expect(
      service.create('Recibo', '<p>x</p>', false, false, undefined, TemplateKind.RECEIPT, 'RIFA'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('kind fora do enum → 400', async () => {
    const service = makeService(makeRepo());
    await expect(
      service.create('Recibo', '<p>x</p>', false, false, undefined, 'BOLETO'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('RESIDENT com receiptType → 400 (documento de filho não tem tipo de recibo)', async () => {
    const service = makeService(makeRepo());
    await expect(
      service.create(
        'Termo',
        '<p>x</p>',
        false,
        false,
        undefined,
        TemplateKind.RESIDENT,
        ReceiptType.ASSOCIATE_CONTRIBUTION,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('RECEIPT nasce com isRequired/signAtAdmission false e availableFor ALL, mesmo se o body mandar outra coisa', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.create(
      'Recibo de contribuição',
      '<p>{{amount}}</p>',
      true,
      true,
      TemplateAvailability.ACTIVE_ONLY,
      TemplateKind.RECEIPT,
      ReceiptType.ASSOCIATE_CONTRIBUTION,
    );
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      kind: TemplateKind.RECEIPT,
      receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
      isRequired: false,
      signAtAdmission: false,
      availableFor: TemplateAvailability.ALL,
    });
  });

  it('segundo template do mesmo receiptType → 409 (um template ativo por tipo)', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'outro', receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION }),
    });
    const service = makeService(repo);
    await expect(
      service.create(
        'Recibo 2',
        '<p>x</p>',
        false,
        false,
        undefined,
        TemplateKind.RECEIPT,
        ReceiptType.ASSOCIATE_CONTRIBUTION,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('sem kind o template nasce RESIDENT com receiptType nulo (nada muda para quem já existia)', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.create('Termo', '<p>x</p>');
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      kind: TemplateKind.RESIDENT,
      receiptType: null,
    });
  });
});

describe('update — invariantes de kind (story 178)', () => {
  it('promover a RECEIPT sem receiptType → 400', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '', kind: TemplateKind.RESIDENT }),
    });
    const service = makeService(repo);
    await expect(
      service.update('tpl-1', { kind: TemplateKind.RECEIPT }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('mudar o receiptType para um tipo já cadastrado em OUTRO template → 409', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        // findOne(id) do update
        .mockResolvedValueOnce({ id: 'tpl-1', name: 'Recibo', content: '', kind: TemplateKind.RECEIPT })
        // conflito de receiptType
        .mockResolvedValueOnce({ id: 'tpl-2', receiptType: ReceiptType.PIZZA_SALE }),
    });
    const service = makeService(repo);
    await expect(
      service.update('tpl-1', { receiptType: ReceiptType.PIZZA_SALE }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('o MESMO template mantendo o próprio receiptType não conflita consigo mesmo', async () => {
    const existing = {
      id: 'tpl-1',
      name: 'Recibo',
      content: '',
      kind: TemplateKind.RECEIPT,
      receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
    };
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue(existing),
    });
    const service = makeService(repo);
    await service.update('tpl-1', { receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION });
    expect(repo.update.mock.calls[0][1]).toMatchObject({
      kind: TemplateKind.RECEIPT,
      receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
      isRequired: false,
      signAtAdmission: false,
      availableFor: TemplateAvailability.ALL,
    });
  });

  it('update que não menciona kind nem receiptType não mexe em nenhum dos dois', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: '', kind: TemplateKind.RESIDENT }),
    });
    const service = makeService(repo);
    await service.update('tpl-1', { name: 'Outro nome' });
    expect(repo.update.mock.calls[0][1]).toEqual({ name: 'Outro nome' });
  });
});

describe('findAll — isolamento por kind (story 178, decisão 8)', () => {
  it('sem argumento filtra por RESIDENT (o consumidor de hoje não vê recibo)', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.findAll();
    expect(repo.find).toHaveBeenCalledWith({
      where: { kind: TemplateKind.RESIDENT },
      order: { name: 'ASC' },
    });
  });

  it('findAll("RECEIPT") devolve só recibos', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.findAll('RECEIPT');
    expect(repo.find).toHaveBeenCalledWith({
      where: { kind: TemplateKind.RECEIPT },
      order: { name: 'ASC' },
    });
  });

  it('kind inválido na query → 400 (não vira lista vazia silenciosa)', async () => {
    const service = makeService(makeRepo());
    await expect(service.findAll('QUALQUER')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('findByReceiptType (story 178)', () => {
  it('sem template cadastrado → 404 com mensagem acionável para o operador', async () => {
    const service = makeService(makeRepo());
    await expect(
      service.findByReceiptType(ReceiptType.ASSOCIATE_CONTRIBUTION, 'contribuição mensal'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findByReceiptType(ReceiptType.ASSOCIATE_CONTRIBUTION, 'contribuição mensal'),
    ).rejects.toThrow('Configurações → Templates');
  });

  it('acha o template pelo tipo (o operador não escolhe template ao emitir)', async () => {
    const template = { id: 'tpl-r', name: 'Recibo', content: '<p>x</p>' };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(template) });
    const service = makeService(repo);
    const found = await service.findByReceiptType(ReceiptType.ASSOCIATE_CONTRIBUTION, 'contribuição');
    expect(found).toMatchObject({ id: 'tpl-r' });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION, kind: TemplateKind.RECEIPT },
    });
  });
});

// Decisão 9 — sumir da tela não é regra: a URL direta continuaria gerando.
describe('guarda dos três caminhos de geração (story 178, decisão 9)', () => {
  function receiptRepo() {
    return makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'tpl-r',
        name: 'Recibo',
        content: '<p>x</p>',
        kind: TemplateKind.RECEIPT,
        receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
        availableFor: TemplateAvailability.ALL,
      }),
    });
  }

  it('renderForResident com template RECEIPT → 400', async () => {
    const service = makeService(receiptRepo());
    await expect(service.renderForResident('tpl-r', RESIDENT)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('generatePdf com template RECEIPT → 400, sem abrir o browser', async () => {
    const service = makeService(receiptRepo());
    const newPage = jest.fn();
    (service as unknown as { browserPromise: Promise<unknown> }).browserPromise =
      Promise.resolve({ newPage });
    await expect(service.generatePdf('tpl-r', RESIDENT)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(newPage).not.toHaveBeenCalled();
  });

  it('generateCombinedPdf reprova a requisição INTEIRA quando o recibo é um item no meio da lista', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'tpl-r'
            ? {
                id: 'tpl-r',
                name: 'Recibo',
                content: '<p>x</p>',
                kind: TemplateKind.RECEIPT,
                receiptType: ReceiptType.ASSOCIATE_CONTRIBUTION,
                availableFor: TemplateAvailability.ALL,
              }
            : {
                id: where.id,
                name: 'Termo',
                content: '<p>x</p>',
                kind: TemplateKind.RESIDENT,
                availableFor: TemplateAvailability.ALL,
              },
        ),
      ),
    });
    const service = makeService(repo);
    const newPage = jest.fn();
    (service as unknown as { browserPromise: Promise<unknown> }).browserPromise =
      Promise.resolve({ newPage });
    await expect(
      service.generateCombinedPdf(['tpl-a', 'tpl-r', 'tpl-b'], RESIDENT),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Nenhum PDF parcial: a validação da lista roda ANTES de qualquer render.
    expect(newPage).not.toHaveBeenCalled();
  });

  it('template RESIDENT (ou legado, sem kind) segue gerando normalmente', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({
        id: 'tpl-1',
        name: 'Termo',
        content: '<p>{{name}}</p>',
        availableFor: TemplateAvailability.ALL,
      }),
    });
    const service = makeService(repo);
    const html = await service.renderForResident('tpl-1', RESIDENT);
    expect(html).toContain('João');
  });
});
