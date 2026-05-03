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

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.userService.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return { accessToken: this.signToken(user.id, user.role, user.mustChangePassword) };
  }

  async changePassword(userId: string, newPassword: string): Promise<{ accessToken: string }> {
    const user = await this.userService.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const hash = await bcrypt.hash(newPassword, 10);
    await this.userService.updatePassword(userId, hash);

    return { accessToken: this.signToken(userId, user.role, false) };
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
