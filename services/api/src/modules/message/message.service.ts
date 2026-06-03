import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { MessageStatus, ProfileType, Role, StaffPermissionType } from '@fonte/types';
import { Message } from './message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { StaffPermission } from '../staff/staff-permission.entity';
import { User } from '../user/user.entity';
import { SupportGroup } from '../support-group/support-group.entity';
import { SupportGroupMeeting } from '../support-group/support-group-meeting.entity';
import { SupportGroupRelativeCheckin } from '../support-group/support-group-relative-checkin.entity';

export interface MessageView {
  id: string;
  residentId: string | null;
  relativeId: string;
  staffId: string | null;
  senderUserId: string;
  senderName: string;
  senderProfileType: string;
  recipientName: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  status: MessageStatus;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export interface ConversationView {
  residentId: string;
  residentName: string;
  relativeId: string;
  relativeName: string;
  relativePhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  pendingCount: number;
  houseId: string;
  houseName: string;
}

export interface DirectConversationView {
  staffId: string;
  staffName: string;
  relativeId: string;
  relativeName: string;
  relativePhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  residentId: string;
  residentName: string;
}

export interface StaffThreadView {
  staffId: string;
  staffName: string;
  staffPhotoUrl: string | null;
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
    @InjectRepository(SupportGroup)
    private sgRepo: Repository<SupportGroup>,
    @InjectRepository(SupportGroupMeeting)
    private sgMeetingRepo: Repository<SupportGroupMeeting>,
    @InjectRepository(SupportGroupRelativeCheckin)
    private sgRelativeCheckinRepo: Repository<SupportGroupRelativeCheckin>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(StaffPermission)
    private permissionRepository: Repository<StaffPermission>,
  ) {}

  private async staffWithPermission(staffId: string, type: StaffPermissionType): Promise<boolean> {
    const count = await this.permissionRepository.count({ where: { staffId, permissionType: type } });
    return count > 0;
  }

  private toView(msg: Message & { senderName?: string; senderProfileType?: string; recipientName?: string; approvedByName?: string | null }): MessageView {
    return {
      id: msg.id,
      residentId: msg.residentId,
      relativeId: msg.relativeId,
      staffId: msg.staffId,
      senderUserId: msg.senderUserId,
      senderName: msg.senderName ?? '',
      senderProfileType: msg.senderProfileType ?? '',
      recipientName: msg.recipientName ?? '',
      content: msg.content,
      attachmentUrl: msg.attachmentUrl,
      attachmentType: msg.attachmentType,
      status: msg.status,
      approvedByUserId: msg.approvedByUserId,
      approvedByName: msg.approvedByName ?? null,
      approvedAt: msg.approvedAt,
      createdAt: msg.createdAt,
    };
  }

  private lastMessageLabel(msg: Message | null): string | null {
    if (!msg) return null;
    if (msg.content) return msg.content;
    if (msg.attachmentType === 'image') return '📷 Imagem';
    if (msg.attachmentType === 'audio') return '🎵 Áudio';
    if (msg.attachmentType === 'document') return '📄 Documento';
    return null;
  }

  async getConversations(staffUserId: string, role: string): Promise<ConversationView[]> {
    let residents: Resident[];

    if (role === Role.ADMIN) {
      residents = await this.residentRepository.find({ relations: ['house'] });
    } else {
      const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
      if (!staff || !staff.houseId) return [];
      residents = await this.residentRepository.find({ where: { houseId: staff.houseId }, relations: ['house'] });
    }
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
        relativePhotoUrl: relative.photoUrl ?? null,
        lastMessage: this.lastMessageLabel(lastMsg),
        lastMessageAt: lastMsg?.createdAt ?? null,
        pendingCount,
        houseId: resident?.houseId ?? '',
        houseName: (resident as any)?.house?.name ?? '',
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
          relativePhotoUrl: relative.photoUrl ?? null,
          lastMessage: this.lastMessageLabel(lastMsg),
          lastMessageAt: lastMsg?.createdAt ?? null,
          pendingCount: 0,
          houseId: '',
          houseName: '',
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
        relativePhotoUrl: relative.photoUrl ?? null,
        lastMessage: this.lastMessageLabel(lastMsg),
        lastMessageAt: lastMsg?.createdAt ?? null,
        pendingCount: 0,
        houseId: '',
        houseName: '',
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

    const allUserIds = [...new Set([
      ...messages.map((m) => m.senderUserId),
      ...messages.map((m) => m.approvedByUserId).filter((id): id is string => id !== null),
    ])];
    const users = await this.userRepository.findByIds(allUserIds);
    const staffList = await this.staffRepository.find({ where: allUserIds.map((id) => ({ userId: id })) });
    const residents = await this.residentRepository.find({ where: allUserIds.map((id) => ({ userId: id })) });
    const relativesList = await this.relativeRepository.find({ where: allUserIds.map((id) => ({ userId: id })) });

    const nameMap = new Map<string, string>();
    const profileTypeMap = new Map<string, string>();
    for (const u of users) {
      const staffMatch = staffList.find((s) => s.userId === u.id);
      const residentMatch = residents.find((r) => r.userId === u.id);
      const relativeMatch = relativesList.find((r) => r.userId === u.id);
      nameMap.set(u.id, staffMatch?.name ?? residentMatch?.name ?? relativeMatch?.name ?? u.email);
      profileTypeMap.set(
        u.id,
        residentMatch ? 'RESIDENT' : relativeMatch ? 'RELATIVE' : 'STAFF',
      );
    }

    return messages.map((m) => this.toView({
      ...m,
      senderName: nameMap.get(m.senderUserId),
      senderProfileType: profileTypeMap.get(m.senderUserId) ?? 'STAFF',
      approvedByName: m.approvedByUserId ? (nameMap.get(m.approvedByUserId) ?? null) : null,
    }));
  }

