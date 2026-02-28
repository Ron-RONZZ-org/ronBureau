import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { MapsModule } from './maps/maps.module';
import { CalDavModule } from './caldav/caldav.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, MapsModule, CalDavModule],
})
export class AppModule {}
