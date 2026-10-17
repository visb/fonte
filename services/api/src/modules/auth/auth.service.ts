import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginFailureReason, Role, ProfileType } from '@fonte/types';
import { noteLoginAttempt } from '../audit/audit-context';
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
    const { user, reason } = await this.resolveUser(dto.identifier);

    // Story 199: o motivo vai só para a auditoria (contexto da requisição); a
    // resposta ao cliente continua a mesma em todos os casos.
    if (!user) return this.reject(reason ?? LoginFailureReason.UNKNOWN_IDENTIFIER);
    if (!user.isActive) return this.reject(LoginFailureReason.INACTIVE_USER);

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) return this.reject(LoginFailureReason.INVALID_CREDENTIALS);

    noteLoginAttempt({ userId: user.id, role: user.role, reason: null });
    const profileType = this.resolveProfileType(user.role);
    return { accessToken: this.signToken(user.id, user.role, user.mustChangePassword), profileType };
  }

  private reject(reason: LoginFailureReason): never {
    noteLoginAttempt({ userId: null, role: null, reason });
    throw new UnauthorizedException('Credenciais inválidas');
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
  private async resolveUser(rawIdentifier: string): Promise<{
    user: Awaited<ReturnType<UserService['findById']>>;
    reason: LoginFailureReason | null;
  }> {
    const identifier = rawIdentifier.trim();

    if (identifier.includes('@')) {
      return { user: await this.userService.findByEmail(identifier), reason: null };
    }

    const digits = identifier.replace(/\D/g, '');
    if (!digits) return { user: null, reason: LoginFailureReason.UNKNOWN_IDENTIFIER };

    const userIds = await this.userService.findActiveUserIdsByPhone(digits);
    // 0 = não encontrado; >1 = ambíguo
    if (userIds.length > 1) return { user: null, reason: LoginFailureReason.AMBIGUOUS_IDENTIFIER };
    if (userIds.length === 0) return { user: null, reason: LoginFailureReason.UNKNOWN_IDENTIFIER };

    return { user: await this.userService.findById(userIds[0]), reason: null };
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
