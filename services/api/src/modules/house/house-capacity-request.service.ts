import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HouseCapacityRequestStatus,
  NotificationType,
  Role,
} from '@fonte/types';
import { House } from './house.entity';
import { HouseCapacityRequest } from './house-capacity-request.entity';
import { Staff } from '../staff/staff.entity';
import { CreateCapacityRequestDto } from './dto/create-capacity-request.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class HouseCapacityRequestService {
  private readonly logger = new Logger(HouseCapacityRequestService.name);

  constructor(
    @InjectRepository(HouseCapacityRequest)
    private readonly repo: Repository<HouseCapacityRequest>,
    @InjectRepository(House)
    private readonly houseRepo: Repository<House>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * COORDINATOR pede alteração de capacidade. Não aplica na casa; gera pedido
   * PENDING e notifica o ADMIN. Novo pedido supersede o PENDING anterior.
   */
  async createRequest(
    houseId: string,
    dto: CreateCapacityRequestDto,
    requesterUserId: string,
  ): Promise<HouseCapacityRequest> {
    const house = await this.houseRepo.findOne({ where: { id: houseId } });
    if (!house) throw new NotFoundException(`House ${houseId} not found`);

    const staff = await this.staffRepo.findOne({
      where: { userId: requesterUserId },
    });
    if (!staff) throw new ForbiddenException('Apenas staff pode solicitar alteração');
    // O coordenador só altera a capacidade da própria casa.
    const ownsHouse = staff.houseId === houseId || house.coordinatorId === staff.id;
    if (!ownsHouse) {
      throw new ForbiddenException(
        'Apenas o coordenador da casa pode solicitar alteração de capacidade',
      );
    }

    // Supersede o PENDING anterior (mantém no histórico).
    await this.repo.update(
      { houseId, status: HouseCapacityRequestStatus.PENDING },
      { status: HouseCapacityRequestStatus.SUPERSEDED },
    );

    const request = await this.repo.save(
      this.repo.create({
        houseId,
        requestedGeneralCapacity: dto.generalCapacity,
        requestedStaffCapacity: dto.staffCapacity,
        previousGeneralCapacity: house.generalCapacity,
        previousStaffCapacity: house.staffCapacity,
        status: HouseCapacityRequestStatus.PENDING,
        requestedById: staff.id,
      }),
    );

    await this.notifySafely(() =>
      this.notifications.create({
        type: NotificationType.CAPACITY_CHANGE_REQUESTED,
        title: `Alteração de leitos — ${house.name}`,
        body: `${staff.name} solicitou ${dto.generalCapacity} leitos para filhos e ${dto.staffCapacity} para servos.`,
        recipientRole: Role.ADMIN,
        houseId: null,
        link: `/houses/${houseId}`,
        metadata: {
          requestId: request.id,
          houseId,
          houseName: house.name,
          requestedGeneralCapacity: dto.generalCapacity,
          requestedStaffCapacity: dto.staffCapacity,
          previousGeneralCapacity: house.generalCapacity,
          previousStaffCapacity: house.staffCapacity,
          requestedByName: staff.name,
        },
      }),
    );

    return request;
  }

  /** Um pedido específico (com quem pediu), para refletir o estado atual. */
  async getById(requestId: string): Promise<HouseCapacityRequest> {
    const request = await this.repo.findOne({
      where: { id: requestId },
      relations: ['requestedBy'],
    });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    return request;
  }

  /** Histórico de pedidos da casa (todos os status), mais recentes primeiro. */
  async listForHouse(houseId: string): Promise<HouseCapacityRequest[]> {
    await this.assertHouseExists(houseId);
    return this.repo.find({
      where: { houseId },
      relations: ['requestedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /** ADMIN aprova: aplica a capacidade na casa e notifica a casa. */
  async approve(
    requestId: string,
    adminUserId: string,
  ): Promise<HouseCapacityRequest> {
    const request = await this.getPending(requestId);

    await this.houseRepo.update(request.houseId, {
      generalCapacity: request.requestedGeneralCapacity,
      staffCapacity: request.requestedStaffCapacity,
    });

    request.status = HouseCapacityRequestStatus.APPROVED;
    request.reviewedById = adminUserId;
    request.reviewedAt = new Date();
    const saved = await this.repo.save(request);

    const house = await this.houseRepo.findOne({ where: { id: request.houseId } });
    await this.notifySafely(() =>
      this.notifications.create({
        type: NotificationType.CAPACITY_CHANGE_APPROVED,
        title: `Alteração de leitos aprovada — ${house?.name ?? ''}`.trim(),
        body: `Nova capacidade: ${request.requestedGeneralCapacity} leitos para filhos e ${request.requestedStaffCapacity} para servos.`,
        houseId: request.houseId,
        recipientRole: null,
        metadata: { requestId: request.id, houseId: request.houseId },
      }),
    );

    return saved;
  }

  /** ADMIN rejeita: não altera a casa, apenas registra e notifica a casa. */
  async reject(
    requestId: string,
    adminUserId: string,
  ): Promise<HouseCapacityRequest> {
    const request = await this.getPending(requestId);

    request.status = HouseCapacityRequestStatus.REJECTED;
    request.reviewedById = adminUserId;
    request.reviewedAt = new Date();
    const saved = await this.repo.save(request);

    const house = await this.houseRepo.findOne({ where: { id: request.houseId } });
    await this.notifySafely(() =>
      this.notifications.create({
        type: NotificationType.CAPACITY_CHANGE_REJECTED,
        title: `Alteração de leitos rejeitada — ${house?.name ?? ''}`.trim(),
        body: `O pedido de ${request.requestedGeneralCapacity}/${request.requestedStaffCapacity} leitos foi rejeitado pelo ADM.`,
        houseId: request.houseId,
        recipientRole: null,
        metadata: { requestId: request.id, houseId: request.houseId },
      }),
    );

    return saved;
  }

  private async getPending(requestId: string): Promise<HouseCapacityRequest> {
    const request = await this.repo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Request ${requestId} not found`);
    if (request.status !== HouseCapacityRequestStatus.PENDING) {
      throw new ConflictException('Pedido já foi resolvido');
    }
    return request;
  }

  private async assertHouseExists(houseId: string): Promise<void> {
    const count = await this.houseRepo.count({ where: { id: houseId } });
    if (!count) throw new NotFoundException(`House ${houseId} not found`);
  }

  /** Emissão best-effort: falha ao notificar não quebra a ação principal. */
  private async notifySafely(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.warn(
        `Falha ao emitir notificação: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
