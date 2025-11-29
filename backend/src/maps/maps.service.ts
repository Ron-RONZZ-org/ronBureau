import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreatePlaceDto {
  name: string;
  lon: number;
  lat: number;
  icon?: string;
  color?: string;
  geojson?: string;
}

interface UpdatePlaceDto {
  name?: string;
  lon?: number;
  lat?: number;
  icon?: string;
  color?: string;
  geojson?: string;
}

interface CreateRouteDto {
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
}

interface UpdateRouteDto {
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
}

@Injectable()
export class MapsService {
  constructor(private prisma: PrismaService) {}

  // Saved Places
  async createPlace(userId: string, data: CreatePlaceDto) {
    return this.prisma.savedPlace.create({
      data: {
        userId,
        name: data.name,
        lon: data.lon,
        lat: data.lat,
        icon: data.icon || '📍',
        color: data.color || '#ef4444',
        geojson: data.geojson,
      },
    });
  }

  async getPlaces(userId: string) {
    return this.prisma.savedPlace.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePlace(userId: string, placeId: string, data: UpdatePlaceDto) {
    const place = await this.prisma.savedPlace.findFirst({
      where: { id: placeId, userId },
    });
    if (!place) {
      throw new NotFoundException('Place not found');
    }
    return this.prisma.savedPlace.update({
      where: { id: placeId },
      data,
    });
  }

  async deletePlace(userId: string, placeId: string) {
    const place = await this.prisma.savedPlace.findFirst({
      where: { id: placeId, userId },
    });
    if (!place) {
      throw new NotFoundException('Place not found');
    }
    return this.prisma.savedPlace.delete({
      where: { id: placeId },
    });
  }

  async deleteAllPlaces(userId: string) {
    return this.prisma.savedPlace.deleteMany({
      where: { userId },
    });
  }

  // Saved Routes
  async createRoute(userId: string, data: CreateRouteDto) {
    return this.prisma.savedRoute.create({
      data: {
        userId,
        name: data.name,
        originName: data.originName,
        originLon: data.originLon,
        originLat: data.originLat,
        destName: data.destName,
        destLon: data.destLon,
        destLat: data.destLat,
        stops: data.stops,
        distance: data.distance,
        duration: data.duration,
        coordinates: data.coordinates,
        geojson: data.geojson,
      },
    });
  }

  async getRoutes(userId: string) {
    return this.prisma.savedRoute.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRoute(userId: string, routeId: string, data: UpdateRouteDto) {
    const route = await this.prisma.savedRoute.findFirst({
      where: { id: routeId, userId },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return this.prisma.savedRoute.update({
      where: { id: routeId },
      data,
    });
  }

  async deleteRoute(userId: string, routeId: string) {
    const route = await this.prisma.savedRoute.findFirst({
      where: { id: routeId, userId },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return this.prisma.savedRoute.delete({
      where: { id: routeId },
    });
  }

  async deleteAllRoutes(userId: string) {
    return this.prisma.savedRoute.deleteMany({
      where: { userId },
    });
  }

  // Map Preferences
  async getMapPreferences(userUuid: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userUuid },
      include: { preferences: true },
    });
    if (!user?.preferences?.mapPreferences) {
      return {
        placeMarkerColor: '#ef4444',
        routeColor: '#22c55e',
      };
    }
    try {
      return JSON.parse(user.preferences.mapPreferences);
    } catch {
      return {
        placeMarkerColor: '#ef4444',
        routeColor: '#22c55e',
      };
    }
  }

  async updateMapPreferences(userUuid: string, preferences: { placeMarkerColor?: string; routeColor?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userUuid } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const mapPreferencesJson = JSON.stringify(preferences);

    return this.prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: {
        mapPreferences: mapPreferencesJson,
      },
      create: {
        userId: user.id,
        mapPreferences: mapPreferencesJson,
      },
    });
  }
}
