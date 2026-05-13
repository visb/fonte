import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Role, WishlistStatus } from '@fonte/types';
import { WishlistItem } from './wishlist-item.entity';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private itemRepository: Repository<WishlistItem>,
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
    @InjectRepository(Relative)
    private relativeRepository: Repository<Relative>,
  ) {}

  async findAll(residentId: string): Promise<WishlistItem[]> {
    return this.itemRepository.find({
      where: { residentId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  async findAllForCaller(callerUserId: string, callerRole: string, residentId: string): Promise<WishlistItem[]> {
    if (callerRole === Role.RELATIVE) {
      const relative = await this.relativeRepository.findOne({ where: { userId: callerUserId } });
      if (!relative || relative.residentId !== residentId) throw new ForbiddenException();
      return this.findApproved(residentId);
    }
    return this.findAll(residentId);
  }

  async findApproved(residentId: string): Promise<WishlistItem[]> {
    return this.itemRepository.find({
      where: { residentId, status: WishlistStatus.APPROVED, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  async findPending(): Promise<(WishlistItem & { residentName: string })[]> {
    const items = await this.itemRepository.find({
      where: { status: WishlistStatus.PENDING_APPROVAL, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    const residentIds = [...new Set(items.map((i) => i.residentId))];
    const residents = await this.residentRepository.findByIds(residentIds);
    const nameMap = new Map(residents.map((r) => [r.id, r.name]));
    return items.map((i) => Object.assign(Object.create(Object.getPrototypeOf(i)), i, { residentName: nameMap.get(i.residentId) ?? '' }));
  }

  async addItem(callerUserId: string, residentId: string, dto: AddWishlistItemDto): Promise<WishlistItem> {
    const resident = await this.residentRepository.findOne({ where: { userId: callerUserId } });
    if (!resident || resident.id !== residentId) throw new ForbiddenException();

    const item = this.itemRepository.create({
      residentId,
      description: dto.description,
      quantity: dto.quantity ?? 1,
      status: WishlistStatus.PENDING_APPROVAL,
      createdByUserId: callerUserId,
    });
    return this.itemRepository.save(item);
  }

  async requestRemoval(callerUserId: string, residentId: string, itemId: string): Promise<void> {
    const resident = await this.residentRepository.findOne({ where: { userId: callerUserId } });
    if (!resident || resident.id !== residentId) throw new ForbiddenException();

    const item = await this.itemRepository.findOne({ where: { id: itemId, residentId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    await this.itemRepository.update(itemId, {
      isRemovalRequested: true,
      status: WishlistStatus.PENDING_APPROVAL,
    });
  }

  async approve(staffUserId: string, itemId: string): Promise<WishlistItem> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    if (item.isRemovalRequested) {
      await this.itemRepository.softDelete(itemId);
      return { ...item, deletedAt: new Date() } as WishlistItem;
    }

    await this.itemRepository.update(itemId, {
      status: WishlistStatus.APPROVED,
      approvedByUserId: staffUserId,
      approvedAt: new Date(),
    });
    return this.itemRepository.findOne({ where: { id: itemId } }) as Promise<WishlistItem>;
  }

  async reject(staffUserId: string, itemId: string, reason?: string): Promise<WishlistItem> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    const updates: Partial<WishlistItem> = {
      status: WishlistStatus.REJECTED,
      approvedByUserId: staffUserId,
      approvedAt: new Date(),
      isRemovalRequested: false,
      rejectionReason: reason ?? null,
    };
    await this.itemRepository.update(itemId, updates);
    return this.itemRepository.findOne({ where: { id: itemId } }) as Promise<WishlistItem>;
  }
}
