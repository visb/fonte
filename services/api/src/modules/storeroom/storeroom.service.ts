import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovementType } from '@fonte/types';
import { StoreroomItem } from './storeroom.entity';
import { StoreroomMovement } from './storeroom-movement.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class StoreroomService {
  constructor(
    @InjectRepository(StoreroomItem)
    private itemRepo: Repository<StoreroomItem>,
    @InjectRepository(StoreroomMovement)
    private movementRepo: Repository<StoreroomMovement>,
  ) {}

  findItems(houseId?: string): Promise<StoreroomItem[]> {
    return this.itemRepo.find({
      where: houseId ? { houseId } : {},
      order: { name: 'ASC' },
    });
  }

  async findItem(id: string): Promise<StoreroomItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Storeroom item ${id} not found`);
    return item;
  }

  createItem(dto: CreateItemDto): Promise<StoreroomItem> {
    return this.itemRepo.save(this.itemRepo.create(dto));
  }

  async updateItem(id: string, dto: UpdateItemDto): Promise<StoreroomItem> {
    await this.findItem(id);
    await this.itemRepo.update(id, dto);
    return this.findItem(id);
  }

  async removeItem(id: string): Promise<void> {
    await this.findItem(id);
    await this.itemRepo.softDelete(id);
  }

  findMovements(houseId?: string, itemId?: string): Promise<StoreroomMovement[]> {
    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.item', 'item')
      .leftJoinAndSelect('m.responsible', 'responsible')
      .orderBy('m.date', 'DESC')
      .addOrderBy('m.createdAt', 'DESC');

    if (itemId) qb.andWhere('m.item_id = :itemId', { itemId });
    if (houseId) qb.andWhere('item.house_id = :houseId', { houseId });

    return qb.getMany();
  }

  async createMovement(dto: CreateMovementDto): Promise<StoreroomMovement> {
    const item = await this.findItem(dto.itemId);

    const newQty =
      dto.type === MovementType.IN
        ? Number(item.currentQuantity) + dto.quantity
        : Number(item.currentQuantity) - dto.quantity;

    if (newQty < 0) {
      throw new BadRequestException('Insufficient stock for this movement');
    }

    await this.itemRepo.update(item.id, { currentQuantity: newQty });
    return this.movementRepo.save(this.movementRepo.create(dto));
  }
}
