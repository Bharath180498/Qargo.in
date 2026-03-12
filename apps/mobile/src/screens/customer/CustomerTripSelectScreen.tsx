import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { InsurancePlan, VehicleType } from '@porter/shared';
import { VEHICLE_UI_META } from '@porter/shared';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { type PaymentMethod, useCustomerStore } from '../../store/useCustomerStore';
import { useSessionStore } from '../../store/useSessionStore';
import MapView, { Marker, Polyline } from '../../components/maps';
import api from '../../services/api';
import appConfig from '../../../app.json';

interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface VirtualTruckMarker {
  id: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
}

const MOBILE_GOOGLE_MAPS_API_KEY =
  typeof (
    appConfig as {
      expo?: { extra?: { googleMapsApiKey?: unknown } };
    }
  ).expo?.extra?.googleMapsApiKey === 'string'
    ? String(
        (
          appConfig as {
            expo?: { extra?: { googleMapsApiKey?: unknown } };
          }
        ).expo?.extra?.googleMapsApiKey
      ).trim()
    : '';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerTripSelect'>;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  VISA_5496: 'Visa ....5496',
  MASTERCARD_6802: 'Mastercard ....6802',
  UPI_SCAN_PAY: 'UPI Scan and Pay',
  DRIVER_UPI_DIRECT: 'Driver UPI (direct)',
  CASH: 'Cash'
};
const CARD_METHODS: PaymentMethod[] = ['VISA_5496', 'MASTERCARD_6802'];

const INSURANCE_LABELS: Record<InsurancePlan, string> = {
  NONE: 'No cover',
  BASIC: 'Basic cover',
  PREMIUM: 'Premium cover',
  HIGH_VALUE: 'High-value cover'
};

const FALLBACK_CENTER = {
  lat: 12.9716,
  lng: 77.5946
};

const MAX_CONCURRENT_RIDES = 3;
const ONGOING_ORDER_STATUSES = new Set(['CREATED', 'MATCHING', 'ASSIGNED', 'AT_PICKUP', 'LOADING', 'IN_TRANSIT']);
const CUSTOM_SCHEDULE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CUSTOM_SCHEDULE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function getVehicleSymbol(vehicleType: VehicleType) {
  if (vehicleType === 'THREE_WHEELER') {
    return '3W';
  }

  if (vehicleType === 'MINI_TRUCK') {
    return 'MT';
  }

  return 'TR';
}

function formatPromoTag(input: { cheapest: boolean; fastest: boolean; rating?: number }) {
  if (input.cheapest) {
    return { label: 'Best price', tone: 'PRICE' as const };
  }

  if (input.fastest) {
    return { label: 'Fast pickup', tone: 'SPEED' as const };
  }

  if (typeof input.rating === 'number' && input.rating >= 4.7) {
    return { label: `Top rated ${input.rating.toFixed(1)}`, tone: 'RATING' as const };
  }

  return { label: 'Standard fare', tone: 'DEFAULT' as const };
}

function estimateCompareAt(total: number, compareAtTotal?: number) {
  if (typeof compareAtTotal === 'number' && Number.isFinite(compareAtTotal) && compareAtTotal > total) {
    return compareAtTotal;
  }

  if (total > 0) {
    return total / 0.92;
  }

  return total;
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null) {
    if ('response' in error) {
      const response = (error as { response?: { data?: { message?: unknown } } }).response;
      const message = response?.data?.message;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
      if (Array.isArray(message) && typeof message[0] === 'string') {
        return message[0];
      }
    }
    if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
  }

  return fallback;
}

function buildVirtualTruckMarkers(anchor: { lat: number; lng: number }, count = 3): VirtualTruckMarker[] {
  const offsets = [
    { lat: 0.0032, lng: 0.0011 },
    { lat: -0.0026, lng: 0.0025 },
    { lat: 0.0018, lng: -0.0031 },
    { lat: -0.0034, lng: -0.0016 }
  ];

  return offsets.slice(0, count).map((offset, index) => ({
    id: `virtual-${index + 1}`,
    latitude: anchor.lat + offset.lat,
    longitude: anchor.lng + offset.lng,
    distanceKm: Math.round(Math.sqrt(offset.lat ** 2 + offset.lng ** 2) * 111 * 10) / 10
  }));
}

function defaultScheduleDateInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function defaultScheduleTimeInput() {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function parseCustomSchedule(dateInput: string, timeInput: string) {
  const normalizedDate = dateInput.trim();
  const normalizedTime = timeInput.trim();

  if (!CUSTOM_SCHEDULE_DATE_REGEX.test(normalizedDate)) {
    return {
      iso: undefined,
      error: 'Use date format YYYY-MM-DD'
    };
  }

  if (!CUSTOM_SCHEDULE_TIME_REGEX.test(normalizedTime)) {
    return {
      iso: undefined,
      error: 'Use time format HH:MM (24-hour)'
    };
  }

  const [yearStr, monthStr, dayStr] = normalizedDate.split('-');
  const [hourStr, minuteStr] = normalizedTime.split(':');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const scheduledLocal = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    Number.isNaN(scheduledLocal.getTime()) ||
    scheduledLocal.getFullYear() !== year ||
    scheduledLocal.getMonth() !== month - 1 ||
    scheduledLocal.getDate() !== day
  ) {
    return {
      iso: undefined,
      error: 'Enter a valid pickup date'
    };
  }

  const minStart = Date.now() + 5 * 60 * 1000;
  if (scheduledLocal.getTime() <= minStart) {
    return {
      iso: undefined,
      error: 'Pickup must be at least 5 minutes from now'
    };
  }

  return {
    iso: scheduledLocal.toISOString(),
    error: undefined
  };
}

