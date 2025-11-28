import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      include: { preferences: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.accountValidUntil && new Date() > user.accountValidUntil) {
      throw new UnauthorizedException('Account has expired');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _, ...result } = user;
    return result;
  }

  async login(userId: string, password: string) {
    const user = await this.validateUser(userId, password);
    const payload = { 
      sub: user.id, 
      userId: user.userId, 
      userType: user.userType 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        userId: user.userId,
        displayName: user.displayName,
        userType: user.userType,
        organizationId: user.organizationId,
        preferences: user.preferences,
      },
    };
  }
}
