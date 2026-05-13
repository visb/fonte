import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportGroup } from './support-group.entity';
import { SupportGroupMeeting } from './support-group-meeting.entity';
import { SupportGroupCheckin } from './support-group-checkin.entity';
import { SupportGroupRelativeCheckin } from './support-group-relative-checkin.entity';
import { CreateSupportGroupDto } from './dto/create-support-group.dto';
import { UpdateSupportGroupDto } from './dto/update-support-group.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { Relative } from '../relative/relative.entity';

@Injectable()
export class SupportGroupService {
  constructor(
    @InjectRepository(SupportGroup)
    private groupRepo: Repository<SupportGroup>,
    @InjectRepository(SupportGroupMeeting)
    private meetingRepo: Repository<SupportGroupMeeting>,
    @InjectRepository(SupportGroupCheckin)
    private checkinRepo: Repository<SupportGroupCheckin>,
    @InjectRepository(SupportGroupRelativeCheckin)
    private relativeCheckinRepo: Repository<SupportGroupRelativeCheckin>,
    @InjectRepository(Relative)
    private relativeRepo: Repository<Relative>,
  ) {}

  // ─── Groups ──────────────────────────────────────────────────────────────────

  async findAll(): Promise<Array<{
    id: string;
    name: string;
    churchName: string;
    address: string;
    coordinatorId: string | null;
    coordinatorName: string | null;
    dayOfWeek: number;
    createdAt: Date;
  }>> {
    return this.groupRepo.manager.query(
      `SELECT g.id,
              g.name,
              g.church_name   AS "churchName",
              g.address,
              g.coordinator_id AS "coordinatorId",
              s.name           AS "coordinatorName",
              g.day_of_week    AS "dayOfWeek",
              g.created_at     AS "createdAt"
       FROM support_groups g
       LEFT JOIN staff s ON s.id = g.coordinator_id AND s.deleted_at IS NULL
       WHERE g.deleted_at IS NULL
       ORDER BY g.name`,
    );
  }

  async create(dto: CreateSupportGroupDto): Promise<SupportGroup> {
    return this.groupRepo.save(
      this.groupRepo.create({
        name: dto.name,
        churchName: dto.churchName,
        address: dto.address,
        coordinatorId: dto.coordinatorId ?? null,
        dayOfWeek: dto.dayOfWeek,
      }),
    );
  }