  async getPending(staffUserId: string): Promise<MessageView[]> {
    const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
    if (!staff || !staff.houseId) return [];
    const canModerate = await this.staffWithPermission(staff.id, StaffPermissionType.MODERATE_MESSAGES);
    if (!canModerate) return [];

    const residents = await this.residentRepository.find({ where: { houseId: staff.houseId } });
    const residentIds = residents.map((r) => r.id);
    if (!residentIds.length) return [];

    const messages = await this.messageRepository.find({
      where: residentIds.map((id) => ({ residentId: id, status: MessageStatus.PENDING_APPROVAL })),
      order: { createdAt: 'ASC' },
    });

    const senderUserIds = [...new Set(messages.map((m) => m.senderUserId))];
    const residentBySender = await this.residentRepository.find({ where: senderUserIds.map((id) => ({ userId: id })) });
    const relativeBySender = await this.relativeRepository.find({ where: senderUserIds.map((id) => ({ userId: id })) });

    const senderNameMap = new Map<string, string>();
    for (const r of residentBySender) if (r.userId) senderNameMap.set(r.userId, r.name);
    for (const r of relativeBySender) if (r.userId) senderNameMap.set(r.userId, r.name);

    const senderIsRelativeSet = new Set(relativeBySender.filter((r) => r.userId).map((r) => r.userId!));

    const residentIdToName = new Map(residents.map((r) => [r.id, r.name]));

    const relativeIds = [...new Set(messages.map((m) => m.relativeId))];
    const allRelatives = await this.relativeRepository.find({ where: relativeIds.map((id) => ({ id })) });
    const relativeIdToName = new Map(allRelatives.map((r) => [r.id, r.name]));

    return messages.map((m) => {
      const senderName = senderNameMap.get(m.senderUserId) ?? '';
      const senderIsRelative = senderIsRelativeSet.has(m.senderUserId);
      const recipientName = senderIsRelative
        ? (residentIdToName.get(m.residentId ?? '') ?? '')
        : (relativeIdToName.get(m.relativeId) ?? '');
      return this.toView({ ...m, senderName, recipientName });
    });
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

    if (!dto.content?.trim() && !dto.attachmentUrl) throw new BadRequestException('Mensagem vazia');

    const relative = await this.relativeRepository.findOne({ where: { id: dto.relativeId } });
    if (!relative || relative.residentId !== dto.residentId) throw new NotFoundException('Familiar não encontrado');

    const status = (isResident || isRelative) ? MessageStatus.PENDING_APPROVAL : MessageStatus.APPROVED;
    const message = this.messageRepository.create({
      residentId: dto.residentId,
      relativeId: dto.relativeId,
      senderUserId,
      content: dto.content?.trim() || null,
      attachmentUrl: dto.attachmentUrl ?? null,
      attachmentType: dto.attachmentType ?? null,
      status,
    });
    const saved = await this.messageRepository.save(message);
    return this.toView(saved);
  }

