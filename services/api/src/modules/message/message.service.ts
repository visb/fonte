import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageStatus, ProfileType, Role } from '@fonte/types';
import { Message } from './message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { User } from '../user/user.entity';

export interface MessageView {
  id: string;
  residentId: string | null;
  relativeId: string;
  staffId: string | null;
  senderUserId: string;
  senderName: string;
  content: string;
  status: MessageStatus;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export interface ConversationView {
  residentId: string;
  residentName: string;
  relativeId: string;
  relativeName: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  pendingCount: number;
}

export interface DirectConversationView {
  staffId: string;
  staffName: string;
  relativeId: string;
  relativeName: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

export interface StaffThreadView {
  staffId: string;
  staffName: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
    @InjectRepository(Relative)
    private relativeRepository: Repository<Relative>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private toView(msg: Message & { senderName?: string }): MessageView {
    return {
      id: msg.id,
      residentId: msg.residentId,
      relativeId: msg.relativeId,
      staffId: msg.staffId,
      senderUserId: msg.senderUserId,
      senderName: msg.senderName ?? '',
      content: msg.content,
      status: msg.status,
      approvedByUserId: msg.approvedByUserId,
      approvedAt: msg.approvedAt,
      createdAt: msg.createdAt,
    };
  }

  async getConversations(staffUserId: string): Promise<ConversationView[]> {
    const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
    if (!staff || !staff.houseId) return [];

    const residents = await this.residentRepository.find({ where: { houseId: staff.houseId } });
    const residentIds = residents.map((r) => r.id);
    if (!residentIds.length) return [];

    const relatives = await this.relativeRepository.find({
      where: residentIds.map((id) => ({ residentId: id })),
    });

    const conversations: ConversationView[] = [];
    for (const relative of relatives) {
      const messages = await this.messageRepository.find({
        where: { residentId: relative.residentId, relativeId: relative.id },
        order: { createdAt: 'DESC' },
        take: 1,
      });
      const lastMsg = messages[0] ?? null;
      const pendingCount = await this.messageRepository.count({
        where: { residentId: relative.residentId, relativeId: relative.id, status: MessageStatus.PENDING_APPROVAL },
      });
      const resident = residents.find((r) => r.id === relative.residentId);
      conversations.push({
        residentId: relative.residentId,
        residentName: resident?.name ?? '',
        relativeId: relative.id,
        relativeName: relative.name,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ?? null,
        pendingCount,
      });
    }
    return conversations;
  }

  async getMyConversations(userId: string, role: string): Promise<ConversationView[]> {
    if (role === Role.RELATIVE) {
      const relative = await this.relativeRepository.findOne({
        where: { userId },
        relations: ['resident'],
      });
      if (!relative) throw new NotFoundException('Perfil de familiar não encontrado');

      const lastMsg = await this.messageRepository.findOne({
        where: { residentId: relative.residentId, relativeId: relative.id, status: MessageStatus.APPROVED },
        order: { createdAt: 'DESC' },
      });
      return [
        {
          residentId: relative.residentId,
          residentName: relative.resident?.name ?? '',
          relativeId: relative.id,
          relativeName: relative.name,
          lastMessage: lastMsg?.content ?? null,
          lastMessageAt: lastMsg?.createdAt ?? null,
          pendingCount: 0,
        },
      ];
    }

    // RESIDENT
    const resident = await this.residentRepository.findOne({ where: { userId } });
    if (!resident) throw new NotFoundException('Perfil de interno não encontrado');

    const relatives = await this.relativeRepository.find({ where: { residentId: resident.id } });
    const conversations: ConversationView[] = [];

    for (const relative of relatives) {
      const lastMsg = await this.messageRepository.findOne({
        where: { residentId: resident.id, relativeId: relative.id, status: MessageStatus.APPROVED },
        order: { createdAt: 'DESC' },
      });
      conversations.push({
        residentId: resident.id,
        residentName: resident.name,
        relativeId: relative.id,
        relativeName: relative.name,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ?? null,
        pendingCount: 0,
      });
    }
    return conversations;
  }

