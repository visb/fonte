import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  Associate as AssociateDto,
  AssociateCharge as AssociateChargeDto,
  AssociateDetail,
  AssociateListItem,
  AssociateStatus,
  AssociateSubscription as AssociateSubscriptionDto,
} from '@fonte/types';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';
import { CreateAssociateDto } from './dto/create-associate.dto';
import { UpdateAssociateDto } from './dto/update-associate.dto';

@Injectable()
export class AssociateService {
  constructor(
    @InjectRepository(Associate)
    private repo: Repository<Associate>,
    @InjectRepository(AssociateSubscription)
    private subscriptionRepo: Repository<AssociateSubscription>,
    @InjectRepository(AssociateCharge)
    private chargeRepo: Repository<AssociateCharge>,
  ) {}

  async create(dto: CreateAssociateDto): Promise<AssociateDto> {
    const associate = this.repo.create({
      name: dto.name,
      whatsapp: dto.whatsapp,
      email: dto.email ?? null,
      contributionAmount: dto.contributionAmount,
      dueDay: dto.dueDay,
      status: AssociateStatus.PENDING,
      paymentToken: randomUUID(),
    });
    const saved = await this.repo.save(associate);
    return this.toView(saved);
  }

  async findAll(): Promise<AssociateListItem[]> {
    const associates = await this.repo.find({ order: { createdAt: 'DESC' } });
    return Promise.all(
      associates.map(async (a) => {
        const lastCharge = await this.chargeRepo.findOne({
          where: { associateId: a.id },
          order: { createdAt: 'DESC' },
        });
        return {
          ...this.toView(a),
          lastCharge: lastCharge ? this.toChargeView(lastCharge) : null,
        };
      }),
    );
  }

  async findOne(id: string): Promise<AssociateDetail> {
    const associate = await this.repo.findOne({ where: { id } });
    if (!associate) throw new NotFoundException('Associate not found');

    const subscription = await this.subscriptionRepo.findOne({
      where: { associateId: id },
      order: { createdAt: 'DESC' },
    });
    const charges = await this.chargeRepo.find({
      where: { associateId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      ...this.toView(associate),
      subscription: subscription ? this.toSubscriptionView(subscription) : null,
      charges: charges.map((c) => this.toChargeView(c)),
    };
  }

  async update(id: string, dto: UpdateAssociateDto): Promise<AssociateDto> {
    const associate = await this.repo.findOne({ where: { id } });
    if (!associate) throw new NotFoundException('Associate not found');

    if (dto.name !== undefined) associate.name = dto.name;
    if (dto.whatsapp !== undefined) associate.whatsapp = dto.whatsapp;
    if (dto.email !== undefined) associate.email = dto.email ?? null;
    if (dto.contributionAmount !== undefined) associate.contributionAmount = dto.contributionAmount;
    if (dto.dueDay !== undefined) associate.dueDay = dto.dueDay;

    const saved = await this.repo.save(associate);
    return this.toView(saved);
  }

  async remove(id: string): Promise<void> {
    const associate = await this.repo.findOne({ where: { id } });
    if (!associate) throw new NotFoundException('Associate not found');
    await this.repo.softDelete(id);
  }

  private toView(a: Associate): AssociateDto {
    return {
      id: a.id,
      name: a.name,
      whatsapp: a.whatsapp,
      email: a.email,
      contributionAmount: Number(a.contributionAmount),
      dueDay: a.dueDay,
      status: a.status,
      abacatepayCustomerId: a.abacatepayCustomerId,
      paymentToken: a.paymentToken,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private toSubscriptionView(s: AssociateSubscription): AssociateSubscriptionDto {
    return {
      id: s.id,
      associateId: s.associateId,
      abacatepaySubscriptionId: s.abacatepaySubscriptionId,
      netAmount: Number(s.netAmount),
      feeAmount: Number(s.feeAmount),
      grossAmount: Number(s.grossAmount),
      status: s.status,
      startedAt: s.startedAt ? s.startedAt.toISOString() : null,
      canceledAt: s.canceledAt ? s.canceledAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private toChargeView(c: AssociateCharge): AssociateChargeDto {
    return {
      id: c.id,
      associateId: c.associateId,
      subscriptionId: c.subscriptionId,
      abacatepayChargeId: c.abacatepayChargeId,
      netAmount: Number(c.netAmount),
      feeAmount: Number(c.feeAmount),
      grossAmount: Number(c.grossAmount),
      status: c.status,
      dueDate: c.dueDate,
      paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
