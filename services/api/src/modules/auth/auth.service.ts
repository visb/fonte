import { Injectable, UnauthorizedException } from '@nestjs/common';
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

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      profileType: this.resolveProfileType(user.role),
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  private resolveProfileType(role: Role): ProfileType {
    if (role === Role.RELATIVE) return ProfileType.RELATIVE;
    if (role === Role.RESIDENT) return ProfileType.RESIDENT;
    return ProfileType.STAFF;
  }
}
