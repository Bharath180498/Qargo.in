import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { MapsService } from './maps.service';

@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('places/autocomplete')
  autocomplete(
    @Query('input') input?: string,
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
    @Query('sessionToken') sessionToken?: string,
    @Query('countryCode') countryCode?: string
  ) {
    const query = input?.trim();
    if (!query) {
      throw new BadRequestException('input is required');
    }

    const lat = latRaw !== undefined ? Number(latRaw) : undefined;
    const lng = lngRaw !== undefined ? Number(lngRaw) : undefined;

    return this.mapsService.autocomplete({
      query,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      sessionToken,
      countryCode
    });
  }

  @Get('places/:placeId')
  async details(@Param('placeId') placeId: string) {
    const result = await this.mapsService.placeDetails(placeId);
    if (!result) {
      throw new BadRequestException('place not found');
    }

    return result;
  }

  @Get('routes')
  route(
    @Query('originLat') originLatRaw?: string,
    @Query('originLng') originLngRaw?: string,
    @Query('destinationLat') destinationLatRaw?: string,
    @Query('destinationLng') destinationLngRaw?: string
  ) {
    const originLat = Number(originLatRaw);
    const originLng = Number(originLngRaw);
    const destinationLat = Number(destinationLatRaw);
    const destinationLng = Number(destinationLngRaw);

    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destinationLat) ||
      !Number.isFinite(destinationLng)
    ) {
      throw new BadRequestException('originLat, originLng, destinationLat, destinationLng are required');
    }

    return this.mapsService.route({
      originLat,
      originLng,
      destinationLat,
      destinationLng
    });
  }
}
