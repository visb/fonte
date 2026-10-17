import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ChargeStatus,
  ReceivableStatus,
  ReceiptSubjectType,
  ReceiptType,
  RECEIPT_TYPE_LABELS,
  residentReceiptFilename,
} from '@fonte/types';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import { DocumentTemplateService } from '../document-template/document-template.service';
import {
  slugify,
  type DocumentVariableResolver,
} from '../document-template/document-variables';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';
import { IssuedReceipt } from './issued-receipt.entity';
import {
  AssociateContributionReceiptResolver,
  formatReceiptNumber,
} from './associate-contribution-receipt.resolver';
import { ResidentContributionReceiptResolver } from './resident-contribution-receipt.resolver';

/**
 * Prefixo do nome do arquivo baixado, por tipo de recibo.
 *
 * `Record<ReceiptType, string>` de propósito (story 178): tipo novo sem entrada
 * aqui QUEBRA O BUILD, em vez de sair um arquivo `undefined-000123.pdf`.
 *
 * Story 212 — o recibo do ACOLHIDO não usa mais este prefixo: o arquivo sai
 * como `recibo-{filho}-{MM}-{AAAA}.pdf` (`residentReceiptFilename`). A entrada
 * fica porque o `Record` exige todos os tipos.
 */
const RECEIPT_FILENAME_PREFIX: Record<ReceiptType, string> = {
  [ReceiptType.ASSOCIATE_CONTRIBUTION]: 'recibo contribuicao',
  [ReceiptType.RESIDENT_CONTRIBUTION]: 'recibo contribuicao acolhido',
  [ReceiptType.PIZZA_SALE]: 'recibo pizza',
  [ReceiptType.BREAD_SALE]: 'recibo pao',
};

export interface GeneratedReceipt {
  buffer: Buffer;
  filename: string;
  number: number;
}

/**
 * Story 193, decisão 10 — escopo do familiar. Quando presente, a parcela tem que
 * ser do filho DAQUELE familiar; divergiu, é 404 (e não 403: 403 confirmaria que
 * a parcela existe). A checagem roda ANTES da alocação do número.
 */
export interface ResidentReceivableReceiptScope {
  relativeUserId: string;
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
    // Story 193 — repositórios do recibo do acolhido. Injetados DEPOIS dos da
    // 178 de propósito: a ordem dos parâmetros anteriores é contrato dos specs
    // existentes, e um tipo novo de recibo não pode obrigar a reescrevê-los.
    @InjectRepository(ResidentReceivable)
    private readonly receivableRepo?: Repository<ResidentReceivable>,
    @InjectRepository(Resident)
    private readonly residentRepo?: Repository<Resident>,
    @InjectRepository(Relative)
    private readonly relativeRepo?: Repository<Relative>,
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
   * Story 193 — recibo da contribuição mensal do ACOLHIDO (uma parcela do carnê).
   *
   * Irmão do `generateForAssociateCharge`, mesma ordem de passos e mesmo motor.
   * O único passo a mais é o escopo do familiar (decisão 10), que roda ANTES da
   * alocação: tentativa negada não pode queimar número da sequência.
   *
   * `scope` ausente = chamada de ADMIN/COORDINATOR pelo `adm.fonte`.
   */
  async generateForResidentReceivable(
    receivableId: string,
    issuedByUserId?: string,
    scope?: ResidentReceivableReceiptScope,
  ): Promise<GeneratedReceipt> {
    const receiptType = ReceiptType.RESIDENT_CONTRIBUTION;
    // 1. O template do tipo (decisão 2 da 178: o gerador ACHA, ninguém escolhe).
    const template = await this.documentTemplateService.findByReceiptType(
      receiptType,
      RECEIPT_TYPE_LABELS[receiptType].toLowerCase(),
    );

    // 2. O sujeito: parcela existente (soft delete já sai fora do findOne) e PAGA.
    const receivable = await this.receivableRepo!.findOne({ where: { id: receivableId } });
    if (!receivable) throw new NotFoundException('Parcela não encontrada');
    if (receivable.status !== ReceivableStatus.PAID) {
      throw new BadRequestException('Recibo só é emitido para parcela paga');
    }

    // 3. Escopo do familiar (decisão 10) — ANTES do passo 5. Parcela de outro
    //    filho responde 404, não 403: 403 confirmaria que a parcela existe.
    if (scope) {
      const relatives = await this.relativeRepo!.find({
        where: { userId: scope.relativeUserId },
      });
      const inScope = relatives.some((r) => r.residentId === receivable.residentId);
      if (!inScope) throw new NotFoundException('Parcela não encontrada');
    }

    const resident = await this.residentRepo!.findOne({
      where: { id: receivable.residentId },
      relations: ['house'],
    });
    if (!resident) throw new NotFoundException('Acolhido não encontrado');

    // Decisão 9 — responsável determinístico: `is_responsible`, o mais ANTIGO
    // quando houver mais de um (dado legado do import). Nenhum → o resolver cai
    // para o nome do filho, sem exceção: recibo de dinheiro já recebido não pode
    // falhar por cadastro incompleto.
    const responsible = await this.relativeRepo!.findOne({
      where: { residentId: receivable.residentId, isResponsible: true },
      order: { createdAt: 'ASC' },
    });

    // 4. Aloca (ou recupera) o número — mesmo advisory lock por tipo, método
    //    INALTERADO: o sujeito é a parcela, e `ux_issued_receipts_subject` já dá
    //    de graça o "um número por parcela".
    const issued = await this.allocateNumber(
      receiptType,
      ReceiptSubjectType.RESIDENT_RECEIVABLE,
      receivableId,
      issuedByUserId,
    );

    // 5. Mesma impressora do documento do filho e do recibo do associado.
    const signer = await this.documentTemplateService.resolveSigner(issuedByUserId);
    const resolver: DocumentVariableResolver = new ResidentContributionReceiptResolver({
      receivable,
      resident,
      responsible: responsible ?? null,
      houseName: resident.house?.name ?? '',
      number: issued.number,
      signer,
    });
    const html = await this.documentTemplateService.renderWithResolver(template, resolver);
    const buffer = await this.documentTemplateService.htmlToPdf(html);
    // Story 212, decisão 6 — `recibo-{filho}-{MM}-{AAAA}.pdf` pela competência.
    // O número sai do nome do arquivo, mas continua impresso no PDF.
    const filename = residentReceiptFilename(resident.name, receivable.referenceMonth);
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
