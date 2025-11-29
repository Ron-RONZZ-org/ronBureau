import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MapsService } from './maps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('maps')
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(private mapsService: MapsService) {}

  // Saved Places endpoints
  @Post('places')
  async createPlace(
    @Request() req,
    @Body()
    body: {
      name: string;
      lon: number;
      lat: number;
      icon?: string;
      color?: string;
      geojson?: string;
    },
  ) {
    return this.mapsService.createPlace(req.user.id, body);
  }

  @Get('places')
  async getPlaces(@Request() req) {
    return this.mapsService.getPlaces(req.user.id);
  }

  @Put('places/:id')
  async updatePlace(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      lon?: number;
      lat?: number;
      icon?: string;
      color?: string;
      geojson?: string;
    },
  ) {
    return this.mapsService.updatePlace(req.user.id, id, body);
  }

  @Delete('places/:id')
  async deletePlace(@Request() req, @Param('id') id: string) {
    return this.mapsService.deletePlace(req.user.id, id);
  }

  @Delete('places')
  async deleteAllPlaces(@Request() req) {
    return this.mapsService.deleteAllPlaces(req.user.id);
  }

  // Saved Routes endpoints
  @Post('routes')
  async createRoute(
    @Request() req,
    @Body()
    body: {
      name: string;
      originName: string;
      originLon: number;
      originLat: number;
      destName: string;
      destLon: number;
      destLat: number;
      stops?: string;
      distance: string;
      duration: string;
      coordinates: string;
      geojson?: string;
    },
  ) {
    return this.mapsService.createRoute(req.user.id, body);
  }

  @Get('routes')
  async getRoutes(@Request() req) {
    return this.mapsService.getRoutes(req.user.id);
  }

  @Put('routes/:id')
  async updateRoute(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      originName?: string;
      originLon?: number;
      originLat?: number;
      destName?: string;
      destLon?: number;
      destLat?: number;
      stops?: string;
      distance?: string;
      duration?: string;
      coordinates?: string;
      geojson?: string;
    },
  ) {
    return this.mapsService.updateRoute(req.user.id, id, body);
  }

  @Delete('routes/:id')
  async deleteRoute(@Request() req, @Param('id') id: string) {
    return this.mapsService.deleteRoute(req.user.id, id);
  }

  @Delete('routes')
  async deleteAllRoutes(@Request() req) {
    return this.mapsService.deleteAllRoutes(req.user.id);
  }

  // Map Preferences endpoints
  @Get('preferences')
  async getMapPreferences(@Request() req) {
    return this.mapsService.getMapPreferences(req.user.id);
  }

  @Put('preferences')
  async updateMapPreferences(
    @Request() req,
    @Body() body: { placeMarkerColor?: string; routeColor?: string },
  ) {
    return this.mapsService.updateMapPreferences(req.user.id, body);
  }
}
