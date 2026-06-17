import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payable as PayableDto,
  PayableStatus,
  PayablesSummary,
} from '@fonte/types';
import { Payable } from './payable.entity';
import { CreatePayableDto } from './dto/create-payable.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { ListPayablesDto } from './dto/list-payables.dto';
import { PayablesSummaryDto } from './dto/payables-summary.dto';
import { PayPayableDto } from './dto/pay-payable.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PayableService {
  constructor(
    @InjectRepository(Payable)
    private repo: Repository<Payable>,
    private storageService: StorageService,
  ) {}

  /** 'YYYY-MM-DD' de hoje (data local, sem fuso). */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** "Vencida" é derivada, nunca persistida: OPEN && due_date < hoje. */
  private isOverdue(p: Payable, today = this.today()): boolean {
    return p.status === PayableStatus.OPEN && p.dueDate < today;
  }

  async create(dto: CreatePayableDto, createdBy: string | null): Promise<PayableDto> {
    const payable = this.repo.create({
      description: dto.description,
      amount: dto.amount,
      dueDate: dto.dueDate,
      category: dto.category,
      supplier: dto.supplier ?? null,
      notes: dto.notes ?? null,
      status: PayableStatus.OPEN,
      paidAt: null,
      createdBy,
    });
    const saved = await this.repo.save(payable);
    return this.toView(saved);
  }

  async findAll(filters: ListPayablesDto): Promise<PayableDto[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .orderBy('p.due_date', 'ASC')
      .addOrderBy('p.created_at', 'DESC');

    if (filters.status) qb.andWhere('p.status = :status', { status: filters.status });
    if (filters.category) qb.andWhere('p.category = :category', { category: filters.category });
    if (filters.from) qb.andWhere('p.due_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('p.due_date <= :to', { to: filters.to });

    const items = await qb.getMany();
    const today = this.today();
    return items.map((p) => this.toView(p, today));
  }

  async getSummary(filters: PayablesSummaryDto): Promise<PayablesSummary> {
    const qb = this.repo.createQueryBuilder('p');
    if (filters.from) qb.andWhere('p.due_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('p.due_date <= :to', { to: filters.to });

    const items = await qb.getMany();
    const today = this.today();

    const summary: PayablesSummary = {
      totalOpen: 0,
      totalPaid: 0,
      totalOverdue: 0,
      countOpen: 0,
      countPaid: 0,
      countOverdue: 0,
    };

    for (const p of items) {
      if (p.status === PayableStatus.PAID) {
        summary.totalPaid += p.amount;
        summary.countPaid += 1;
      } else {
        summary.totalOpen += p.amount;
        summary.countOpen += 1;
        if (this.isOverdue(p, today)) {
          summary.totalOverdue += p.amount;
          summary.countOverdue += 1;
        }
      }
    }

    return summary;
  }

  async findOne(id: string): Promise<PayableDto> {
    const payable = await this.repo.findOne({ where: { id } });
    if (!payable) throw new NotFoundException('Payable not found');
    return this.toView(payable);
  }

  async update(id: string, dto: UpdatePayableDto): Promise<PayableDto> {
    const payable = await this.repo.findOne({ where: { id } });
    if (!payable) throw new NotFoundException('Payable not found');

    if (dto.description !== undefined) payable.description = dto.description;
    if (dto.amount !== undefined) payable.amount = dto.amount;
    if (dto.dueDate !== undefined) payable.dueDate = dto.dueDate;
    if (dto.category !== undefined) payable.category = dto.category;
    if (dto.supplier !== undefined) payable.supplier = dto.supplier ?? null;
    if (dto.notes !== undefined) payable.notes = dto.notes ?? null;

    const saved = await this.repo.save(payable);
    return this.toView(saved);
  }

  /** Transição OPEN → PAID (regra de negócio no service). */
  async pay(id: string, dto: PayPayableDto, file?: Express.Multer.File): Promise<PayableDto> {
    const payable = await this.repo.findOne({ where: { id } });
    if (!payable) throw new NotFoundException('Payable not found');
    if (payable.status === PayableStatus.PAID) {
      throw new BadRequestException('Payable is already paid');
    }

    payable.status = PayableStatus.PAID;
    payable.paidAt = dto.paidAt ?? this.today();

    if (file) {
      if (payable.paymentReceiptUrl) await this.storageService.delete(payable.paymentReceiptUrl);
      const originalName = this.storageService.decodeOriginalName(file.originalname);
      const filename = this.storageService.uniqueFilename(originalName, 'comprovante_');
      payable.paymentReceiptUrl = await this.storageService.upload(
        'payables',
        filename,
        file.buffer,
        file.mimetype,
      );
      payable.paymentReceiptName = originalName;
    }

    const saved = await this.repo.save(payable);
    return this.toView(saved);
  }

  async remove(id: string): Promise<void> {
    const payable = await this.repo.findOne({ where: { id } });
    if (!payable) throw new NotFoundException('Payable not found');
    if (payable.attachmentUrl) await this.storageService.delete(payable.attachmentUrl);
    if (payable.paymentReceiptUrl) await this.storageService.delete(payable.paymentReceiptUrl);
    await this.repo.softRemove(payable);
  }

  /** Anexa (ou substitui) o comprovante/boleto da conta. */
  async uploadAttachment(id: string, file: Express.Multer.File): Promise<PayableDto> {
    const payable = await this.repo.findOne({ where: { id } });
    if (!payable) throw new NotFoundException('Payable not found');

    if (payable.attachmentUrl) await this.storageService.delete(payable.attachmentUrl);

    const originalName = this.storageService.decodeOriginalName(file.originalname);
    const filename = this.storageService.uniqueFilename(originalName, 'conta_');
    payable.attachmentUrl = await this.storageService.upload(
      'payables',
      filename,
      file.buffer,
      file.mimetype,
    );
    payable.attachmentName = originalName;

    const saved = await this.repo.save(payable);
    return this.toView(saved);
  }

  async removeAttachment(id: string): Promise<PayableDto> {
    const payable = await this.repo.findOne({ where: { id } });
    if (!payable) throw new NotFoundException('Payable not found');

    if (payable.attachmentUrl) await this.storageService.delete(payable.attachmentUrl);
    payable.attachmentUrl = null;
    payable.attachmentName = null;

    const saved = await this.repo.save(payable);
    return this.toView(saved);
  }

  private toView(p: Payable, today = this.today()): PayableDto {
    return {
      id: p.id,
      description: p.description,
      amount: p.amount,
      dueDate: p.dueDate,
      category: p.category,
      supplier: p.supplier ?? null,
      status: p.status,
      paidAt: p.paidAt ?? null,
      notes: p.notes ?? null,
      attachmentUrl: p.attachmentUrl ?? null,
      attachmentName: p.attachmentName ?? null,
      paymentReceiptUrl: p.paymentReceiptUrl ?? null,
      paymentReceiptName: p.paymentReceiptName ?? null,
      overdue: this.isOverdue(p, today),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
