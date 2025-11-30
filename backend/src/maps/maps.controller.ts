import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MapsService } from './maps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('maps')
@UseGuards(JwtAuthGuard)
export class MapsController {
  constructor(private mapsService: MapsService) {}

  // Place Lists endpoints
  @Post('place-lists')
  async createPlaceList(
    @Request() req,
    @Body() body: { name: string; description?: string },
  ) {
    return this.mapsService.createPlaceList(req.user.id, body);
  }

  @Get('place-lists')
  async getPlaceLists(@Request() req) {
    return this.mapsService.getPlaceLists(req.user.id);
  }

  @Get('place-lists/:id')
  async getPlaceList(@Request() req, @Param('id') id: string) {
    return this.mapsService.getPlaceList(req.user.id, id);
  }

  @Put('place-lists/:id')
  async updatePlaceList(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.mapsService.updatePlaceList(req.user.id, id, body);
  }

  @Delete('place-lists/:id')
  async deletePlaceList(@Request() req, @Param('id') id: string) {
    return this.mapsService.deletePlaceList(req.user.id, id);
  }

  // Route Lists endpoints
  @Post('route-lists')
  async createRouteList(
    @Request() req,
    @Body() body: { name: string; description?: string },
  ) {
    return this.mapsService.createRouteList(req.user.id, body);
  }

  @Get('route-lists')
  async getRouteLists(@Request() req) {
    return this.mapsService.getRouteLists(req.user.id);
  }

  @Get('route-lists/:id')
  async getRouteList(@Request() req, @Param('id') id: string) {
    return this.mapsService.getRouteList(req.user.id, id);
  }

  @Put('route-lists/:id')
  async updateRouteList(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.mapsService.updateRouteList(req.user.id, id, body);
  }

  @Delete('route-lists/:id')
  async deleteRouteList(@Request() req, @Param('id') id: string) {
    return this.mapsService.deleteRouteList(req.user.id, id);
  }

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
      listId?: string;
    },
  ) {
    return this.mapsService.createPlace(req.user.id, body);
  }

  @Get('places')
  async getPlaces(@Request() req, @Query('listId') listId?: string) {
    return this.mapsService.getPlaces(req.user.id, listId);
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
      listId?: string | null;
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
      listId?: string;
    },
  ) {
    return this.mapsService.createRoute(req.user.id, body);
  }

  @Get('routes')
  async getRoutes(@Request() req, @Query('listId') listId?: string) {
    return this.mapsService.getRoutes(req.user.id, listId);
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
      listId?: string | null;
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
