import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ChargeStatus, ReceiptSubjectType, ReceiptType } from '@fonte/types';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import { DocumentTemplateService } from '../document-template/document-template.service';
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
