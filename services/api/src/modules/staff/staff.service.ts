import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  AuditAction,
  AuditTargetType,
  Role,
  ServantRank,
  StaffPermissionType,
  todayInSaoPaulo,
} from '@fonte/types';
import { AuditService, loadById, TrackOptions } from '../audit/audit.service';
import type { AuditSnapshot } from '../audit/audit-diff';
import {
  STAFF_AUDIT_FIELDS,
  STAFF_DELETE_AUDIT_FIELDS,
  STAFF_PERMISSION_AUDIT_FIELDS,
} from '../audit/audit-fields';
import { Staff } from './staff.entity';
import { StaffPermission } from './staff-permission.entity';
import { House } from '../house/house.entity';
import { User } from '../user/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffMeDto } from './dto/update-staff-me.dto';
import { StorageService } from '../storage/storage.service';
import { assertAdultBirthDate } from '../../common/lib/birth-date';
import { isHouseCoordinatorRole } from '../../common/auth/house-coordinator';
import { openServicePeriod } from './staff-service-period.service';

/**
 * Estado auditável do servo (story 199): a ficha + perfil/e-mail/ativo do User
 * ligado. Senha e hash nunca entram (a lista de campos não os contém).
 */
export async function loadStaffSnapshot(manager: EntityManager, id: string): Promise<AuditSnapshot | null> {
  const staff = await manager.getRepository(Staff).findOne({ where: { id } });
  if (!staff) return null;
  const user = await manager
    .getRepository(User)
    .findOne({ where: { id: staff.userId }, withDeleted: true });
  return {
    ...(staff as unknown as AuditSnapshot),
    email: user?.email ?? null,
    role: user?.role ?? null,
    isActive: user?.isActive ?? null,
  };
}

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
    // Story 199 — último de propósito: os anteriores são contrato dos specs.
    private audit: AuditService,
  ) {}

  // O whatsapp é o identificador de login do servo (story 97): persistir só os
  // dígitos, coerente com a normalização do lookup em findActiveUserIdsByPhone.
  private normalizeWhatsapp(value: string | null | undefined): string | null {
    if (value == null) return null;
    const digits = value.replace(/\D/g, '');
    return digits || null;
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
    // Story 202: antes de criar o User — recusa não deixa login órfão.
    assertAdultBirthDate(dto.birthDate);
    const email = dto.email || null;
    if (email) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { email: _email, password: _password, role, ...fields } = dto;

    // Story 199: User + Staff + evento na mesma transação. Story 216: o período
    // de serviço aberto (início = hoje) entra na mesma transação.
    return this.trackStaff(undefined, AuditAction.STAFF_CREATE, async (m) => {
      const userRepo = m.getRepository(User);
      const staffRepo = m.getRepository(Staff);
      const savedUser = await userRepo.save(
        userRepo.create({ email, passwordHash, role: dto.role, mustChangePassword: true }),
      );
      const staff = await staffRepo.save(
        staffRepo.create({
          ...fields,
          whatsapp: this.normalizeWhatsapp(dto.whatsapp),
          houseId: dto.houseId ?? null,
          supportGroupId: dto.supportGroupId ?? null,
          rank: dto.role === Role.SERVANT ? (dto.rank ?? null) : null,
          userId: savedUser.id,
        }),
      );
      await openServicePeriod(m, {
        staffId: staff.id,
        houseId: staff.houseId ?? null,
        startDate: todayInSaoPaulo(),
      });
      return staff;
    });
  }

  /** Story 199 — escrita no servo (ficha + User ligado) com antes/depois. */
  private trackStaff<R>(
    id: string | undefined,
    action: string,
    write: (manager: EntityManager) => Promise<R>,
    extra: Partial<TrackOptions<R>> = {},
  ): Promise<R> {
    return this.audit.track<R>({
      action,
      targetType: AuditTargetType.STAFF,
      targetId: id,
      fields: STAFF_AUDIT_FIELDS,
      load: loadStaffSnapshot,
      lockTable: id ? 'staff' : undefined,
      resolveId: (result) => (result as unknown as Staff).id,
      write,
      ...extra,
    });
  }

  existsForFormerResident(residentId: string): Promise<boolean> {
    return this.staffRepository.exists({ where: { formerResidentId: residentId } });
  }

  // Cria um Staff a partir de um Resident promovido a servo. O User já foi
  // resolvido (reaproveitado ou criado) pelo ResidentService. Story 216: o
  // período de serviço aberto (início = promoção, casa do staff) é gravado na
  // mesma transação — falha nele desfaz a criação do staff.
  createFromResident(params: {
    name: string;
    whatsapp: string | null;
    houseId: string | null;
    photoUrl: string | null;
    userId: string;
    formerResidentId: string;
    rank: ServantRank;
    promotedAt: string;
  }): Promise<Staff> {
    return this.staffRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Staff);
      const staff = await repo.save(
        repo.create({
          name: params.name,
          whatsapp: this.normalizeWhatsapp(params.whatsapp),
          houseId: params.houseId,
          photoUrl: params.photoUrl,
          userId: params.userId,
          formerResidentId: params.formerResidentId,
          rank: params.rank,
          promotedAt: params.promotedAt,
        }),
      );
      await openServicePeriod(manager, {
        staffId: staff.id,
        houseId: params.houseId,
        startDate: params.promotedAt,
      });
      return staff;
    });
  }

  // ─── Coordenador titular da casa (story 194) ─────────────────────────────────

  /**
   * Zera `houses.coordinator_id` quando a transição tira este staff da lista de
   * coordenadores da casa (story 194, decisão 6). O `ON DELETE SET NULL` da FK
   * só dispara em DELETE físico e o projeto usa `deleted_at`, então quem limpa é
   * o service — na mesma transação da alteração do staff.
   *
   * Só escreve se alguma casa de fato aponta para ele: staff comum não pode
   * gerar UPDATE em `houses` a cada troca de casa.
   */
  private async clearTitular(staffId: string, manager: EntityManager): Promise<void> {
    const holders = await manager.count(House, { where: { coordinatorId: staffId } });
    if (!holders) return;
    await manager.update(House, { coordinatorId: staffId }, { coordinatorId: null });
  }

  /**
   * Repositórios da escrita: os injetados fora de transação; os do `manager`
   * quando a mudança precisa ser atômica com a limpeza do titular.
   */
  private writers(manager?: EntityManager) {
    return {
      staff: manager ? manager.getRepository(Staff) : this.staffRepository,
      user: manager ? manager.getRepository(User) : this.userRepository,
    };
  }

  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.findOne(id);
    assertAdultBirthDate(dto.birthDate, staff.birthDate);

    const { email, role, password, ...staffFields } = dto;
    if (staffFields.whatsapp !== undefined) {
      staffFields.whatsapp = this.normalizeWhatsapp(staffFields.whatsapp);
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

    // Story 194, decisão 6: só duas transições do update tiram o staff da lista
    // de coordenadores da casa — mudar de casa e deixar de ser coordenador da
    // casa (story 214: role fora de COORDINATOR | ADMIN; trocar COORDINATOR ↔
    // ADMIN mantém o titular). Trocar telefone/nome/e-mail do titular NÃO pode
    // derrubar a coluna.
    const leavesHouse =
      staffFields.houseId !== undefined && staffFields.houseId !== staff.houseId;
    const leavesCoordinatorRole = role !== undefined && !isHouseCoordinatorRole(role);
    const dropsTitular = leavesHouse || leavesCoordinatorRole;

    // Uma transação só (story 199): ficha, User, limpeza do titular e evento.
    await this.trackStaff(id, AuditAction.STAFF_UPDATE, async (manager) => {
      const repos = this.writers(manager);
      if (Object.keys(staffFields).length) await repos.staff.update(id, staffFields);
      if (Object.keys(userUpdates).length) await repos.user.update(staff.userId, userUpdates);
      if (dropsTitular) await this.clearTitular(id, manager);
    });

    return this.findOne(id);
  }

  async uploadPhoto(id: string, file: Express.Multer.File): Promise<Staff> {
    const staff = await this.findOne(id);
    if (staff.photoUrl) {
      await this.storageService.delete(staff.photoUrl);
    }
    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('staff', filename, file.buffer, file.mimetype);
    await this.trackStaff(id, AuditAction.STAFF_PHOTO_UPDATE, (m) =>
      m.getRepository(Staff).update(id, { photoUrl: url }),
    );
    return this.findOne(id);
  }

  async updateMe(userId: string, dto: UpdateStaffMeDto): Promise<Staff> {
    const staff = await this.findByUserId(userId);
    const { email, ...staffFields } = dto;
    if (staffFields.whatsapp !== undefined) {
      staffFields.whatsapp = this.normalizeWhatsapp(staffFields.whatsapp);
    }

    // Conflito de e-mail é checado ANTES de gravar: recusa não deixa meia edição.
    if (email !== undefined) {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing && existing.id !== staff.userId) throw new ConflictException('E-mail já cadastrado');
    }

    await this.trackStaff(staff.id, AuditAction.STAFF_SELF_UPDATE, async (m) => {
      if (Object.keys(staffFields).length) {
        await m.getRepository(Staff).update(staff.id, staffFields);
      }
      if (email !== undefined) await m.getRepository(User).update(staff.userId, { email });
    });

    return this.findByUserId(userId);
  }

  async uploadPhotoMe(userId: string, file: Express.Multer.File): Promise<Staff> {
    const staff = await this.findByUserId(userId);
    return this.uploadPhoto(staff.id, file);
  }

  // Story 128 — assinatura desenhada no perfil. Espelha uploadPhoto: apaga o
  // arquivo anterior (decisão 8 — redesenhar substitui) e grava a URL CANÔNICA
  // (regra da story 76); a assinatura de acesso é aplicada só na leitura.
  async uploadSignature(id: string, file: Express.Multer.File): Promise<Staff> {
    const staff = await this.findOne(id);
    if (staff.signatureUrl) {
      await this.storageService.delete(staff.signatureUrl);
    }
    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('signatures', filename, file.buffer, file.mimetype);
    await this.trackStaff(id, AuditAction.STAFF_SIGNATURE_UPDATE, (m) =>
      m.getRepository(Staff).update(id, { signatureUrl: url }),
    );
    return this.findOne(id);
  }

  async uploadSignatureMe(userId: string, file: Express.Multer.File): Promise<Staff> {
    const staff = await this.findByUserId(userId);
    return this.uploadSignature(staff.id, file);
  }

  // Story 138 — remove a assinatura do próprio perfil. Espelha uploadSignature:
  // apaga o arquivo (bucket ou /uploads) se existir e zera a URL. Idempotente:
  // sem assinatura é no-op e devolve o staff como está.
  async removeSignature(id: string): Promise<Staff> {
    const staff = await this.findOne(id);
    if (staff.signatureUrl) {
      await this.storageService.delete(staff.signatureUrl);
      await this.trackStaff(id, AuditAction.STAFF_SIGNATURE_REMOVE, (m) =>
        m.getRepository(Staff).update(id, { signatureUrl: null }),
      );
    }
    return this.findOne(id);
  }

  async removeSignatureMe(userId: string): Promise<Staff> {
    const staff = await this.findByUserId(userId);
    return this.removeSignature(staff.id);
  }

  async remove(id: string): Promise<void> {
    const staff = await this.findOne(id);
    // Story 194, decisão 6: o desligamento tira o staff da lista de
    // coordenadores; a casa não pode continuar exibindo-o como titular.
    await this.trackStaff(
      id,
      AuditAction.STAFF_DELETE,
      async (manager) => {
        const repos = this.writers(manager);
        await repos.user.update(staff.userId, { isActive: false });
        await repos.user.softDelete(staff.userId);
        await repos.staff.softDelete(id);
        await this.clearTitular(id, manager);
      },
      { fields: STAFF_DELETE_AUDIT_FIELDS },
    );
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
    return this.trackPermission(undefined, AuditAction.STAFF_PERMISSION_GRANT, staffId, (m) => {
      const repo = m.getRepository(StaffPermission);
      return repo.save(repo.create({ staffId, permissionType: type }));
    });
  }

  async removePermission(staffId: string, type: StaffPermissionType): Promise<void> {
    const perm = await this.permissionRepository.findOne({ where: { staffId, permissionType: type } });
    if (!perm) throw new NotFoundException('Permissão não encontrada');
    await this.trackPermission(perm.id, AuditAction.STAFF_PERMISSION_REVOKE, staffId, (m) =>
      m.getRepository(StaffPermission).delete(perm.id),
    );
  }

  private trackPermission<R>(
    id: string | undefined,
    action: string,
    staffId: string,
    write: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    return this.audit.track<R>({
      action,
      targetType: AuditTargetType.STAFF_PERMISSION,
      targetId: id,
      fields: STAFF_PERMISSION_AUDIT_FIELDS,
      load: loadById(StaffPermission),
      resolveId: (result) => (result as unknown as StaffPermission).id,
      scope: () => ({ parentType: AuditTargetType.STAFF, parentId: staffId }),
      write,
    });
  }

  async hasPermission(staffId: string, type: StaffPermissionType): Promise<boolean> {
    const count = await this.permissionRepository.count({ where: { staffId, permissionType: type } });
    return count > 0;
  }
}