function formatScheduleLabel(iso?: string) {
  if (!iso) {
    return 'Dispatch immediately after booking';
  }

  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return 'Scheduled pickup';
  }

  return `Scheduled for ${value.toLocaleDateString()} at ${value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function decodePolyline(encoded: string) {
  const points: RouteCoordinate[] = [];
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
      latitude: lat / 1e5,
      longitude: lng / 1e5
    });
  }

  return points;
}

async function fetchRouteDirect(input: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
}) {
  if (!MOBILE_GOOGLE_MAPS_API_KEY) {
    return [] as RouteCoordinate[];
  }

  const params = new URLSearchParams({
    origin: `${input.originLat},${input.originLng}`,
    destination: `${input.destinationLat},${input.destinationLng}`,
    mode: 'driving',
    alternatives: 'false',
    departure_time: 'now',
    key: MOBILE_GOOGLE_MAPS_API_KEY
  });

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
    if (response.ok) {
      const payload = (await response.json()) as {
        routes?: Array<{
          overview_polyline?: { points?: string };
        }>;
      };

      const encoded = payload.routes?.[0]?.overview_polyline?.points;
      if (encoded) {
        return decodePolyline(encoded);
      }
    }
  } catch {
    // Fallback to Routes API (new)
  }

  try {
    const modernResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MOBILE_GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline'
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
      return [] as RouteCoordinate[];
    }

    const payload = (await modernResponse.json()) as {
      routes?: Array<{
        polyline?: {
          encodedPolyline?: string;
        };
      }>;
    };

    const encoded = payload.routes?.[0]?.polyline?.encodedPolyline;
    return encoded ? decodePolyline(encoded) : ([] as RouteCoordinate[]);
  } catch {
    return [] as RouteCoordinate[];
  }
}

export function CustomerTripSelectScreen({ navigation }: Props) {
  const user = useSessionStore((state) => state.user);
  const {
    quotes,
    selectedVehicle,
    selectVehicle,
    draftPickup,
    draftDrop,
    goodsDescription,
    goodsType,
    goodsValue,
    insuranceSelected,
    minDriverRating,
    paymentMethod,
    createBooking,
    creating,
    estimateLoading,
    fetchQuotes,
    clearError
  } = useCustomerStore();
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const [customScheduleEnabled, setCustomScheduleEnabled] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState(defaultScheduleDateInput);
  const [customScheduleTime, setCustomScheduleTime] = useState(defaultScheduleTimeInput);

  const hasRoute = Boolean(draftPickup && draftDrop);
  const selectedMeta = selectedVehicle ? VEHICLE_UI_META[selectedVehicle.vehicleType] : null;
  const cardSurchargeNote = CARD_METHODS.includes(paymentMethod)
    ? 'Card payments include a 2.5% processing surcharge'
    : null;
  const cheapestTotal = useMemo(() => {
    if (quotes.length === 0) {
      return undefined;
    }

    return Math.min(...quotes.map((item) => item.pricing.total));
  }, [quotes]);
  const fastestEta = useMemo(() => {
    if (quotes.length === 0) {
      return undefined;
    }

    return Math.min(...quotes.map((item) => item.etaMinutes));
  }, [quotes]);
  const customScheduleResult = useMemo(
    () =>
      customScheduleEnabled
        ? parseCustomSchedule(customScheduleDate, customScheduleTime)
        : { iso: undefined, error: undefined },
    [customScheduleDate, customScheduleEnabled, customScheduleTime]
  );
  const scheduledAt = customScheduleResult.iso;
  const scheduleLabel = useMemo(() => formatScheduleLabel(scheduledAt), [scheduledAt]);

  const region = useMemo(
    () => ({
      latitude: hasRoute ? (draftPickup!.lat + draftDrop!.lat) / 2 : FALLBACK_CENTER.lat,
      longitude: hasRoute ? (draftPickup!.lng + draftDrop!.lng) / 2 : FALLBACK_CENTER.lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08
    }),
    [draftDrop?.lat, draftDrop?.lng, draftPickup?.lat, draftPickup?.lng, hasRoute]
  );
  const virtualTruckMarkers = useMemo(
    () =>
      buildVirtualTruckMarkers({
        lat: draftPickup?.lat ?? region.latitude,
        lng: draftPickup?.lng ?? region.longitude
      }),
    [draftPickup?.lat, draftPickup?.lng, region.latitude, region.longitude]
  );

  const getOngoingOrderCount = async () => {
    if (!user?.id) {
      return 0;
    }

    try {
      const response = await api.get('/orders', {
        params: {
          customerId: user.id
        }
      });

      const payload = Array.isArray(response.data) ? response.data : [];
      return payload.filter((item) => ONGOING_ORDER_STATUSES.has(String(item?.status ?? ''))).length;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    if (!draftPickup || !draftDrop) {
      setRouteCoordinates([]);
      return;
    }

    let cancelled = false;

    const loadRoute = async () => {
      try {
        const response = await api.get('/maps/routes', {
          params: {
            originLat: draftPickup.lat,
            originLng: draftPickup.lng,
            destinationLat: draftDrop.lat,
            destinationLng: draftDrop.lng
          }
        });

        if (cancelled) {
          return;
        }

        const payload = response.data as {
          route?: {
            polyline?: Array<{ lat: number; lng: number }>;
          };
        };

        const backendRoute = Array.isArray(payload.route?.polyline)
          ? payload.route.polyline
              .map((point) => ({
                latitude: Number(point.lat),
                longitude: Number(point.lng)
              }))
              .filter((point) => !Number.isNaN(point.latitude) && !Number.isNaN(point.longitude))
          : [];

        if (backendRoute.length > 1) {
          setRouteCoordinates(backendRoute);
          return;
        }

        const directRoute = await fetchRouteDirect({
          originLat: draftPickup.lat,
          originLng: draftPickup.lng,
          destinationLat: draftDrop.lat,
          destinationLng: draftDrop.lng
        });

        if (cancelled) {
          return;
        }

        if (directRoute.length > 1) {
          setRouteCoordinates(directRoute);
          return;
        }

        setRouteCoordinates([
          { latitude: draftPickup.lat, longitude: draftPickup.lng },
          { latitude: draftDrop.lat, longitude: draftDrop.lng }
        ]);
      } catch {
        const directRoute = await fetchRouteDirect({
          originLat: draftPickup.lat,
          originLng: draftPickup.lng,
          destinationLat: draftDrop.lat,
          destinationLng: draftDrop.lng
        });

        if (cancelled) {
          return;
        }

        if (directRoute.length > 1) {
          setRouteCoordinates(directRoute);
          return;
        }

        setRouteCoordinates([
          { latitude: draftPickup.lat, longitude: draftPickup.lng },
          { latitude: draftDrop.lat, longitude: draftDrop.lng }
        ]);
      }
    };

    void loadRoute();

    return () => {
      cancelled = true;
    };
  }, [draftDrop?.lat, draftDrop?.lng, draftPickup?.lat, draftPickup?.lng]);

  const submitBooking = async () => {
    const ongoingCount = await getOngoingOrderCount();
    if (ongoingCount >= MAX_CONCURRENT_RIDES) {
      Alert.alert(
        'Ride limit reached',
        'You already have the maximum active rides. Complete or cancel one ride first.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Ride History', onPress: () => navigation.navigate('CustomerRides') }
        ]
      );
      return;
    }

    if (!selectedVehicle) {
      Alert.alert('Select a vehicle', 'Choose one vehicle option to continue.');
      return;
    }

    if (!draftPickup || !draftDrop) {
      Alert.alert('Route required', 'Please choose pick-up and drop points first.');
      navigation.navigate('CustomerPickupConfirm');
      return;
    }

    if (customScheduleEnabled && customScheduleResult.error) {
      Alert.alert('Invalid pickup time', customScheduleResult.error);
      return;
    }

    try {
      await createBooking({
        pickup: draftPickup,
        drop: draftDrop,
        vehicleType: selectedVehicle.vehicleType,
        goodsDescription,
        goodsType,
        goodsValue,
        insuranceSelected,
        scheduledAt
      });

      if (scheduledAt) {
        Alert.alert('Pickup scheduled', 'Scheduled ride created. You can monitor all rides from Ride History.');
        navigation.navigate('CustomerRides');
        return;
      }

      navigation.navigate('CustomerTracking');
    } catch (error) {
      const message = extractErrorMessage(error, 'Could not create booking. Please retry.');
      if (message.toLowerCase().includes('maximum 3 active bookings')) {
        Alert.alert(
          'Ride limit reached',
          'You already have the maximum active rides. Complete one ride first.',
          [{ text: 'Open Ride History', onPress: () => navigation.navigate('CustomerRides') }]
        );
        return;
      }

      if (message.toLowerCase().includes('city-to-city') || message.toLowerCase().includes('coming soon')) {
        Alert.alert('City-to-city coming soon', message);
        return;
      }

      Alert.alert('Booking failed', message);
    }
  };

  const refreshQuotes = async () => {
    if (!draftPickup || !draftDrop) {
      Alert.alert('Route required', 'Please confirm pick-up and drop-off first.');
      navigation.navigate('CustomerPickupConfirm');
      return;
    }

    clearError();

    try {
      await fetchQuotes({
        pickup: draftPickup,
        drop: draftDrop,
        goodsType,
        goodsValue,
        insuranceSelected,
        minDriverRating
      });
    } catch (error) {
      const message = extractErrorMessage(error, 'Backend may not be reachable from this phone.');
      if (message.toLowerCase().includes('city-to-city') || message.toLowerCase().includes('coming soon')) {
        Alert.alert('City-to-city coming soon', message);
      } else {
        Alert.alert('Quote refresh failed', message);
      }
    }
  };

  const pickupLabel = draftPickup?.address ?? 'Pick-up not selected';
  const dropLabel = draftDrop?.address ?? 'Drop-off not selected';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.mapBlock}>
          <MapView style={styles.map} initialRegion={region} region={region}>
            {draftPickup ? (
              <Marker coordinate={{ latitude: draftPickup.lat, longitude: draftPickup.lng }} title="Pickup" />
            ) : null}
            {draftDrop ? (
              <Marker coordinate={{ latitude: draftDrop.lat, longitude: draftDrop.lng }} title="Drop" pinColor="#F97316" />
            ) : null}
            {virtualTruckMarkers.map((truck) => (
              <Marker
                key={truck.id}
                coordinate={{ latitude: truck.latitude, longitude: truck.longitude }}
                title="Nearby QARGO truck"
                description={`${truck.distanceKm.toFixed(1)} km away`}
                pinColor="#0EA5E9"
              />
            ))}
            {draftPickup && draftDrop ? (
              <Polyline
                coordinates={
                  routeCoordinates.length > 1
                    ? routeCoordinates
                    : [
                        { latitude: draftPickup.lat, longitude: draftPickup.lng },
                        { latitude: draftDrop.lat, longitude: draftDrop.lng }
                      ]
                }
                strokeColor="#0F766E"
                strokeWidth={4}
              />
            ) : null}
          </MapView>

          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </Pressable>

          <Pressable style={styles.routeBadgeTop} onPress={() => navigation.navigate('CustomerPickupConfirm')}>
            <Text style={styles.routeTitleTop} numberOfLines={1}>
              {pickupLabel.split(',')[0]}
            </Text>
            <Text style={styles.routeSubtitleTop} numberOfLines={1}>
              {pickupLabel}
            </Text>
          </Pressable>

          <Pressable style={styles.routeBadgeBottom} onPress={() => navigation.navigate('CustomerPickupConfirm')}>
            <View style={styles.etaPill}>
              <Text style={styles.etaText}>{selectedVehicle?.etaMinutes ?? 3} min</Text>
            </View>
            <View style={styles.routeCopyBottom}>
              <Text style={styles.routeTitleBottom} numberOfLines={1}>
                {dropLabel.split(',')[0]}
              </Text>
              <Text style={styles.routeSubtitleBottom} numberOfLines={1}>
                {dropLabel}
              </Text>
            </View>
            <Text style={styles.routeArrow}>{'>'}</Text>
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Choose Vehicle</Text>
            <Pressable style={styles.detailsButton} onPress={() => navigation.navigate('CustomerShipmentDetails')}>
              <Text style={styles.detailsText}>Edit details</Text>
            </Pressable>
          </View>

          <View style={styles.filtersRow}>
            <Text style={styles.filterChip}>{INSURANCE_LABELS[insuranceSelected]}</Text>
            <Text style={styles.filterChip}>Min rating {minDriverRating.toFixed(1)}</Text>
            <Text style={styles.filterChip}>INR {goodsValue.toFixed(0)}</Text>
          </View>

          <View style={styles.scheduleSection}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.scheduleTitle}>Pickup time</Text>
              <Text style={[styles.scheduleHint, customScheduleResult.error ? styles.scheduleHintError : undefined]}>
                {customScheduleEnabled && customScheduleResult.error
                  ? customScheduleResult.error
                  : scheduleLabel}
              </Text>
            </View>
            <View style={styles.scheduleOptions}>
              <Pressable
                style={[styles.scheduleChip, !customScheduleEnabled && styles.scheduleChipActive]}
                onPress={() => setCustomScheduleEnabled(false)}
              >
                <Text style={[styles.scheduleChipText, !customScheduleEnabled && styles.scheduleChipTextActive]}>
                  Now
                </Text>
              </Pressable>
              <Pressable
                style={[styles.scheduleChip, customScheduleEnabled && styles.scheduleChipActive]}
                onPress={() => setCustomScheduleEnabled(true)}
              >
                <Text style={[styles.scheduleChipText, customScheduleEnabled && styles.scheduleChipTextActive]}>
                  Custom
                </Text>
              </Pressable>
            </View>
            {customScheduleEnabled ? (
              <View style={styles.customScheduleInputs}>
                <View style={styles.customScheduleField}>
                  <Text style={styles.customScheduleLabel}>Date</Text>
                  <TextInput
                    value={customScheduleDate}
                    onChangeText={setCustomScheduleDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    style={styles.customScheduleInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={10}
                  />
                </View>
                <View style={styles.customScheduleField}>
                  <Text style={styles.customScheduleLabel}>Time</Text>
                  <TextInput
                    value={customScheduleTime}
                    onChangeText={setCustomScheduleTime}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                    style={styles.customScheduleInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={5}
                  />
                </View>
              </View>
            ) : null}
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            alwaysBounceHorizontal={false}
            bounces={false}
            directionalLockEnabled
          >
            {quotes.map((quote) => {
              const meta = VEHICLE_UI_META[quote.vehicleType as VehicleType];
              const active = selectedVehicle?.vehicleType === quote.vehicleType;
              const displayedNearbyDrivers = quote.availableDrivers + virtualTruckMarkers.length;
              const compareAtPrice = estimateCompareAt(
                quote.pricing.total,
                typeof quote.pricing.compareAtTotal === 'number' ? quote.pricing.compareAtTotal : undefined
              );
              const savingsAmount = Math.max(0, compareAtPrice - quote.pricing.total);
              const savingsPercent =
                compareAtPrice > 0 ? Math.round((savingsAmount / compareAtPrice) * 100) : 0;
              const badge = formatPromoTag({
                cheapest: cheapestTotal !== undefined && quote.pricing.total === cheapestTotal,
                fastest: fastestEta !== undefined && quote.etaMinutes === fastestEta,
                rating: quote.topDriver?.rating
              });
              const badgeStyle =
                badge.tone === 'PRICE'
                  ? styles.badgePrice
                  : badge.tone === 'SPEED'
                    ? styles.badgeSpeed
                    : badge.tone === 'RATING'
                      ? styles.badgeRating
                      : styles.badgeDefault;

              return (
                <Pressable
                  key={quote.vehicleType}
                  style={[styles.tripCard, active && styles.tripCardActive]}
                  onPress={() => selectVehicle(quote.vehicleType as VehicleType)}
                >
                  <View style={[styles.tripLeftIcon, { borderColor: meta.accent, backgroundColor: `${meta.accent}18` }]}>
                    <Text style={styles.tripLeftIconText}>
                      {getVehicleSymbol(quote.vehicleType as VehicleType)}
                    </Text>
                  </View>
                  <View style={styles.tripMain}>
                    <View style={styles.tripTopRow}>
                      <View style={styles.tripTitleGroup}>
                        <Text style={styles.tripTitle}>{meta.label}</Text>
                        <Text style={styles.tripSubtitle}>{meta.subtitle}</Text>
                      </View>

                      <View style={styles.tripPriceGroup}>
                        <Text style={styles.tripPrice}>INR {quote.pricing.total.toFixed(0)}</Text>
                        <Text style={styles.tripPriceStruck}>INR {Math.round(compareAtPrice).toFixed(0)}</Text>
                        <Text style={styles.tripSavings}>
                          Save INR {Math.round(savingsAmount).toFixed(0)}
                          {savingsPercent > 0 ? ` (${savingsPercent}% OFF)` : ''}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.tripMetaRow}>
                      <Text style={styles.tripEta}>Pickup in {quote.etaMinutes} min</Text>
                      <Text style={styles.tripMetaDot}>•</Text>
                      <Text style={styles.tripCapacity}>{meta.capacity}</Text>
                    </View>

                    <View style={styles.tripBadgesRow}>
                      <View style={[styles.tripBadge, badgeStyle]}>
                        <Text style={styles.tripBadgeText}>{badge.label}</Text>
                      </View>
                      <Text style={styles.tripMetaSecondary}>
                        {displayedNearbyDrivers} nearby trucks · Offer {quote.pricing.offerDiscountPercent ?? 8}% OFF
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.selectionPill, active && styles.selectionPillActive]}>
                    <Text style={[styles.selectionPillText, active && styles.selectionPillTextActive]}>
                      {active ? 'Selected' : 'Select'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {quotes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No quotes yet</Text>
                <Text style={styles.emptySubtitle}>Refresh after selecting route and shipment details.</Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable style={styles.paymentRow} onPress={() => navigation.navigate('CustomerPayment')}>
            <View style={styles.paymentLeft}>
              <View style={styles.cardChip}>
                <Text style={styles.cardChipText}>PAY</Text>
              </View>
              <View>
                <Text style={styles.paymentLabel}>{PAYMENT_LABELS[paymentMethod]}</Text>
                {cardSurchargeNote ? <Text style={styles.paymentSubLabel}>{cardSurchargeNote}</Text> : null}
              </View>
            </View>
            <Text style={styles.routeArrow}>{'>'}</Text>
          </Pressable>

          <View style={styles.ctaRow}>
            <Pressable style={styles.refreshButton} onPress={() => void refreshQuotes()} disabled={estimateLoading}>
              {estimateLoading ? (
                <ActivityIndicator color="#0F766E" />
              ) : (
                <Text style={styles.smallButtonText}>Refresh</Text>
              )}
            </Pressable>

            <Pressable style={styles.chooseButton} onPress={() => void submitBooking()} disabled={creating}>
              {creating ? (
                <ActivityIndicator color="#ECFEFF" />
              ) : (
                <Text style={styles.chooseText}>{selectedMeta ? `Book ${selectedMeta.label}` : 'Book vehicle'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF8F1'
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1'
  },
  mapBlock: {
    height: '32%',
    position: 'relative'
  },
  map: {
    flex: 1
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  backButtonText: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 18
  },
  routeBadgeTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 64,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  routeTitleTop: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  routeSubtitleTop: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12
  },
  routeBadgeBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  etaPill: {
    borderRadius: 8,
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  etaText: {
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 11
  },
  routeCopyBottom: {
    flex: 1
  },
  routeTitleBottom: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 13
  },
  routeSubtitleBottom: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 11
  },
  routeArrow: {
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16
  },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    marginTop: -8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sheetTitle: {
    color: '#0F172A',
    fontFamily: 'Sora_700Bold',
    fontSize: 20
  },
  detailsButton: {
    borderRadius: 999,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  detailsText: {
    color: '#9A3412',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 4
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDFA',
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  scheduleSection: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 6
  },
  scheduleHeader: {
    gap: 2,
    marginBottom: 8
  },
  scheduleTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 13
  },
  scheduleHint: {
    color: '#475569',
    fontFamily: 'Manrope_500Medium',
    fontSize: 11
  },
  scheduleHintError: {
    color: '#B91C1C'
  },
  scheduleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  scheduleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  scheduleChipActive: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1'
  },
  scheduleChipText: {
    color: '#334155',
    fontFamily: 'Manrope_700Bold',
    fontSize: 11
  },
  scheduleChipTextActive: {
    color: '#0F766E'
  },
  customScheduleInputs: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8
  },
  customScheduleField: {
    flex: 1,
    gap: 4
  },
  customScheduleLabel: {
    color: '#475569',
    fontFamily: 'Manrope_700Bold',
    fontSize: 11
  },
  customScheduleInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  list: {
    flex: 1
  },
  listContent: {
    gap: 8,
    paddingVertical: 8
  },
  tripCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  tripCardActive: {
    borderColor: '#0F766E',
    backgroundColor: '#ECFDF5',
    shadowColor: '#0F766E',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
  },
  tripLeftIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CCFBF1'
  },
  tripLeftIconText: {
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  tripMain: {
    flex: 1,
    gap: 5
  },
  tripTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  tripTitleGroup: {
    flex: 1,
    paddingRight: 8
  },
  tripTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 17
  },
  tripSubtitle: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    marginTop: 1
  },
  tripPriceGroup: {
    alignItems: 'flex-end'
  },
  tripPrice: {
    color: '#0F172A',
    fontFamily: 'Sora_700Bold',
    fontSize: 15
  },
  tripPriceStruck: {
    color: '#94A3B8',
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    textDecorationLine: 'line-through'
  },
  tripSavings: {
    color: '#15803D',
    fontFamily: 'Manrope_700Bold',
    fontSize: 10
  },
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  tripEta: {
    color: '#334155',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  tripMetaDot: {
    color: '#94A3B8',
    fontFamily: 'Manrope_700Bold',
    fontSize: 11
  },
  tripCapacity: {
    color: '#334155',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12
  },
  tripBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  tripBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgePrice: {
    backgroundColor: '#DCFCE7'
  },
  badgeSpeed: {
    backgroundColor: '#DBEAFE'
  },
  badgeRating: {
    backgroundColor: '#FEF3C7'
  },
  badgeDefault: {
    backgroundColor: '#E2E8F0'
  },
  tripBadgeText: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 10
  },
  tripMetaSecondary: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 10
  },
  selectionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  selectionPillActive: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1'
  },
  selectionPillText: {
    color: '#64748B',
    fontFamily: 'Manrope_700Bold',
    fontSize: 10
  },
  selectionPillTextActive: {
    color: '#0F766E'
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#F8FAFC'
  },
  emptyTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  emptySubtitle: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    marginTop: 2
  },
  paymentRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  cardChip: {
    backgroundColor: '#0F766E',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  cardChipText: {
    color: '#ECFEFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 10
  },
  paymentLabel: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  paymentSubLabel: {
    marginTop: 1,
    color: '#B45309',
    fontFamily: 'Manrope_500Medium',
    fontSize: 11
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  refreshButton: {
    minWidth: 86,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  chooseButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48
  },
  chooseText: {
    color: '#ECFEFF',
    fontFamily: 'Sora_700Bold',
    fontSize: 16
  },
  smallButtonText: {
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  }
});
