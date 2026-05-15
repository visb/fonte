import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Staff } from './staff.entity';
import { User } from '../user/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffMeDto } from './dto/update-staff-me.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private storageService: StorageService,
  ) {}

  async findByUserId(userId: string): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { userId },
      relations: ['user', 'house'],
    });
    if (!staff) throw new NotFoundException(`Staff profile not found for user ${userId}`);
    return staff;
  }

  findAll(): Promise<Staff[]> {
    return this.staffRepository.find({
      order: { name: 'ASC' },
      relations: ['user', 'house', 'supportGroup'],
    });
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
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      role: dto.role,
      mustChangePassword: true,
    });
    const savedUser = await this.userRepository.save(user);

    const staff = this.staffRepository.create({
      name: dto.name,
      phone: dto.phone ?? null,
      houseId: dto.houseId ?? null,
      supportGroupId: dto.supportGroupId ?? null,
      userId: savedUser.id,
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
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing && existing.id !== staff.userId) {
        throw new ConflictException('E-mail já cadastrado');
      }
      userUpdates.email = email;
    }
    if (role !== undefined) userUpdates.role = role;
    if (password) {
      userUpdates.passwordHash = await bcrypt.hash(password, 10);
      userUpdates.mustChangePassword = true;
    }

    if (Object.keys(userUpdates).length) {
      await this.userRepository.update(staff.userId, userUpdates);
    }

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
  }
}
