import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role, ProfileType } from '@fonte/types';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; profileType: ProfileType }> {
    const user = await this.resolveUser(dto.identifier);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const profileType = this.resolveProfileType(user.role);
    return { accessToken: this.signToken(user.id, user.role, user.mustChangePassword), profileType };
  }

  async changePassword(userId: string, newPassword: string): Promise<{ accessToken: string; profileType: ProfileType }> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(userId, hash);

    const profileType = this.resolveProfileType(user.role);
    return { accessToken: this.signToken(userId, user.role, false), profileType };
  }

  /**
   * Resolve o identificador (e-mail ou telefone) para um usuário. Com '@' → e-mail; senão →
   * telefone (dígitos). Telefone que casa com >1 usuário é ambíguo → trata como não encontrado.
   */
  private async resolveUser(rawIdentifier: string) {
    const identifier = rawIdentifier.trim();

    if (identifier.includes('@')) {
      return this.userService.findByEmail(identifier);
    }

    const digits = identifier.replace(/\D/g, '');
    if (!digits) return null;

    const userIds = await this.userService.findActiveUserIdsByPhone(digits);
    if (userIds.length !== 1) return null; // 0 = não encontrado; >1 = ambíguo

    return this.userService.findById(userIds[0]);
  }

  private signToken(userId: string, role: Role, mustChangePassword: boolean): string {
    const payload: JwtPayload = {
      sub: userId,
      role,
      profileType: this.resolveProfileType(role),
      mustChangePassword,
    };
    return this.jwtService.sign(payload);
  }

  private resolveProfileType(role: Role): ProfileType {
    if (role === Role.RELATIVE) return ProfileType.RELATIVE;
    if (role === Role.RESIDENT) return ProfileType.RESIDENT;
    return ProfileType.STAFF;
  }
}