  async getHouseStaffThreads(relativeUserId: string): Promise<StaffThreadView[]> {
    const relative = await this.relativeRepository.findOne({ where: { userId: relativeUserId } });
    if (!relative) throw new NotFoundException('Familiar não encontrado');

    const resident = await this.residentRepository.findOne({ where: { id: relative.residentId } });

    const houseStaff = resident?.houseId
      ? await this.staffRepository.find({ where: { houseId: resident.houseId } })
      : [];

    const checkins = await this.sgRelativeCheckinRepo.find({ where: { relativeId: relative.id } });
    const meetingIds = [...new Set(checkins.map((c) => c.meetingId))];
    let servants: Staff[] = [];
    if (meetingIds.length > 0) {
      const meetings = await this.sgMeetingRepo.find({ where: meetingIds.map((id) => ({ id })) });
      const supportGroupIds = [...new Set(meetings.map((m) => m.supportGroupId))];
      if (supportGroupIds.length > 0) {
        servants = await this.staffRepository.find({ where: supportGroupIds.map((id) => ({ supportGroupId: id })) });
      }
    }

    const allGroups = await this.sgRepo.find({ where: { coordinatorId: Not(IsNull()) } });
    const coordinatorIds = allGroups.map((g) => g.coordinatorId).filter((id): id is string => id !== null);
    const coordinators = coordinatorIds.length > 0
      ? await this.staffRepository.find({ where: coordinatorIds.map((id) => ({ id })) })
      : [];

    const staffMap = new Map<string, Staff>();
    for (const s of [...houseStaff, ...servants, ...coordinators]) staffMap.set(s.id, s);

    const staffIds = [...staffMap.keys()];
    const permittedIds = staffIds.length > 0
      ? new Set(
          (await this.permissionRepository.find({
            where: staffIds.map((id) => ({ staffId: id, permissionType: StaffPermissionType.SEND_MESSAGES_TO_FAMILIES })),
          })).map((p) => p.staffId),
        )
      : new Set<string>();

    const result: StaffThreadView[] = [];
    for (const s of staffMap.values()) {
      if (!permittedIds.has(s.id)) continue;
      const lastMsg = await this.messageRepository.findOne({
        where: { staffId: s.id, relativeId: relative.id },
        order: { createdAt: 'DESC' },
      });
      result.push({
        staffId: s.id,
        staffName: s.name,
        staffPhotoUrl: s.photoUrl ?? null,
        lastMessage: this.lastMessageLabel(lastMsg),
        lastMessageAt: lastMsg?.createdAt ?? null,
      });
    }

    return result.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
  }

