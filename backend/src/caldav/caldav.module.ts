import { Module } from '@nestjs/common';
import { CalDavController } from './caldav.controller';

@Module({
  controllers: [CalDavController],
})
export class CalDavModule {}
