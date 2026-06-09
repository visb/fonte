import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { FollowUpType, Role } from '@fonte/types';
import { Relative } from './relative.entity';
import { CreateRelativeDto } from './dto/create-relative.dto';
import { UpdateRelativeMeDto } from './dto/update-relative-me.dto';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';
import { User } from '../user/user.entity';
import { StorageService } from '../storage/storage.service';
import { ResidentFollowUpService } from '../resident-follow-up/resident-follow-up.service';

export interface RelativeMeView {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  relationship: string | null;
  residentId: string;
  residentName: string;
  residentPhotoUrl: string | null;
  houseId: string;
  houseName: string;
  houseAddress: string | null;
  houseCity: string | null;
  housePhone: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
}

@Injectable()
export class RelativeService {
  constructor(
    @InjectRepository(Relative)
    private relativeRepository: Repository<Relative>,
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private storageService: StorageService,
    private followUpService: ResidentFollowUpService,
  ) {}

  // LGPD art. 6/46 — escopo por casa: não-ADMIN só vê familiares de internos da
  // própria casa. houseId derivado do staff autenticado.
  async findByResident(residentId: string, caller?: { role: string; userId: string }): Promise<Relative[]> {
    if (caller && caller.role !== Role.ADMIN) {
      const staff = await this.staffRepository.findOne({ where: { userId: caller.userId } });
      const resident = await this.residentRepository.findOne({ where: { id: residentId } });
      if (!staff?.houseId || !resident || resident.houseId !== staff.houseId) {
        throw new ForbiddenException();
      }
    }
    return this.relativeRepository.find({
      where: { residentId },
      order: { name: 'ASC' },
    });
  }

  async findMe(userId: string): Promise<RelativeMeView> {
    const relative = await this.relativeRepository.findOne({
      where: { userId },
      relations: ['resident', 'resident.house', 'resident.house.coordinator'],
    });
    if (!relative) throw new NotFoundException('Perfil de familiar não encontrado');

    const { resident } = relative;
    const house = resident?.house;
    const coordinator = house?.coordinator ?? null;

    return {
      id: relative.id,
      userId: relative.userId!,
      name: relative.name,
      phone: relative.phone,
      photoUrl: relative.photoUrl,
      relationship: relative.relationship,
      residentId: resident.id,
      residentName: resident.name,
      residentPhotoUrl: resident.photoUrl ?? null,
      houseId: house?.id ?? '',
      houseName: house?.name ?? '',
      houseAddress: house?.address ?? null,
      houseCity: house?.city ?? null,
      housePhone: house?.phone ?? null,
      coordinatorName: coordinator?.name ?? null,
      coordinatorPhone: coordinator?.phone ?? null,
    };
  }

  async updateMe(userId: string, dto: UpdateRelativeMeDto): Promise<RelativeMeView> {
    const relative = await this.relativeRepository.findOne({ where: { userId } });
    if (!relative) throw new NotFoundException('Perfil de familiar não encontrado');
    await this.relativeRepository.update(relative.id, dto);
    return this.findMe(userId);
  }

  async uploadPhoto(userId: string, file: Express.Multer.File): Promise<RelativeMeView> {
    const relative = await this.relativeRepository.findOne({ where: { userId } });
    if (!relative) throw new NotFoundException('Perfil de familiar não encontrado');
    if (relative.photoUrl) {
      await this.storageService.delete(relative.photoUrl);
    }
    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('relatives', filename, file.buffer, file.mimetype);
    await this.relativeRepository.update(relative.id, { photoUrl: url });
    return this.findMe(userId);
  }

  async create(dto: CreateRelativeDto): Promise<Relative> {
    const relative = this.relativeRepository.create(dto);
    const saved = await this.relativeRepository.save(relative);
    if (dto.isResponsible) await this.setResponsible(saved.id);
    await this.followUpService.createAuto(dto.residentId, FollowUpType.RELATIVE_ADDED);
    return saved;
  }

  // Marca este familiar como responsável e remove a marcação dos demais do mesmo acolhido.
  async setResponsible(id: string): Promise<Relative> {
    const relative = await this.relativeRepository.findOne({ where: { id } });
    if (!relative) throw new NotFoundException(`Relative ${id} not found`);
    await this.relativeRepository.update(
      { residentId: relative.residentId },
      { isResponsible: false },
    );
    await this.relativeRepository.update(id, { isResponsible: true });
    return this.relativeRepository.findOne({ where: { id } }) as Promise<Relative>;
  }

  async remove(id: string): Promise<void> {
    const count = await this.relativeRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`Relative ${id} not found`);
    await this.relativeRepository.softDelete(id);
  }

  async generateAccess(id: string, email: string, password: string): Promise<Relative> {
    const relative = await this.relativeRepository.findOne({ where: { id } });
    if (!relative) throw new NotFoundException(`Relative ${id} not found`);
    if (relative.userId) throw new ConflictException('Acesso já gerado para este familiar');

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash,
      role: Role.RELATIVE,
      mustChangePassword: true,
    });
    const savedUser = await this.userRepository.save(user);
    await this.relativeRepository.update(id, { userId: savedUser.id });
    return this.relativeRepository.findOne({ where: { id } }) as Promise<Relative>;
  }

  async resetPassword(id: string, password: string): Promise<void> {
    const relative = await this.relativeRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!relative) throw new NotFoundException(`Relative ${id} not found`);
    if (!relative.userId || !relative.user) throw new NotFoundException('Acesso não gerado para este familiar');

    const passwordHash = await bcrypt.hash(password, 10);
    await this.userRepository.update(relative.userId, { passwordHash, mustChangePassword: true });
  }
}
