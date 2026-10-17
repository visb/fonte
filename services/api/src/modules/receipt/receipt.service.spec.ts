import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  ChargeStatus,
  FamilyInvestment,
  PaymentMethod,
  ReceivableStatus,
  ReceiptSubjectType,
  ReceiptType,
} from '@fonte/types';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import { DocumentTemplateService } from '../document-template/document-template.service';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';
import { IssuedReceipt } from './issued-receipt.entity';
import { ReceiptService } from './receipt.service';

// ─── Banco em memória do `issued_receipts` ───────────────────────────────────
// A alocação do número é o coração da story (decisões 3 e 5): sequência por tipo
// e idempotência por sujeito. Um fake com a mesma semântica prova as duas sem
// precisar de Postgres — o advisory lock é conferido à parte.

function makeFakeDataSource(rows: IssuedReceipt[], lockSpy = jest.fn()) {
  const manager = {
    query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
      if (sql.includes('pg_advisory_xact_lock')) {
        lockSpy(params[0]);
        return Promise.resolve([]);
      }
      const type = params[0] as ReceiptType;
      const max = rows
        .filter((r) => r.receiptType === type)
        .reduce((acc, r) => Math.max(acc, r.number), 0);
      return Promise.resolve([{ max }]);
    }),
    findOne: jest.fn().mockImplementation((_entity, options: { where: Partial<IssuedReceipt> }) => {
      const { receiptType, subjectType, subjectId } = options.where;
      return Promise.resolve(
        rows.find(
          (r) =>
            r.receiptType === receiptType &&
            r.subjectType === subjectType &&
            r.subjectId === subjectId,
        ) ?? null,
      );
    }),
    create: jest.fn().mockImplementation((_entity, value: IssuedReceipt) => value),
    save: jest.fn().mockImplementation((value: IssuedReceipt) => {
      const saved = { ...value, id: value.id ?? `ir-${rows.length + 1}` };
      rows.push(saved);
      return Promise.resolve(saved);
    }),
  };
  return {
    dataSource: {
      transaction: (cb: (m: typeof manager) => unknown) => Promise.resolve(cb(manager)),
    } as unknown as DataSource,
    manager,
    lockSpy,
  };
}

const TEMPLATE = { id: 'tpl-r', name: 'Recibo', content: '<p>{{receiptNumber}}</p>' };

function makeService(options: {
  rows?: IssuedReceipt[];
  charge?: Partial<AssociateCharge> | null;
  associate?: Partial<Associate> | null;
  templateService?: Partial<DocumentTemplateService>;
  lockSpy?: jest.Mock;
}) {
  const rows = options.rows ?? [];
  const { dataSource, manager, lockSpy } = makeFakeDataSource(rows, options.lockSpy);
  const charge =
    options.charge === null
      ? null
      : ({
          id: 'chg-1',
          associateId: 'asc-1',
          grossAmount: 50,
          netAmount: 48,
          feeAmount: 2,
          status: ChargeStatus.PAID,
          dueDate: '2026-08-10',
          paidAt: new Date('2026-08-09T12:00:00.000Z'),
          ...options.charge,
        } as AssociateCharge);
  const associate =
    options.associate === null
      ? null
      : ({ id: 'asc-1', name: 'Maria Souza', ...options.associate } as Associate);

  const templateService = {
    findByReceiptType: jest.fn().mockResolvedValue(TEMPLATE),
    resolveSigner: jest.fn().mockResolvedValue(null),
    renderWithResolver: jest.fn().mockResolvedValue('<html>recibo</html>'),
    htmlToPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
    ...options.templateService,
  } as unknown as DocumentTemplateService;

  const service = new ReceiptService(
    { findOne: jest.fn().mockResolvedValue(rows[0] ?? null) } as unknown as Repository<IssuedReceipt>,
    { findOne: jest.fn().mockResolvedValue(charge) } as unknown as Repository<AssociateCharge>,
    { findOne: jest.fn().mockResolvedValue(associate) } as unknown as Repository<Associate>,
    templateService,
    dataSource,
  );
  return { service, rows, manager, lockSpy, templateService };
}

