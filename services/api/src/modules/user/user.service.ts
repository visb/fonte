import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /**
   * Resolve um número (apenas dígitos) para os IDs de usuário com acesso, varrendo os perfis
   * staff (whatsapp — story 97) / relatives (phone) / residents (contact_phone). O número não
   * é único entre perfis: pode retornar 0, 1 ou mais. Quem decide o que fazer com ambiguidade
   * é o AuthService (rejeita >1).
   */
  async findActiveUserIdsByPhone(digits: string): Promise<string[]> {
    const rows: { user_id: string }[] = await this.userRepository.manager.query(
      `SELECT DISTINCT user_id FROM (
         SELECT user_id, whatsapp AS phone FROM staff WHERE deleted_at IS NULL
         UNION ALL
         SELECT user_id, phone FROM relatives WHERE deleted_at IS NULL
         UNION ALL
         SELECT user_id, contact_phone AS phone FROM residents WHERE deleted_at IS NULL
       ) p
       WHERE user_id IS NOT NULL
         AND p.phone IS NOT NULL
         AND regexp_replace(p.phone, '\\D', '', 'g') = $1`,
      [digits],
    );
    return rows.map((r) => r.user_id);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(userId, { passwordHash, mustChangePassword: false });
  }
}