  async getThread(
    callerUserId: string,
    callerRole: string,
    residentId: string,
    relativeId: string,
  ): Promise<MessageView[]> {
    let messages: Message[];

    if (callerRole === Role.RESIDENT) {
      const resident = await this.residentRepository.findOne({ where: { userId: callerUserId } });
      if (!resident || resident.id !== residentId) throw new ForbiddenException();
      messages = await this.messageRepository.find({
        where: { residentId, relativeId },
        order: { createdAt: 'ASC' },
      });
      messages = messages.filter(
        (m) => m.status === MessageStatus.APPROVED || m.senderUserId === callerUserId,
      );
    } else if (callerRole === Role.RELATIVE) {
      const relative = await this.relativeRepository.findOne({ where: { userId: callerUserId } });
      if (!relative || relative.id !== relativeId) throw new ForbiddenException();
      messages = await this.messageRepository.find({
        where: { residentId, relativeId },
        order: { createdAt: 'ASC' },
      });
      messages = messages.filter(
        (m) => m.status === MessageStatus.APPROVED || m.senderUserId === callerUserId,
      );
    } else {
      messages = await this.messageRepository.find({
        where: { residentId, relativeId },
        order: { createdAt: 'ASC' },
      });
    }

    const userIds = [...new Set(messages.map((m) => m.senderUserId))];
    const users = await this.userRepository.findByIds(userIds);
    const staffList = await this.staffRepository.find({ where: userIds.map((id) => ({ userId: id })) });
    const residents = await this.residentRepository.find({ where: userIds.map((id) => ({ userId: id })) });
    const relativesList = await this.relativeRepository.find({ where: userIds.map((id) => ({ userId: id })) });

    const nameMap = new Map<string, string>();
    for (const u of users) {
      const staffMatch = staffList.find((s) => s.userId === u.id);
      const residentMatch = residents.find((r) => r.userId === u.id);
      const relativeMatch = relativesList.find((r) => r.userId === u.id);
      nameMap.set(u.id, staffMatch?.name ?? residentMatch?.name ?? relativeMatch?.name ?? u.email);
    }

    return messages.map((m) => this.toView({ ...m, senderName: nameMap.get(m.senderUserId) }));
  }

  async getPending(staffUserId: string): Promise<MessageView[]> {
    const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
    if (!staff || !staff.houseId) return [];

    const residents = await this.residentRepository.find({ where: { houseId: staff.houseId } });
    const residentIds = residents.map((r) => r.id);
    if (!residentIds.length) return [];

    const messages = await this.messageRepository.find({
      where: residentIds.map((id) => ({ residentId: id, status: MessageStatus.PENDING_APPROVAL })),
      order: { createdAt: 'ASC' },
    });

    const userIds = [...new Set(messages.map((m) => m.senderUserId))];
    const residentList = await this.residentRepository.find({ where: userIds.map((id) => ({ userId: id })) });
    const relativeList = await this.relativeRepository.find({ where: userIds.map((id) => ({ userId: id })) });
    const nameMap = new Map<string, string>();
    for (const r of residentList) {
      if (r.userId) nameMap.set(r.userId, r.name);
    }
    for (const r of relativeList) {
      if (r.userId) nameMap.set(r.userId, r.name);
    }

    return messages.map((m) => this.toView({ ...m, senderName: nameMap.get(m.senderUserId) ?? '' }));
  }

  async send(senderUserId: string, profileType: string, dto: SendMessageDto): Promise<MessageView> {
    const isResident = profileType === ProfileType.RESIDENT;
    const isRelative = profileType === ProfileType.RELATIVE;

    if (isResident) {
      const resident = await this.residentRepository.findOne({ where: { userId: senderUserId } });
      if (!resident || resident.id !== dto.residentId) throw new ForbiddenException();
    }

    if (isRelative) {
      const relative = await this.relativeRepository.findOne({ where: { userId: senderUserId } });
      if (!relative || relative.id !== dto.relativeId || relative.residentId !== dto.residentId) {
        throw new ForbiddenException();
      }
    }

    const relative = await this.relativeRepository.findOne({ where: { id: dto.relativeId } });
    if (!relative || relative.residentId !== dto.residentId) throw new NotFoundException('Familiar não encontrado');

    const status = (isResident || isRelative) ? MessageStatus.PENDING_APPROVAL : MessageStatus.APPROVED;
    const message = this.messageRepository.create({
      residentId: dto.residentId,
      relativeId: dto.relativeId,
      senderUserId,
      content: dto.content,
      status,
    });
    const saved = await this.messageRepository.save(message);
    return this.toView(saved);
  }

  async getHouseStaffThreads(relativeUserId: string): Promise<StaffThreadView[]> {
    const relative = await this.relativeRepository.findOne({ where: { userId: relativeUserId } });
    if (!relative) throw new NotFoundException('Familiar não encontrado');

    const resident = await this.residentRepository.findOne({ where: { id: relative.residentId } });
    if (!resident || !resident.houseId) return [];

    const staffList = await this.staffRepository.find({ where: { houseId: resident.houseId } });

    const result: StaffThreadView[] = [];
    for (const s of staffList) {
      const lastMsg = await this.messageRepository.findOne({
        where: { staffId: s.id, relativeId: relative.id },
        order: { createdAt: 'DESC' },
      });
      result.push({
        staffId: s.id,
        staffName: s.name,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ?? null,
      });
    }
    return result;
  }

