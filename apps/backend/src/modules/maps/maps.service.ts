import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlacesAutocompleteSuggestion {
  id: string;
  placeId: string;
  primaryText: string;
  secondaryText: string;
  address: string;
}

export interface PlaceDetailsResult {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
  name?: string;
}

export interface RouteDetailsResult {
  source: 'google';
  keyConfigured: boolean;
  status?: string;
  message?: string;
  route?: {
    distanceMeters: number;
    durationSeconds: number;
    polyline: Array<{ lat: number; lng: number }>;
  };
}

interface SuggestionResult {
  status?: string;
  message?: string;
  suggestions: PlacesAutocompleteSuggestion[];
}

@Injectable()
export class MapsService {
  constructor(private readonly configService: ConfigService) {}

  private static readonly AUTOCOMPLETE_TIMEOUT_MS = 1800;
  private static readonly AUTOCOMPLETE_RADIUS_METERS = 20000;

  private get googleMapsApiKey() {
    return this.configService.get<string>('googleMapsApiKey') ?? '';
  }

  private get hasKey() {
    return Boolean(this.googleMapsApiKey);
  }

  private decodePolyline(encoded: string) {
    const points: Array<{ lat: number; lng: number }> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length + 1);

      const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length + 1);

      const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      points.push({
        lat: lat / 1e5,
        lng: lng / 1e5
      });
    }

    return points;
  }

  private parseDurationSeconds(value?: string | number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.round(value);
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const parsed = Number(value.replace(/s$/, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mergeAutocompleteSuggestions(
    primary: PlacesAutocompleteSuggestion[],
    secondary: PlacesAutocompleteSuggestion[]
  ) {
    const seen = new Set<string>();
    const merged: PlacesAutocompleteSuggestion[] = [];

    for (const entry of [...primary, ...secondary]) {
      if (!entry.placeId || seen.has(entry.placeId)) {
        continue;
      }

      seen.add(entry.placeId);
      merged.push(entry);

      if (merged.length >= 8) {
        break;
      }
    }

    return merged;
  }

  private async autocompleteLegacy(input: {
    query: string;
    lat?: number;
    lng?: number;
    sessionToken?: string;
    countryCode: string;
  }): Promise<SuggestionResult> {
    const params = new URLSearchParams({
      input: input.query,
      key: this.googleMapsApiKey,
      language: 'en',
      components: `country:${input.countryCode.toLowerCase()}`,
      strictbounds: 'false',
      types: 'geocode'
    });

    if (input.sessionToken?.trim()) {
      params.set('sessiontoken', input.sessionToken.trim());
    }

    if (typeof input.lat === 'number' && typeof input.lng === 'number') {
      params.set('location', `${input.lat},${input.lng}`);
      params.set('radius', String(MapsService.AUTOCOMPLETE_RADIUS_METERS));
    }

    const response = await this.fetchWithTimeout(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      },
      MapsService.AUTOCOMPLETE_TIMEOUT_MS
    );

    if (!response) {
      return {
        status: 'TIMEOUT',
        message: 'Google Places autocomplete timed out',
        suggestions: []
      };
    }

    if (!response.ok) {
      return {
        status: `HTTP_${response.status}`,
        message: `Google Places autocomplete failed: ${response.status}`,
        suggestions: []
      };
    }

    const payload = (await response.json()) as {
      status?: string;
      error_message?: string;
      predictions?: Array<{
        description?: string;
        place_id?: string;
        structured_formatting?: {
          main_text?: string;
          secondary_text?: string;
        };
      }>;
    };

    const suggestions = (payload.predictions ?? [])
      .map((entry, index) => {
        const placeId = entry.place_id?.trim();
        const address = entry.description?.trim();

        if (!placeId || !address) {
          return null;
        }

        const primary = entry.structured_formatting?.main_text?.trim() || address.split(',')[0] || address;
        const secondary = entry.structured_formatting?.secondary_text?.trim() || address;

        return {
          id: `${placeId}-${index}`,
          placeId,
          primaryText: primary,
          secondaryText: secondary,
          address
        } satisfies PlacesAutocompleteSuggestion;
      })
      .filter((entry): entry is PlacesAutocompleteSuggestion => entry !== null)
      .slice(0, 8);

    return {
      status: payload.status,
      message: payload.error_message,
      suggestions
    };
  }

  private async autocompleteNew(input: {
    query: string;
    lat?: number;
    lng?: number;
    sessionToken?: string;
    countryCode: string;
  }): Promise<SuggestionResult> {
    const body: Record<string, unknown> = {
      input: input.query,
      languageCode: 'en',
      regionCode: input.countryCode.toUpperCase(),
      includeQueryPredictions: false
    };

    if (input.sessionToken?.trim()) {
      body.sessionToken = input.sessionToken.trim();
    }

    if (typeof input.lat === 'number' && typeof input.lng === 'number') {
      body.locationBias = {
        circle: {
          center: {
            latitude: input.lat,
            longitude: input.lng
          },
          radius: MapsService.AUTOCOMPLETE_RADIUS_METERS
        }
      };
      body.origin = {
        latitude: input.lat,
        longitude: input.lng
      };
    }

    const response = await this.fetchWithTimeout(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.googleMapsApiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text'
        },
        body: JSON.stringify(body)
      },
      MapsService.AUTOCOMPLETE_TIMEOUT_MS
    );

    if (!response) {
      return {
        status: 'TIMEOUT',
        message: 'Google Places autocomplete timed out',
        suggestions: []
      };
    }

    if (!response.ok) {
      return {
        status: `HTTP_${response.status}`,
        message: `Google Places (new) autocomplete failed: ${response.status}`,
        suggestions: []
      };
    }

    const payload = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
        };
      }>;
    };

    const suggestions = (payload.suggestions ?? [])
      .map((entry, index) => {
        const place = entry.placePrediction;
        const placeId = place?.placeId?.trim();
        const fullText = place?.text?.text?.trim();
        if (!placeId || !fullText) {
          return null;
        }

        return {
          id: `${placeId}-${index}`,
          placeId,
          primaryText: place?.structuredFormat?.mainText?.text?.trim() || fullText.split(',')[0] || fullText,
          secondaryText: place?.structuredFormat?.secondaryText?.text?.trim() || fullText,
          address: fullText
        } satisfies PlacesAutocompleteSuggestion;
      })
      .filter((entry): entry is PlacesAutocompleteSuggestion => entry !== null)
      .slice(0, 8);

    return {
      status: 'OK',
      suggestions
    };
  }

  async autocomplete(input: {
    query: string;
    lat?: number;
    lng?: number;
    sessionToken?: string;
    countryCode?: string;
  }) {
    const trimmed = input.query.trim();
    if (trimmed.length < 2) {
      return {
        source: 'google',
        suggestions: [] as PlacesAutocompleteSuggestion[],
        keyConfigured: this.hasKey
      };
    }

    if (!this.hasKey) {
      return {
        source: 'google',
        suggestions: [] as PlacesAutocompleteSuggestion[],
        keyConfigured: false,
        message: 'GOOGLE_MAPS_API_KEY missing'
      };
    }

    const countryCode = (input.countryCode ?? 'IN').toUpperCase();
    const [modern, legacy] = await Promise.all([
      this.autocompleteNew({
        query: trimmed,
        lat: input.lat,
        lng: input.lng,
        sessionToken: input.sessionToken,
        countryCode
      }),
      this.autocompleteLegacy({
        query: trimmed,
        lat: input.lat,
        lng: input.lng,
        sessionToken: input.sessionToken,
        countryCode
      })
    ]);

    const preferred =
      modern.suggestions.length > 0 ? modern : legacy.suggestions.length > 0 ? legacy : modern;
    const secondary = preferred === modern ? legacy : modern;
    const mergedSuggestions = this.mergeAutocompleteSuggestions(
      preferred.suggestions,
      secondary.suggestions
    );

    return {
      source: 'google',
      keyConfigured: true,
      status: preferred.status ?? secondary.status ?? 'UNKNOWN',
      message: preferred.message ?? secondary.message,
      suggestions: mergedSuggestions
    };
  }

  async placeDetails(placeId: string): Promise<PlaceDetailsResult | null> {
    const id = placeId.trim();
    if (!id || !this.hasKey) {
      return null;
    }

    const legacyParams = new URLSearchParams({
      place_id: id,
      key: this.googleMapsApiKey,
      fields: 'place_id,formatted_address,geometry/location,name',
      language: 'en'
    });

    try {
      const legacyResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${legacyParams.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          }
        }
      );

      if (legacyResponse.ok) {
        const payload = (await legacyResponse.json()) as {
          result?: {
            place_id?: string;
            formatted_address?: string;
            name?: string;
            geometry?: {
              location?: {
                lat?: number;
                lng?: number;
              };
            };
          };
        };

        const lat = payload.result?.geometry?.location?.lat;
        const lng = payload.result?.geometry?.location?.lng;
        if (typeof lat === 'number' && typeof lng === 'number') {
          return {
            placeId: payload.result?.place_id ?? id,
            address: payload.result?.formatted_address ?? payload.result?.name ?? id,
            lat,
            lng,
            name: payload.result?.name
          };
        }
      }
    } catch {
      // Fallback to Places API (new).
    }

    try {
      const modernResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=en`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Goog-Api-Key': this.googleMapsApiKey,
          'X-Goog-FieldMask': 'id,displayName.text,formattedAddress,location'
        }
      });

      if (!modernResponse.ok) {
        return null;
      }

      const payload = (await modernResponse.json()) as {
        id?: string;
        formattedAddress?: string;
        displayName?: { text?: string };
        location?: { latitude?: number; longitude?: number };
      };

      const lat = payload.location?.latitude;
      const lng = payload.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
      }

      return {
        placeId: payload.id ?? id,
        address: payload.formattedAddress ?? payload.displayName?.text ?? id,
        lat,
        lng,
        name: payload.displayName?.text
      };
    } catch {
      return null;
    }
  }

  async route(input: {
    originLat: number;
    originLng: number;
    destinationLat: number;
    destinationLng: number;
  }): Promise<RouteDetailsResult> {
    if (!this.hasKey) {
      return {
        source: 'google',
        keyConfigured: false,
        message: 'GOOGLE_MAPS_API_KEY missing'
      };
    }

    const params = new URLSearchParams({
      origin: `${input.originLat},${input.originLng}`,
      destination: `${input.destinationLat},${input.destinationLng}`,
      mode: 'driving',
      alternatives: 'false',
      departure_time: 'now',
      key: this.googleMapsApiKey
    });

    try {
      const legacyResponse = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      if (legacyResponse.ok) {
        const payload = (await legacyResponse.json()) as {
          status?: string;
          error_message?: string;
          routes?: Array<{
            overview_polyline?: {
              points?: string;
            };
            legs?: Array<{
              distance?: { value?: number };
              duration?: { value?: number };
              duration_in_traffic?: { value?: number };
            }>;
          }>;
        };

        const route = payload.routes?.[0];
        const leg = route?.legs?.[0];
        const encodedPolyline = route?.overview_polyline?.points;

        if (route && encodedPolyline) {
          const distanceMeters = Number(leg?.distance?.value ?? 0);
          const durationSeconds = Number(leg?.duration_in_traffic?.value ?? leg?.duration?.value ?? 0);

          return {
            source: 'google',
            keyConfigured: true,
            status: payload.status ?? 'OK',
            message: payload.error_message,
            route: {
              distanceMeters,
              durationSeconds,
              polyline: this.decodePolyline(encodedPolyline)
            }
          };
        }
      }
    } catch {
      // Fallback to Routes API (new).
    }

    try {
      const modernResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.googleMapsApiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: {
                latitude: input.originLat,
                longitude: input.originLng
              }
            }
          },
          destination: {
            location: {
              latLng: {
                latitude: input.destinationLat,
                longitude: input.destinationLng
              }
            }
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          polylineQuality: 'HIGH_QUALITY',
          units: 'METRIC',
          languageCode: 'en-US'
        })
      });

      if (!modernResponse.ok) {
        return {
          source: 'google',
          keyConfigured: true,
          status: `HTTP_${modernResponse.status}`,
          message: `Google Routes API failed: ${modernResponse.status}`
        };
      }

      const payload = (await modernResponse.json()) as {
        routes?: Array<{
          distanceMeters?: number;
          duration?: string;
          polyline?: {
            encodedPolyline?: string;
          };
        }>;
      };

      const route = payload.routes?.[0];
      const encodedPolyline = route?.polyline?.encodedPolyline;
      if (!route || !encodedPolyline) {
        return {
          source: 'google',
          keyConfigured: true,
          status: 'ZERO_RESULTS',
          message: 'No route found'
        };
      }

      return {
        source: 'google',
        keyConfigured: true,
        status: 'OK',
        route: {
          distanceMeters: Number(route.distanceMeters ?? 0),
          durationSeconds: this.parseDurationSeconds(route.duration),
          polyline: this.decodePolyline(encodedPolyline)
        }
      };
    } catch {
      return {
        source: 'google',
        keyConfigured: true,
        status: 'ERROR',
        message: 'Could not fetch route from Google APIs'
      };
    }
  }
}
