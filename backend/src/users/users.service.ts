import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    return this.prisma.user.findUnique({
      where: { userId },
      include: { preferences: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { preferences: true },
    });
  }

  async updatePreferences(userId: string, theme?: string, datetimeFormat?: string) {
    const user = await this.prisma.user.findUnique({ where: { userId } });
    if (!user) throw new Error('User not found');

    return this.prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: {
        ...(theme !== undefined && { theme }),
        ...(datetimeFormat !== undefined && { datetimeFormat }),
      },
      create: {
        userId: user.id,
        theme: theme || 'light',
        datetimeFormat: datetimeFormat || 'ISO',
      },
    });
  }

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({ 
      where: { userId },
      include: { preferences: true },
    });
    return user?.preferences || { theme: 'light', datetimeFormat: 'ISO' };
  }
}
