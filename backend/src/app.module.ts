import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { MapsModule } from './maps/maps.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, MapsModule],
})
export class AppModule {}