describe('ReceiptService.allocateNumber (decisões 3 e 5)', () => {
  it('primeira emissão do tipo aloca o número 1', async () => {
    const { service, rows } = makeService({});
    const issued = await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
    );
    expect(issued.number).toBe(1);
    expect(rows).toHaveLength(1);
  });

  it('segunda emissão da MESMA cobrança reusa o número e não insere linha nova', async () => {
    const { service, rows, manager } = makeService({});
    const first = await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
    );
    const second = await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
    );
    expect(second.number).toBe(first.number);
    expect(rows).toHaveLength(1);
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('cobrança diferente do mesmo tipo pega o próximo número', async () => {
    const { service } = makeService({});
    await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
    );
    const second = await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-2',
    );
    expect(second.number).toBe(2);
  });

  it('tipos diferentes têm sequências independentes (livros distintos)', async () => {
    const { service } = makeService({});
    await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
    );
    await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-2',
    );
    const pizza = await service.allocateNumber(
      ReceiptType.PIZZA_SALE,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'venda-1',
    );
    expect(pizza.number).toBe(1);
  });

  it('serializa a alocação com advisory lock POR TIPO (pizza não bloqueia contribuição)', async () => {
    const lockSpy = jest.fn();
    const { service } = makeService({ lockSpy });
    await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
    );
    expect(lockSpy).toHaveBeenCalledWith(ReceiptType.ASSOCIATE_CONTRIBUTION);
  });

  it('grava quem emitiu (auditoria do livro), ou null quando anônimo', async () => {
    const { service, rows } = makeService({});
    await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
      'user-9',
    );
    expect(rows[0].issuedByUserId).toBe('user-9');
  });
});

