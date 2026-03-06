import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VehicleType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface RouteEtaInput {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  vehicleType: VehicleType;
}

export interface RouteEtaResult {
  etaMinutes: number;
  distanceKm: number;
  provider: 'google' | 'mock';
}

@Injectable()
export class RouteEtaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private get providerMode() {
    return (this.configService.get<string>('routeProvider') ?? 'mock') as 'google' | 'mock';
  }

  private get googleMapsApiKey() {
    return this.configService.get<string>('googleMapsApiKey') ?? '';
  }

  private cellKey(point: { lat: number; lng: number }) {
    return `${point.lat.toFixed(3)}:${point.lng.toFixed(3)}`;
  }

  private haversineDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private averageSpeedKmPerHour(vehicleType: VehicleType) {
    if (vehicleType === VehicleType.THREE_WHEELER) {
      return 20;
    }
    if (vehicleType === VehicleType.MINI_TRUCK) {
      return 28;
    }
    return 24;
  }

  private async estimateViaGoogle(input: RouteEtaInput): Promise<RouteEtaResult | null> {
    if (!this.googleMapsApiKey) {
      return null;
    }

    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.googleMapsApiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: input.origin.lat,
                longitude: input.origin.lng
              }
            }
          },
          destination: {
            location: {
              latLng: {
                latitude: input.destination.lat,
                longitude: input.destination.lng
              }
            }
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE'
        })
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        routes?: Array<{ duration?: string; distanceMeters?: number }>;
      };

      const route = payload.routes?.[0];
      if (!route?.duration || typeof route.distanceMeters !== 'number') {
        return null;
      }

      const durationSeconds = Number(route.duration.replace('s', ''));
      if (Number.isNaN(durationSeconds) || durationSeconds <= 0) {
        return null;
      }

      return {
        etaMinutes: Math.max(2, Math.round(durationSeconds / 60)),
        distanceKm: Number((route.distanceMeters / 1000).toFixed(2)),
        provider: 'google'
      };
    } catch {
      return null;
    }
  }

  private estimateViaMock(input: RouteEtaInput): RouteEtaResult {
    const distanceKm = this.haversineDistanceKm(input.origin, input.destination);
    const speed = this.averageSpeedKmPerHour(input.vehicleType);
    const etaMinutes = Math.max(3, Math.round((distanceKm / speed) * 60));

    return {
      etaMinutes,
      distanceKm: Number(distanceKm.toFixed(2)),
      provider: 'mock'
    };
  }

  async getEta(input: RouteEtaInput): Promise<RouteEtaResult> {
    const originCell = this.cellKey(input.origin);
    const destinationCell = this.cellKey(input.destination);

    const cached = await this.prisma.routeEtaCache.findUnique({
      where: {
        originCell_destinationCell_vehicleType: {
          originCell,
          destinationCell,
          vehicleType: input.vehicleType
        }
      }
    });

    if (cached && cached.expiresAt.getTime() > Date.now()) {
      return {
        etaMinutes: cached.etaMinutes,
        distanceKm: Number(((cached.distanceMeters ?? 0) / 1000).toFixed(2)),
        provider: cached.provider === 'google' ? 'google' : 'mock'
      };
    }

    const routeResult =
      this.providerMode === 'google'
        ? (await this.estimateViaGoogle(input)) ?? this.estimateViaMock(input)
        : this.estimateViaMock(input);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.routeEtaCache.upsert({
      where: {
        originCell_destinationCell_vehicleType: {
          originCell,
          destinationCell,
          vehicleType: input.vehicleType
        }
      },
      update: {
        provider: routeResult.provider,
        etaMinutes: routeResult.etaMinutes,
        distanceMeters: Math.round(routeResult.distanceKm * 1000),
        expiresAt
      },
      create: {
        originCell,
        destinationCell,
        vehicleType: input.vehicleType,
        provider: routeResult.provider,
        etaMinutes: routeResult.etaMinutes,
        distanceMeters: Math.round(routeResult.distanceKm * 1000),
        expiresAt
      }
    });

    return routeResult;
  }
}