  async getDirectConversations(staffUserId: string): Promise<DirectConversationView[]> {
    const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
    if (!staff || !staff.houseId) return [];

    const rawRows = await this.messageRepository
      .createQueryBuilder('m')
      .select('m.relativeId', 'relativeId')
      .where('m.staffId = :staffId', { staffId: staff.id })
      .groupBy('m.relativeId')
      .getRawMany<{ relativeId: string }>();

    const result: DirectConversationView[] = [];
    for (const { relativeId } of rawRows) {
      const relative = await this.relativeRepository.findOne({ where: { id: relativeId } });
      if (!relative) continue;
      const lastMsg = await this.messageRepository.findOne({
        where: { staffId: staff.id, relativeId },
        order: { createdAt: 'DESC' },
      });
      result.push({
        staffId: staff.id,
        staffName: staff.name,
        relativeId,
        relativeName: relative.name,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ?? null,
      });
    }
    return result;
  }

  async getDirectThread(
    callerUserId: string,
    callerRole: string,
    staffId: string,
    relativeId: string,
  ): Promise<MessageView[]> {
    if (callerRole === Role.RELATIVE) {
      const relative = await this.relativeRepository.findOne({ where: { userId: callerUserId } });
      if (!relative || relative.id !== relativeId) throw new ForbiddenException();
    } else {
      const staff = await this.staffRepository.findOne({ where: { userId: callerUserId } });
      if (!staff || staff.id !== staffId) throw new ForbiddenException();
    }

    const messages = await this.messageRepository.find({
      where: { staffId, relativeId },
      order: { createdAt: 'ASC' },
    });

    const userIds = [...new Set(messages.map((m) => m.senderUserId))];
    if (!userIds.length) return [];

    const staffList = await this.staffRepository.find({ where: userIds.map((id) => ({ userId: id })) });
    const relativesList = await this.relativeRepository.find({ where: userIds.map((id) => ({ userId: id })) });

    const nameMap = new Map<string, string>();
    for (const s of staffList) nameMap.set(s.userId, s.name);
    for (const r of relativesList) { if (r.userId) nameMap.set(r.userId, r.name); }

    return messages.map((m) => this.toView({ ...m, senderName: nameMap.get(m.senderUserId) ?? '' }));
  }

  async sendDirect(senderUserId: string, profileType: string, dto: SendDirectMessageDto): Promise<MessageView> {
    if (profileType === ProfileType.RELATIVE) {
      const relative = await this.relativeRepository.findOne({ where: { userId: senderUserId } });
      if (!relative || relative.id !== dto.relativeId) throw new ForbiddenException();

      const resident = await this.residentRepository.findOne({ where: { id: relative.residentId } });
      if (!resident) throw new ForbiddenException();

      const staff = await this.staffRepository.findOne({ where: { id: dto.staffId, houseId: resident.houseId } });
      if (!staff) throw new ForbiddenException('Servo não pertence à mesma casa');
    } else {
      const staff = await this.staffRepository.findOne({ where: { userId: senderUserId } });
      if (!staff || staff.id !== dto.staffId || !staff.houseId) throw new ForbiddenException();

      const relative = await this.relativeRepository.findOne({ where: { id: dto.relativeId } });
      if (!relative) throw new NotFoundException('Familiar não encontrado');

      const resident = await this.residentRepository.findOne({ where: { id: relative.residentId } });
      if (!resident || resident.houseId !== staff.houseId) throw new ForbiddenException('Familiar não pertence à mesma casa');
    }

    const message = this.messageRepository.create({
      staffId: dto.staffId,
      relativeId: dto.relativeId,
      residentId: null,
      senderUserId,
      content: dto.content,
      status: MessageStatus.APPROVED,
    });
    const saved = await this.messageRepository.save(message);
    return this.toView(saved);
  }

  async approve(staffUserId: string, messageId: string): Promise<MessageView> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Mensagem não encontrada');

    await this.messageRepository.update(messageId, {
      status: MessageStatus.APPROVED,
      approvedByUserId: staffUserId,
      approvedAt: new Date(),
    });
    return this.toView({ ...message, status: MessageStatus.APPROVED, approvedByUserId: staffUserId, approvedAt: new Date() });
  }

  async reject(staffUserId: string, messageId: string): Promise<MessageView> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Mensagem não encontrada');

    await this.messageRepository.update(messageId, {
      status: MessageStatus.REJECTED,
      approvedByUserId: staffUserId,
      approvedAt: new Date(),
    });
    return this.toView({ ...message, status: MessageStatus.REJECTED, approvedByUserId: staffUserId, approvedAt: new Date() });
  }
}
