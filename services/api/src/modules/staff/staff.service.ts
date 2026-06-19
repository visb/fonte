import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role, ServantRank, StaffPermissionType } from '@fonte/types';
import { Staff } from './staff.entity';
import { StaffPermission } from './staff-permission.entity';
import { User } from '../user/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffMeDto } from './dto/update-staff-me.dto';
import { StorageService } from '../storage/storage.service';
import { HOUSE_STAFF_CHANGED_EVENT } from '../../common/events/house-staff.event';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(StaffPermission)
    private permissionRepository: Repository<StaffPermission>,
    private storageService: StorageService,
    private eventEmitter: EventEmitter2,
  ) {}

  // Sinaliza ao HouseService que o staffCount/lotação por casa pode ter mudado
  // (invalida o cache house:list). Sobre-invalidar é aceitável: correção > micro-opt.
  private emitHouseStaffChanged(): void {
    this.eventEmitter.emit(HOUSE_STAFF_CHANGED_EVENT);
  }

  async findByUserId(userId: string): Promise<Staff & { permissions: StaffPermissionType[] }> {
    const staff = await this.staffRepository.findOne({
      where: { userId },
      relations: ['user', 'house'],
    });
    if (!staff) throw new NotFoundException(`Staff profile not found for user ${userId}`);
    const perms = await this.permissionRepository.find({ where: { staffId: staff.id } });
    return Object.assign(staff, { permissions: perms.map((p) => p.permissionType) });
  }

  // LGPD art. 6/46 — escopo por casa. COORDINATOR só lista staff da própria
  // casa; ADMIN lista todos. houseId vem do staff autenticado, não do cliente.
  async findAll(caller?: { role: string; userId: string }): Promise<Staff[]> {
    const order = { name: 'ASC' } as const;
    const relations = ['user', 'house', 'supportGroup'];
    if (caller && caller.role !== Role.ADMIN) {
      const me = await this.findByUserId(caller.userId).catch(() => null);
      if (!me?.houseId) return [];
      return this.staffRepository.find({ where: { houseId: me.houseId }, order, relations });
    }
    return this.staffRepository.find({ order, relations });
  }

  async findOne(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { id },
      relations: ['user', 'house', 'supportGroup'],
    });
    if (!staff) throw new NotFoundException(`Staff ${id} not found`);
    return staff;
  }

  async create(dto: CreateStaffDto): Promise<Staff> {
    const email = dto.email || null;
    if (email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash,
      role: dto.role,
      mustChangePassword: true,
    });
    const savedUser = await this.userRepository.save(user);

    const { email: _email, password: _password, role, ...fields } = dto;
    const staff = this.staffRepository.create({
      ...fields,
      phone: dto.phone ?? null,
      houseId: dto.houseId ?? null,
      supportGroupId: dto.supportGroupId ?? null,
      rank: dto.role === Role.SERVANT ? (dto.rank ?? null) : null,
      userId: savedUser.id,
    });
    const saved = await this.staffRepository.save(staff);
    this.emitHouseStaffChanged();
    return saved;
  }

  existsForFormerResident(residentId: string): Promise<boolean> {
    return this.staffRepository.exists({ where: { formerResidentId: residentId } });
  }

  // Cria um Staff a partir de um Resident promovido a servo. O User já foi
  // resolvido (reaproveitado ou criado) pelo ResidentService.
  createFromResident(params: {
    name: string;
    phone: string | null;
    houseId: string | null;
    photoUrl: string | null;
    userId: string;
    formerResidentId: string;
    rank: ServantRank;
    promotedAt: string;
  }): Promise<Staff> {
    const staff = this.staffRepository.create({
      name: params.name,
      phone: params.phone,
      houseId: params.houseId,
      photoUrl: params.photoUrl,
      userId: params.userId,
      formerResidentId: params.formerResidentId,
      rank: params.rank,
      promotedAt: params.promotedAt,
    });
    return this.staffRepository.save(staff);
  }

  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.findOne(id);

    const { email, role, password, ...staffFields } = dto;

    if (Object.keys(staffFields).length) {
      await this.staffRepository.update(id, staffFields);
    }

    const userUpdates: Partial<User> = {};
    if (email !== undefined) {
      const normalized = email || null;
      if (normalized) {
        const existing = await this.userRepository.findOne({ where: { email: normalized } });
        if (existing && existing.id !== staff.userId) {
          throw new ConflictException('E-mail já cadastrado');
        }
      }
      userUpdates.email = normalized;
    }
    if (role !== undefined) userUpdates.role = role;
    if (password) {
      userUpdates.passwordHash = await bcrypt.hash(password, 10);
      userUpdates.mustChangePassword = true;
    }

    if (Object.keys(userUpdates).length) {
      await this.userRepository.update(staff.userId, userUpdates);
    }

    this.emitHouseStaffChanged();
    return this.findOne(id);
  }

  async uploadPhoto(id: string, file: Express.Multer.File): Promise<Staff> {
    const staff = await this.findOne(id);
    if (staff.photoUrl) {
      await this.storageService.delete(staff.photoUrl);
    }
    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('staff', filename, file.buffer, file.mimetype);
    await this.staffRepository.update(id, { photoUrl: url });
    return this.findOne(id);
  }

  async updateMe(userId: string, dto: UpdateStaffMeDto): Promise<Staff> {
    const staff = await this.findByUserId(userId);
    const { email, ...staffFields } = dto;

    if (Object.keys(staffFields).length) {
      await this.staffRepository.update(staff.id, staffFields);
    }

    if (email !== undefined) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing && existing.id !== staff.userId) throw new ConflictException('E-mail já cadastrado');
      await this.userRepository.update(staff.userId, { email });
    }

    return this.findByUserId(userId);
  }

  async uploadPhotoMe(userId: string, file: Express.Multer.File): Promise<Staff> {
    const staff = await this.findByUserId(userId);
    return this.uploadPhoto(staff.id, file);
  }

  async remove(id: string): Promise<void> {
    const staff = await this.findOne(id);
    await this.userRepository.update(staff.userId, { isActive: false });
    await this.userRepository.softDelete(staff.userId);
    await this.staffRepository.softDelete(id);
    this.emitHouseStaffChanged();
  }

  // ─── Permissions ─────────────────────────────────────────────────────────────

  async getPermissions(staffId: string): Promise<StaffPermission[]> {
    await this.findOne(staffId);
    return this.permissionRepository.find({ where: { staffId }, order: { permissionType: 'ASC' } });
  }

  async addPermission(staffId: string, type: StaffPermissionType): Promise<StaffPermission> {
    await this.findOne(staffId);
    const existing = await this.permissionRepository.findOne({ where: { staffId, permissionType: type } });
    if (existing) throw new ConflictException('Permissão já concedida');
    return this.permissionRepository.save(this.permissionRepository.create({ staffId, permissionType: type }));
  }

  async removePermission(staffId: string, type: StaffPermissionType): Promise<void> {
    const perm = await this.permissionRepository.findOne({ where: { staffId, permissionType: type } });
    if (!perm) throw new NotFoundException('Permissão não encontrada');
    await this.permissionRepository.delete(perm.id);
  }

  async hasPermission(staffId: string, type: StaffPermissionType): Promise<boolean> {
    const count = await this.permissionRepository.count({ where: { staffId, permissionType: type } });
    return count > 0;
  }
}
