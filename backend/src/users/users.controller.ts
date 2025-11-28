import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return this.usersService.findByUserId(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('preferences')
  async getPreferences(@Request() req) {
    return this.usersService.getPreferences(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('preferences')
  async updatePreferences(
    @Request() req,
    @Body() body: { theme?: string; datetimeFormat?: string },
  ) {
    return this.usersService.updatePreferences(
      req.user.userId,
      body.theme,
      body.datetimeFormat,
    );
  }
}