describe('ReceiptService.generateForAssociateCharge', () => {
  it('caminho feliz devolve buffer PDF e filename com o número do recibo', async () => {
    const { service, templateService } = makeService({});
    const result = await service.generateForAssociateCharge('chg-1', 'user-1');
    expect(result.filename).toBe('recibo-contribuicao-000001.pdf');
    expect(result.number).toBe(1);
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
    // Renderiza pelo motor compartilhado (mesma impressora do documento do filho).
    expect(templateService.renderWithResolver).toHaveBeenCalled();
    expect(templateService.htmlToPdf).toHaveBeenCalledWith('<html>recibo</html>');
  });

  it('assina o recibo com o usuário que baixou', async () => {
    const { service, templateService } = makeService({});
    await service.generateForAssociateCharge('chg-1', 'user-7');
    expect(templateService.resolveSigner).toHaveBeenCalledWith('user-7');
  });

  it.each([ChargeStatus.PENDING, ChargeStatus.FAILED])(
    'cobrança %s → 400 (recibo só sai de cobrança paga)',
    async (status) => {
      const { service } = makeService({ charge: { status } });
      await expect(service.generateForAssociateCharge('chg-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('cobrança não paga não queima número da sequência', async () => {
    const { service, rows } = makeService({ charge: { status: ChargeStatus.PENDING } });
    await expect(service.generateForAssociateCharge('chg-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rows).toHaveLength(0);
  });

  it('cobrança inexistente → 404', async () => {
    const { service } = makeService({ charge: null });
    await expect(service.generateForAssociateCharge('chg-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('associado ausente → 404 (recibo sem pagador não é recibo)', async () => {
    const { service } = makeService({ associate: null });
    await expect(service.generateForAssociateCharge('chg-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('template do tipo não cadastrado → 404 com a mensagem acionável, ANTES de tocar a cobrança', async () => {
    const { service } = makeService({
      templateService: {
        findByReceiptType: jest.fn().mockRejectedValue(
          new NotFoundException(
            'Nenhum template de recibo cadastrado para contribuição mensal do associado. Cadastre em Configurações → Templates.',
          ),
        ),
      },
    });
    await expect(service.generateForAssociateCharge('chg-1')).rejects.toThrow(
      'Cadastre em Configurações → Templates.',
    );
  });

  // Decisão 4 — o PDF é artefato descartável. Se um dia alguém plugar upload
  // aqui, este teste é o que reclama: o service não conhece storage nenhum.
  it('não persiste o PDF em lugar nenhum (nem bucket, nem anexo do filho)', async () => {
    const { service } = makeService({});
    const result = await service.generateForAssociateCharge('chg-1');
    expect(result).toEqual(
      expect.objectContaining({ buffer: expect.any(Buffer), filename: expect.any(String) }),
    );
    expect(result).not.toHaveProperty('fileUrl');
  });

  it('baixar duas vezes a mesma cobrança devolve o mesmo filename (mesmo número)', async () => {
    const { service } = makeService({});
    const first = await service.generateForAssociateCharge('chg-1');
    const second = await service.generateForAssociateCharge('chg-1');
    expect(second.filename).toBe(first.filename);
  });
});

// ─── Recibo da contribuição do ACOLHIDO (story 193) ───────────────────────────
// Mesmo fake de `issued_receipts` do recibo do associado: é a prova de que o
// tipo novo entrou como DADO, no mesmo livro e no mesmo mecanismo de alocação.

const RECEIVABLE: Partial<ResidentReceivable> = {
  id: 'rcv-1',
  residentId: 'res-1',
  referenceMonth: '2026-08-01' as never,
  dueDate: '2026-08-10' as never,
  amount: 500,
  familyInvestment: FamilyInvestment.BASKET_500,
  paidAmount: 480,
  paidFamilyInvestment: null,
  status: ReceivableStatus.PAID,
  paidAt: '2026-08-09' as never,
  paymentMethod: PaymentMethod.PIX,
};

function makeResidentService(options: {
  rows?: IssuedReceipt[];
  receivable?: Partial<ResidentReceivable> | null;
  resident?: Partial<Resident> | null;
  responsible?: Partial<Relative> | null;
  /** Vínculos do familiar do `scope` (decisão 10). */
  relativesOfUser?: Partial<Relative>[];
  templateService?: Partial<DocumentTemplateService>;
} = {}) {
  const rows = options.rows ?? [];
  const { dataSource } = makeFakeDataSource(rows);

  const receivable =
    options.receivable === null ? null : ({ ...RECEIVABLE, ...options.receivable } as ResidentReceivable);
  const resident =
    options.resident === null
      ? null
      : ({ id: 'res-1', name: 'Pedro Acolhido', house: { name: 'Casa Betel' }, ...options.resident } as Resident);
  const responsible =
    options.responsible === undefined
      ? ({ id: 'rel-1', name: 'Maria Mãe', relationship: 'Mãe', residentId: 'res-1' } as Relative)
      : (options.responsible as Relative | null);

  const templateService = {
    findByReceiptType: jest.fn().mockResolvedValue(TEMPLATE),
    resolveSigner: jest.fn().mockResolvedValue(null),
    renderWithResolver: jest.fn().mockResolvedValue('<html>recibo</html>'),
    htmlToPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
    ...options.templateService,
  } as unknown as DocumentTemplateService;

  const receivableRepo = { findOne: jest.fn().mockResolvedValue(receivable) };
  const residentRepo = { findOne: jest.fn().mockResolvedValue(resident) };
  const relativeRepo = {
    findOne: jest.fn().mockResolvedValue(responsible),
    find: jest.fn().mockResolvedValue(options.relativesOfUser ?? []),
  };

  const service = new ReceiptService(
    { findOne: jest.fn().mockResolvedValue(null) } as unknown as Repository<IssuedReceipt>,
    { findOne: jest.fn().mockResolvedValue(null) } as unknown as Repository<AssociateCharge>,
    { findOne: jest.fn().mockResolvedValue(null) } as unknown as Repository<Associate>,
    templateService,
    dataSource,
    receivableRepo as unknown as Repository<ResidentReceivable>,
    residentRepo as unknown as Repository<Resident>,
    relativeRepo as unknown as Repository<Relative>,
  );
  return { service, rows, templateService, receivableRepo, residentRepo, relativeRepo };
}

describe('ReceiptService.generateForResidentReceivable', () => {
  it('caminho feliz devolve buffer PDF, o número e filename recibo-{filho}-{MM}-{AAAA} (story 212)', async () => {
    const { service, templateService } = makeResidentService();
    const result = await service.generateForResidentReceivable('rcv-1', 'user-1');

    expect(result.filename).toBe('recibo-pedro-acolhido-08-2026.pdf');
    expect(result.number).toBe(1);
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(templateService.renderWithResolver).toHaveBeenCalled();
    expect(templateService.htmlToPdf).toHaveBeenCalledWith('<html>recibo</html>');
  });

  it('procura o template do tipo do ACOLHIDO (livro próprio, não o do associado)', async () => {
    const { service, templateService } = makeResidentService();
    await service.generateForResidentReceivable('rcv-1');
    expect(templateService.findByReceiptType).toHaveBeenCalledWith(
      ReceiptType.RESIDENT_CONTRIBUTION,
      'contribuição mensal do acolhido',
    );
  });

  it('assina o recibo com o usuário que baixou', async () => {
    const { service, templateService } = makeResidentService();
    await service.generateForResidentReceivable('rcv-1', 'user-7');
    expect(templateService.resolveSigner).toHaveBeenCalledWith('user-7');
  });

  it.each([ReceivableStatus.PENDING, ReceivableStatus.CANCELED])(
    'parcela %s → 400 (recibo só sai de parcela paga)',
    async (status) => {
      const { service, rows } = makeResidentService({ receivable: { status } });
      await expect(service.generateForResidentReceivable('rcv-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // …e não queima número da sequência.
      expect(rows).toHaveLength(0);
    },
  );

  // `findOne` do TypeORM já exclui soft-deleted: a parcela apagada é
  // indistinguível de inexistente, e as duas respondem 404.
  it('parcela inexistente ou soft-deleted → 404', async () => {
    const { service } = makeResidentService({ receivable: null });
    await expect(service.generateForResidentReceivable('rcv-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('acolhido ausente → 404 (recibo sem acolhido não é recibo)', async () => {
    const { service } = makeResidentService({ resident: null });
    await expect(service.generateForResidentReceivable('rcv-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('template do tipo não cadastrado → 404 com a mensagem acionável', async () => {
    const { service } = makeResidentService({
      templateService: {
        findByReceiptType: jest.fn().mockRejectedValue(
          new NotFoundException(
            'Nenhum template de recibo cadastrado para contribuição mensal do acolhido. Cadastre em Configurações → Templates.',
          ),
        ),
      },
    });
    await expect(service.generateForResidentReceivable('rcv-1')).rejects.toThrow(
      'Cadastre em Configurações → Templates.',
    );
  });

  // Story 212, decisão 6 — a competência manda, não o pagamento nem o número.
  it('filename usa o nome do filho e a COMPETÊNCIA: "João da Silva" + 2026-10 → recibo-joao-da-silva-10-2026.pdf', async () => {
    const { service } = makeResidentService({
      resident: { name: 'João da Silva' },
      receivable: { referenceMonth: '2026-10-01' as never, paidAt: '2026-11-05' as never },
    });
    const result = await service.generateForResidentReceivable('rcv-1');
    expect(result.filename).toBe('recibo-joao-da-silva-10-2026.pdf');
  });

  // Story 212, decisão 7 — o `code` é só do template ausente.
  it('parcela inexistente continua 404 SEM o code de template ausente', async () => {
    const { service } = makeResidentService({ receivable: null });
    const error = await service.generateForResidentReceivable('rcv-x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).not.toHaveProperty('code');
  });

  // Decisão 9 — dois responsáveis (dado legado do import) não podem fazer o
  // mesmo recibo sair diferente amanhã: o mais ANTIGO, sempre.
  it('escolhe o responsável de forma determinística (o mais antigo por created_at)', async () => {
    const { service, relativeRepo } = makeResidentService();
    await service.generateForResidentReceivable('rcv-1');
    expect(relativeRepo.findOne).toHaveBeenCalledWith({
      where: { residentId: 'res-1', isResponsible: true },
      order: { createdAt: 'ASC' },
    });
  });

  it('filho sem responsável cadastrado ainda emite o recibo (sem exceção)', async () => {
    const { service } = makeResidentService({ responsible: null });
    await expect(service.generateForResidentReceivable('rcv-1')).resolves.toEqual(
      expect.objectContaining({ number: 1 }),
    );
  });

  it('não persiste o PDF em lugar nenhum (nem bucket, nem anexo do filho)', async () => {
    const { service } = makeResidentService();
    const result = await service.generateForResidentReceivable('rcv-1');
    expect(result).not.toHaveProperty('fileUrl');
  });
});

describe('ReceiptService.findBySubject', () => {
  it('consulta o registro do recibo pelo trio (tipo, tipo de sujeito, sujeito)', async () => {
    const issuedRepo = { findOne: jest.fn().mockResolvedValue({ number: 7 }) };
    const service = new ReceiptService(
      issuedRepo as unknown as Repository<IssuedReceipt>,
      { findOne: jest.fn() } as unknown as Repository<AssociateCharge>,
      { findOne: jest.fn() } as unknown as Repository<Associate>,
      {} as unknown as DocumentTemplateService,
      makeFakeDataSource([]).dataSource,
    );

    await expect(
      service.findBySubject(
        ReceiptType.RESIDENT_CONTRIBUTION,
        ReceiptSubjectType.RESIDENT_RECEIVABLE,
        'rcv-1',
      ),
    ).resolves.toEqual({ number: 7 });
    expect(issuedRepo.findOne).toHaveBeenCalledWith({
      where: {
        receiptType: ReceiptType.RESIDENT_CONTRIBUTION,
        subjectType: ReceiptSubjectType.RESIDENT_RECEIVABLE,
        subjectId: 'rcv-1',
      },
    });
  });
});

describe('generateForResidentReceivable — escopo do familiar (decisão 10)', () => {
  it('parcela do PRÓPRIO filho → emite normalmente', async () => {
    const { service } = makeResidentService({
      relativesOfUser: [{ id: 'rel-1', residentId: 'res-1' }],
    });
    const result = await service.generateForResidentReceivable('rcv-1', 'u-fam', {
      relativeUserId: 'u-fam',
    });
    expect(result.number).toBe(1);
  });

  it('parcela de OUTRO filho → 404 (nunca 403: 403 confirmaria que ela existe)', async () => {
    const { service } = makeResidentService({
      relativesOfUser: [{ id: 'rel-2', residentId: 'res-OUTRO' }],
    });
    await expect(
      service.generateForResidentReceivable('rcv-1', 'u-fam', { relativeUserId: 'u-fam' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a tentativa negada NÃO cria linha em issued_receipts (escopo antes da alocação)', async () => {
    const { service, rows } = makeResidentService({
      relativesOfUser: [{ id: 'rel-2', residentId: 'res-OUTRO' }],
    });
    await expect(
      service.generateForResidentReceivable('rcv-1', 'u-fam', { relativeUserId: 'u-fam' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rows).toHaveLength(0);
  });

  it('usuário sem nenhum vínculo de familiar → 404', async () => {
    const { service } = makeResidentService({ relativesOfUser: [] });
    await expect(
      service.generateForResidentReceivable('rcv-1', 'u-x', { relativeUserId: 'u-x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sem escopo (ADMIN/COORDINATOR pelo adm.fonte) não consulta vínculo nenhum', async () => {
    const { service, relativeRepo } = makeResidentService();
    await service.generateForResidentReceivable('rcv-1', 'user-1');
    expect(relativeRepo.find).not.toHaveBeenCalled();
  });
});

describe('numeração do recibo do acolhido (livro próprio)', () => {
  it('primeira emissão do tipo é 1; a MESMA parcela reusa o número', async () => {
    const { service, rows } = makeResidentService();
    const first = await service.generateForResidentReceivable('rcv-1');
    const second = await service.generateForResidentReceivable('rcv-1');
    expect(first.number).toBe(1);
    expect(second.number).toBe(1);
    expect(second.filename).toBe(first.filename);
    expect(rows).toHaveLength(1);
  });

  it('parcela diferente pega o próximo número', async () => {
    const rows: IssuedReceipt[] = [];
    const { service } = makeResidentService({ rows });
    await service.generateForResidentReceivable('rcv-1');
    // O sujeito é a PARCELA: outro id, outro número.
    const second = await service.allocateNumber(
      ReceiptType.RESIDENT_CONTRIBUTION,
      ReceiptSubjectType.RESIDENT_RECEIVABLE,
      'rcv-2',
    );
    expect(second.number).toBe(2);
  });

  it('a sequência é INDEPENDENTE da do associado (1, 2, 3 em cada livro)', async () => {
    const rows: IssuedReceipt[] = [];
    const { service } = makeResidentService({ rows });
    await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-1',
    );
    await service.allocateNumber(
      ReceiptType.ASSOCIATE_CONTRIBUTION,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      'chg-2',
    );
    const doFilho = await service.generateForResidentReceivable('rcv-1');
    expect(doFilho.number).toBe(1);
  });

  // Decisão 8 — reabrir não devolve número ao estoque: enquanto PENDING a
  // emissão dá 400, e ao repagar o MESMO número volta (o sujeito é o mesmo).
  it('reabrir e repagar devolve o MESMO número, com a linha preservada', async () => {
    const rows: IssuedReceipt[] = [];
    const paid = makeResidentService({ rows });
    const emitido = await paid.service.generateForResidentReceivable('rcv-1');
    expect(emitido.number).toBe(1);

    const reaberto = makeResidentService({ rows, receivable: { status: ReceivableStatus.PENDING } });
    await expect(reaberto.service.generateForResidentReceivable('rcv-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rows).toHaveLength(1);

    const repago = makeResidentService({ rows });
    const denovo = await repago.service.generateForResidentReceivable('rcv-1');
    expect(denovo.number).toBe(1);
    expect(rows).toHaveLength(1);
  });
});