  async getDirectConversations(staffUserId: string, role: string): Promise<DirectConversationView[]> {
    type RawPair = { staffId: string; relativeId: string };
    let pairs: RawPair[];

    if (role === Role.ADMIN) {
      pairs = await this.messageRepository
        .createQueryBuilder('m')
        .select('m.staffId', 'staffId')
        .addSelect('m.relativeId', 'relativeId')
        .where('m.staffId IS NOT NULL')
        .groupBy('m.staffId')
        .addGroupBy('m.relativeId')
        .getRawMany<RawPair>();
    } else if (role === Role.COORDINATOR) {
      const coordinator = await this.staffRepository.findOne({ where: { userId: staffUserId } });
      if (!coordinator?.houseId) return [];

      const houseStaff = await this.staffRepository.find({ where: { houseId: coordinator.houseId } });
      const staffIds = houseStaff.map((s) => s.id);
      if (!staffIds.length) return [];

      pairs = await this.messageRepository
        .createQueryBuilder('m')
        .select('m.staffId', 'staffId')
        .addSelect('m.relativeId', 'relativeId')
        .where('m.staffId IN (:...staffIds)', { staffIds })
        .groupBy('m.staffId')
        .addGroupBy('m.relativeId')
        .getRawMany<RawPair>();
    } else {
      // SERVANT: only own conversations
      const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
      if (!staff || (!staff.houseId && !staff.supportGroupId)) return [];

      const rows = await this.messageRepository
        .createQueryBuilder('m')
        .select('m.relativeId', 'relativeId')
        .where('m.staffId = :staffId', { staffId: staff.id })
        .groupBy('m.relativeId')
        .getRawMany<{ relativeId: string }>();

      pairs = rows.map((r) => ({ staffId: staff.id, relativeId: r.relativeId }));
    }

    const result: DirectConversationView[] = [];
    for (const { staffId, relativeId } of pairs) {
      const staffEntity = await this.staffRepository.findOne({ where: { id: staffId } });
      const relative = await this.relativeRepository.findOne({ where: { id: relativeId } });
      if (!staffEntity || !relative) continue;

      const resident = await this.residentRepository.findOne({ where: { id: relative.residentId } });

      const lastMsg = await this.messageRepository.findOne({
        where: { staffId, relativeId },
        order: { createdAt: 'DESC' },
      });
      result.push({
        staffId,
        staffName: staffEntity.name,
        relativeId,
        relativeName: relative.name,
        relativePhotoUrl: relative.photoUrl ?? null,
        lastMessage: this.lastMessageLabel(lastMsg),
        lastMessageAt: lastMsg?.createdAt ?? null,
        residentId: resident?.id ?? '',
        residentName: resident?.name ?? '',
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

      const staff = await this.staffRepository.findOne({ where: { id: dto.staffId } });
      if (!staff) throw new ForbiddenException('Servo não encontrado');

      if (staff.houseId) {
        if (staff.houseId !== resident.houseId) throw new ForbiddenException('Servo não pertence à mesma casa');
      } else if (staff.supportGroupId) {
        const checkins = await this.sgRelativeCheckinRepo.find({ where: { relativeId: relative.id } });
        const meetingIds = checkins.map((c) => c.meetingId);
        const hasAttended = meetingIds.length > 0
          && await this.sgMeetingRepo.findOne({ where: meetingIds.map((mid) => ({ id: mid, supportGroupId: staff.supportGroupId! })) }) !== null;
        if (!hasAttended) throw new ForbiddenException('Familiar não participou de reunião deste grupo');
      } else {
        const isCoordinator = await this.sgRepo.findOne({ where: { coordinatorId: staff.id } }) !== null;
        if (!isCoordinator) throw new ForbiddenException();
      }
    } else {
      const staff = await this.staffRepository.findOne({ where: { userId: senderUserId } });
      if (!staff || staff.id !== dto.staffId) throw new ForbiddenException();

      const relative = await this.relativeRepository.findOne({ where: { id: dto.relativeId } });
      if (!relative) throw new NotFoundException('Familiar não encontrado');

      if (staff.houseId) {
        const resident = await this.residentRepository.findOne({ where: { id: relative.residentId } });
        if (!resident || resident.houseId !== staff.houseId) throw new ForbiddenException('Familiar não pertence à mesma casa');
      } else if (staff.supportGroupId) {
        const checkins = await this.sgRelativeCheckinRepo.find({ where: { relativeId: relative.id } });
        const meetingIds = checkins.map((c) => c.meetingId);
        const hasAttended = meetingIds.length > 0
          && await this.sgMeetingRepo.findOne({ where: meetingIds.map((mid) => ({ id: mid, supportGroupId: staff.supportGroupId! })) }) !== null;
        if (!hasAttended) throw new ForbiddenException('Familiar não participou de reunião deste grupo');
      } else {
        const isCoordinator = await this.sgRepo.findOne({ where: { coordinatorId: staff.id } }) !== null;
        if (!isCoordinator) throw new ForbiddenException();
      }
    }

    if (!dto.content?.trim() && !dto.attachmentUrl) throw new BadRequestException('Mensagem vazia');

    const message = this.messageRepository.create({
      staffId: dto.staffId,
      relativeId: dto.relativeId,
      residentId: null,
      senderUserId,
      content: dto.content?.trim() || null,
      attachmentUrl: dto.attachmentUrl ?? null,
      attachmentType: dto.attachmentType ?? null,
      status: MessageStatus.APPROVED,
    });
    const saved = await this.messageRepository.save(message);
    return this.toView(saved);
  }

  async approve(staffUserId: string, messageId: string): Promise<MessageView> {
    const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
    if (!staff || !(await this.staffWithPermission(staff.id, StaffPermissionType.MODERATE_MESSAGES))) {
      throw new ForbiddenException('Sem permissão para moderar mensagens');
    }

    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Mensagem não encontrada');

    await this.messageRepository.update(messageId, {
      status: MessageStatus.APPROVED,
      approvedByUserId: staffUserId,
      approvedAt: new Date(),
    });
    return this.toView({ ...message, status: MessageStatus.APPROVED, approvedByUserId: staffUserId, approvedAt: new Date(), approvedByName: staff.name });
  }

  async reject(staffUserId: string, messageId: string): Promise<MessageView> {
    const staff = await this.staffRepository.findOne({ where: { userId: staffUserId } });
    if (!staff || !(await this.staffWithPermission(staff.id, StaffPermissionType.MODERATE_MESSAGES))) {
      throw new ForbiddenException('Sem permissão para moderar mensagens');
    }

    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Mensagem não encontrada');

    await this.messageRepository.update(messageId, {
      status: MessageStatus.REJECTED,
      approvedByUserId: staffUserId,
      approvedAt: new Date(),
    });
    return this.toView({ ...message, status: MessageStatus.REJECTED, approvedByUserId: staffUserId, approvedAt: new Date(), approvedByName: staff.name });
  }
}