  async findOne(id: string): Promise<{
    id: string;
    name: string;
    churchName: string;
    address: string;
    coordinatorId: string | null;
    coordinatorName: string | null;
    dayOfWeek: number;
    createdAt: Date;
  }> {
    const [row] = await this.groupRepo.manager.query(
      `SELECT g.id,
              g.name,
              g.church_name    AS "churchName",
              g.address,
              g.coordinator_id AS "coordinatorId",
              s.name           AS "coordinatorName",
              g.day_of_week    AS "dayOfWeek",
              g.created_at     AS "createdAt"
       FROM support_groups g
       LEFT JOIN staff s ON s.id = g.coordinator_id AND s.deleted_at IS NULL
       WHERE g.id = $1 AND g.deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException(`SupportGroup ${id} not found`);
    return row;
  }

  async update(id: string, dto: UpdateSupportGroupDto): Promise<SupportGroup> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException(`SupportGroup ${id} not found`);

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.churchName !== undefined) group.churchName = dto.churchName;
    if (dto.address !== undefined) group.address = dto.address;
    if (dto.coordinatorId !== undefined) group.coordinatorId = dto.coordinatorId ?? null;
    if (dto.dayOfWeek !== undefined) group.dayOfWeek = dto.dayOfWeek;

    return this.groupRepo.save(group);
  }

  async remove(id: string): Promise<void> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException(`SupportGroup ${id} not found`);
    await this.groupRepo.softDelete(id);
  }

  // ─── Meetings ─────────────────────────────────────────────────────────────────

  async findMeetings(groupId: string): Promise<Array<{
    id: string;
    supportGroupId: string;
    supportGroupName: string;
    date: string;
    notes: string | null;
    checkinToken: string;
    checkinCount: number;
    createdAt: Date;
  }>> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`SupportGroup ${groupId} not found`);

    return this.groupRepo.manager.query(
      `SELECT m.id,
              m.support_group_id  AS "supportGroupId",
              g.name              AS "supportGroupName",
              m.date::text        AS "date",
              m.notes,
              m.checkin_token     AS "checkinToken",
              COUNT(c.id)::int    AS "checkinCount",
              m.created_at        AS "createdAt"
       FROM support_group_meetings m
       JOIN support_groups g ON g.id = m.support_group_id
       LEFT JOIN support_group_checkins c ON c.meeting_id = m.id
       WHERE m.support_group_id = $1
       GROUP BY m.id, g.name
       ORDER BY m.date DESC`,
      [groupId],
    );
  }

  async findAllMeetings(): Promise<Array<{
    id: string;
    supportGroupId: string;
    supportGroupName: string;
    date: string;
    notes: string | null;
    checkinToken: string;
    checkinCount: number;
    createdAt: Date;
  }>> {
    return this.groupRepo.manager.query(
      `SELECT m.id,
              m.support_group_id  AS "supportGroupId",
              g.name              AS "supportGroupName",
              m.date::text        AS "date",
              m.notes,
              m.checkin_token     AS "checkinToken",
              COUNT(c.id)::int    AS "checkinCount",
              m.created_at        AS "createdAt"
       FROM support_group_meetings m
       JOIN support_groups g ON g.id = m.support_group_id AND g.deleted_at IS NULL
       LEFT JOIN support_group_checkins c ON c.meeting_id = m.id
       GROUP BY m.id, g.name
       ORDER BY m.date DESC`,
    );
  }

  async createMeeting(groupId: string, dto: CreateMeetingDto): Promise<SupportGroupMeeting> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`SupportGroup ${groupId} not found`);

    return this.meetingRepo.save(
      this.meetingRepo.create({
        supportGroupId: groupId,
        date: dto.date,
        notes: dto.notes ?? null,
      }),
    );
  }

  async findMeetingDetail(meetingId: string): Promise<{
    id: string;
    supportGroupId: string;
    supportGroupName: string;
    date: string;
    notes: string | null;
    checkinToken: string;
    checkins: Array<{ id: string; residentId: string; residentName: string; checkedInAt: Date }>;
  }> {
    const [row] = await this.groupRepo.manager.query(
      `SELECT m.id,
              m.support_group_id AS "supportGroupId",
              g.name             AS "supportGroupName",
              m.date::text       AS "date",
              m.notes,
              m.checkin_token    AS "checkinToken"
       FROM support_group_meetings m
       JOIN support_groups g ON g.id = m.support_group_id AND g.deleted_at IS NULL
       WHERE m.id = $1`,
      [meetingId],
    );
    if (!row) throw new NotFoundException(`Meeting ${meetingId} not found`);

    const checkins = await this.groupRepo.manager.query(
      `SELECT c.id,
              c.resident_id   AS "residentId",
              r.name          AS "residentName",
              c.checked_in_at AS "checkedInAt"
       FROM support_group_checkins c
       JOIN residents r ON r.id = c.resident_id AND r.deleted_at IS NULL
       WHERE c.meeting_id = $1
       ORDER BY c.checked_in_at ASC`,
      [meetingId],
    );

    return { ...row, checkins };
  }

  // ─── Checkins ─────────────────────────────────────────────────────────────────

  async addCheckin(meetingId: string, residentId: string): Promise<{
    id: string;
    meetingId: string;
    residentId: string;
    residentName: string;
    checkedInAt: Date;
  }> {
    const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException(`Meeting ${meetingId} not found`);

    const [resident] = await this.groupRepo.manager.query<[{ id: string; name: string } | undefined]>(
      `SELECT id, name FROM residents WHERE id = $1 AND deleted_at IS NULL`,
      [residentId],
    );
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);

    const existing = await this.checkinRepo.findOne({ where: { meetingId, residentId } });
    if (existing) throw new ConflictException('Família já registrada nesta reunião');

    const checkin = await this.checkinRepo.save(
      this.checkinRepo.create({ meetingId, residentId }),
    );

    return {
      id: checkin.id,
      meetingId: checkin.meetingId,
      residentId: checkin.residentId,
      residentName: resident.name,
      checkedInAt: checkin.checkedInAt,
    };
  }

  async removeCheckin(meetingId: string, checkinId: string): Promise<void> {
    const checkin = await this.checkinRepo.findOne({ where: { id: checkinId, meetingId } });
    if (!checkin) throw new NotFoundException(`Checkin ${checkinId} not found`);
    await this.checkinRepo.delete(checkinId);
  }

  async addRelativeCheckin(
    relativeUserId: string,
    token: string,
  ): Promise<{ id: string; meetingId: string; relativeId: string; relativeName: string; checkedInAt: Date }> {
    const relative = await this.relativeRepo.findOne({ where: { userId: relativeUserId } });
    if (!relative) throw new NotFoundException('Perfil de familiar não encontrado');

    const meeting = await this.meetingRepo.findOne({ where: { checkinToken: token } });
    if (!meeting) throw new NotFoundException('Reunião não encontrada para este token');

    const existing = await this.relativeCheckinRepo.findOne({
      where: { meetingId: meeting.id, relativeId: relative.id },
    });
    if (existing) throw new ConflictException('Check-in já registrado para esta reunião');

    const checkin = await this.relativeCheckinRepo.save(
      this.relativeCheckinRepo.create({ meetingId: meeting.id, relativeId: relative.id }),
    );

    return {
      id: checkin.id,
      meetingId: checkin.meetingId,
      relativeId: checkin.relativeId,
      relativeName: relative.name,
      checkedInAt: checkin.checkedInAt,
    };
  }
}
