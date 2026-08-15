import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ChargeStatus,
  ReceiptSubjectType,
  ReceiptType,
  RECEIPT_TYPE_LABELS,
} from '@fonte/types';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import { DocumentTemplateService } from '../document-template/document-template.service';
import {
  slugify,
  type DocumentVariableResolver,
} from '../document-template/document-variables';
import { IssuedReceipt } from './issued-receipt.entity';
import {
  AssociateContributionReceiptResolver,
  formatReceiptNumber,
} from './associate-contribution-receipt.resolver';

/** Prefixo do nome do arquivo baixado, por tipo de recibo. */
const RECEIPT_FILENAME_PREFIX: Record<ReceiptType, string> = {
  [ReceiptType.ASSOCIATE_CONTRIBUTION]: 'recibo contribuicao',
  [ReceiptType.PIZZA_SALE]: 'recibo pizza',
  [ReceiptType.BREAD_SALE]: 'recibo pao',
};

export interface GeneratedReceipt {
  buffer: Buffer;
  filename: string;
  number: number;
}

/**
 * Story 178 — emissão de recibo.
 *
 * O PDF é gerado sob demanda e NUNCA persistido (decisão 4): nada vai para o
 * bucket, nada entra em `resident_documents` nem em `resident_attachments`. É a
 * garantia estrutural — e não cosmética — de que recibo não vaza para a aba de
 * anexos do filho.
 *
 * O que persiste é o REGISTRO da emissão (`issued_receipts`), pela numeração
 * sequencial por tipo (decisão 3). Trade-off aceito (decisão 6): como o PDF é
 * re-renderizado pelo template ATUAL, editar o template muda o layout de um
 * recibo já emitido — o que precisa ser estável (o número e os valores da
 * `associate_charges`, imutável depois de PAID) já é estável.
 */
@Injectable()
export class ReceiptService {
  constructor(
    @InjectRepository(IssuedReceipt)
    private readonly issuedRepo: Repository<IssuedReceipt>,
    @InjectRepository(AssociateCharge)
    private readonly chargeRepo: Repository<AssociateCharge>,
    @InjectRepository(Associate)
    private readonly associateRepo: Repository<Associate>,
    private readonly documentTemplateService: DocumentTemplateService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Recibo da contribuição mensal de uma cobrança. Único tipo com resolver nesta
   * story; pizza e pão entram como irmãos deste método.
   */
  async generateForAssociateCharge(
    chargeId: string,
    issuedByUserId?: string,
  ): Promise<GeneratedReceipt> {
    const receiptType = ReceiptType.ASSOCIATE_CONTRIBUTION;
    // 1. O template do tipo (decisão 2: o gerador ACHA, ninguém escolhe). Sem
    //    template cadastrado, a mensagem é acionável — quem lê é o operador.
    const template = await this.documentTemplateService.findByReceiptType(
      receiptType,
      RECEIPT_TYPE_LABELS[receiptType].toLowerCase(),
    );

    // 2. O sujeito: cobrança existente e PAGA.
    const charge = await this.chargeRepo.findOne({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException('Cobrança não encontrada');
    if (charge.status !== ChargeStatus.PAID) {
      throw new BadRequestException('Recibo só é emitido para cobrança paga');
    }
    const associate = await this.associateRepo.findOne({ where: { id: charge.associateId } });
    if (!associate) throw new NotFoundException('Associado não encontrado');

    // 3. Aloca (ou recupera) o número.
    const issued = await this.allocateNumber(
      receiptType,
      ReceiptSubjectType.ASSOCIATE_CHARGE,
      chargeId,
      issuedByUserId,
    );

    // 4. Renderiza pelo motor compartilhado — o que muda é o dicionário, não a
    //    impressora.
    const signer = await this.documentTemplateService.resolveSigner(issuedByUserId);
    const resolver: DocumentVariableResolver = new AssociateContributionReceiptResolver({
      charge,
      associate,
      number: issued.number,
      signer,
    });
    const html = await this.documentTemplateService.renderWithResolver(template, resolver);
    const buffer = await this.documentTemplateService.htmlToPdf(html);
    const filename = `${slugify(
      `${RECEIPT_FILENAME_PREFIX[receiptType]} ${formatReceiptNumber(issued.number)}`,
    )}.pdf`;
    return { buffer, filename, number: issued.number };
  }

  /**
   * Aloca o próximo número do tipo — ou recupera o já alocado para o mesmo
   * sujeito (decisão 5: baixar duas vezes não queima dois números).
   *
   * O `pg_advisory_xact_lock(hashtext(tipo))` serializa só a alocação DAQUELE
   * tipo: dois downloads simultâneos da mesma cobrança não geram dois números, e
   * pizza não bloqueia contribuição. Sequence nativa do Postgres não serve: o
   * tipo é DADO, e uma sequence por tipo exigiria DDL a cada tipo novo.
   */
  async allocateNumber(
    receiptType: ReceiptType,
    subjectType: ReceiptSubjectType,
    subjectId: string,
    issuedByUserId?: string,
  ): Promise<IssuedReceipt> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [receiptType]);
      const existing = await manager.findOne(IssuedReceipt, {
        where: { receiptType, subjectType, subjectId },
      });
      if (existing) return existing;
      const rows = await manager.query(
        'SELECT COALESCE(MAX(number), 0) AS max FROM issued_receipts WHERE receipt_type = $1',
        [receiptType],
      );
      const max = Number(rows?.[0]?.max ?? 0);
      return manager.save(
        manager.create(IssuedReceipt, {
          receiptType,
          number: max + 1,
          subjectType,
          subjectId,
          issuedByUserId: issuedByUserId ?? null,
        }),
      );
    });
  }

  /** Recibos já emitidos de um tipo (usado só por teste/inspeção hoje). */
  findBySubject(
    receiptType: ReceiptType,
    subjectType: ReceiptSubjectType,
    subjectId: string,
  ): Promise<IssuedReceipt | null> {
    return this.issuedRepo.findOne({ where: { receiptType, subjectType, subjectId } });
  }
}
