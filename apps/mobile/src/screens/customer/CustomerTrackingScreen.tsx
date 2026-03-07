import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { io } from 'socket.io-client';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api, { REALTIME_BASE_URL } from '../../services/api';
import { useCustomerStore } from '../../store/useCustomerStore';
import type { RootStackParamList } from '../../types/navigation';
import MapView, { Marker, Polyline } from '../../components/maps';

interface DriverPoint {
  lat: number;
  lng: number;
  timestamp: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerTracking'>;

function vehicleLabel(vehicleType?: string) {
  if (!vehicleType) {
    return 'Pending';
  }

  if (vehicleType === 'THREE_WHEELER') {
    return '3 Wheeler';
  }

  if (vehicleType === 'MINI_TRUCK') {
    return 'Mini Truck';
  }

  return 'Truck';
}

export function CustomerTrackingScreen({ navigation }: Props) {
  const refreshOrder = useCustomerStore((state) => state.refreshOrder);
  const refreshTimeline = useCustomerStore((state) => state.refreshTimeline);
  const refreshLocationHistory = useCustomerStore((state) => state.refreshLocationHistory);
  const activeOrderId = useCustomerStore((state) => state.activeOrderId);
  const generatedEwayBillNumber = useCustomerStore((state) => state.generatedEwayBillNumber);

  const [order, setOrder] = useState<any>();
  const [timeline, setTimeline] = useState<any[]>([]);
  const [points, setPoints] = useState<DriverPoint[]>([]);
  const [dispatchDecisions, setDispatchDecisions] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [orderPayload, timelinePayload, historyPayload] = await Promise.all([
        refreshOrder(),
        refreshTimeline(),
        refreshLocationHistory()
      ]);

      const decisionsPayload = activeOrderId
        ? await api
            .get(`/dispatch/orders/${activeOrderId}/decisions`)
            .then((response) => response.data)
            .catch(() => [])
        : [];

      setOrder(orderPayload);
      setTimeline(timelinePayload?.timeline ?? []);
      setDispatchDecisions(Array.isArray(decisionsPayload) ? decisionsPayload : []);
      setPoints(
        (historyPayload?.points ?? [])
          .map((item: any) => ({
            lat: Number(item.lat),
            lng: Number(item.lng),
            timestamp: item.timestamp
          }))
          .filter((item: DriverPoint) => !Number.isNaN(item.lat) && !Number.isNaN(item.lng))
          .reverse()
      );
    };

    void load();
    const interval = setInterval(() => void load(), 5000);

    return () => clearInterval(interval);
  }, [activeOrderId, refreshLocationHistory, refreshOrder, refreshTimeline]);

  useEffect(() => {
    if (!activeOrderId) {
      return;
    }

    const socket = io(`${REALTIME_BASE_URL}/realtime`, {
      transports: ['websocket'],
      timeout: 7000
    });

    socket.on('connect', () => {
      socket.emit('subscribe:order', { orderId: activeOrderId });
    });

    socket.on('driver:location', (payload) => {
      if (!payload || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
        return;
      }

      setPoints((current) => [
        ...current,
        {
          lat: payload.lat,
          lng: payload.lng,
          timestamp: payload.timestamp ?? new Date().toISOString()
        }
      ]);
    });

    socket.on('trip:completed', () => {
      void refreshOrder().then(setOrder);
    });

    return () => {
      socket.disconnect();
    };
  }, [activeOrderId, refreshOrder]);

  const pickup = {
    latitude: order?.pickupLat ?? 12.9716,
    longitude: order?.pickupLng ?? 77.5946
  };
  const drop = {
    latitude: order?.dropLat ?? 12.9816,
    longitude: order?.dropLng ?? 77.6046
  };

  const assignedDriver = order?.trip?.driver;
  const assignedDriverUser = assignedDriver?.user;
  const assignedDriverVehicle = assignedDriver?.vehicles?.[0];
  const assignedDriverStaticPoint =
    typeof assignedDriver?.currentLat === 'number' && typeof assignedDriver?.currentLng === 'number'
      ? {
          lat: Number(assignedDriver.currentLat),
          lng: Number(assignedDriver.currentLng),
          timestamp: new Date().toISOString()
        }
      : undefined;
  const liveDriver = points.at(-1) ?? assignedDriverStaticPoint;
  const driverInitial = assignedDriverUser?.name ? assignedDriverUser.name[0]?.toUpperCase() : 'D';

  const region = useMemo(
    () => ({
      latitude: liveDriver?.lat ?? pickup.latitude,
      longitude: liveDriver?.lng ?? pickup.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08
    }),
    [liveDriver?.lat, liveDriver?.lng, pickup.latitude, pickup.longitude]
  );

  const hasAssignedDriver = Boolean(assignedDriver);
  const matchingProgress = useMemo(() => {
    if (hasAssignedDriver) {
      return 1;
    }

    const attempts = dispatchDecisions.length;
    return Math.min(0.92, 0.18 + attempts * 0.18);
  }, [dispatchDecisions.length, hasAssignedDriver]);
  const matchingHeadline = hasAssignedDriver ? 'Driver assigned' : 'Finding your driver';
  const matchingSubtitle = hasAssignedDriver
    ? 'Pickup ETA and driver details are ready.'
    : dispatchDecisions.length > 1
      ? `Checked ${dispatchDecisions.length} nearby driver option(s).`
      : 'Checking nearby available drivers now.';

  const submitRating = async () => {
    const tripId = order?.trip?.id;
    if (!tripId) {
      return;
    }

    try {
      await api.post(`/trips/${tripId}/rate`, {
        driverRating: rating,
        review: `Rated ${rating}/5 from customer app`
      });

      setRatingSubmitted(true);
      Alert.alert('Thanks', 'Driver rating submitted.');
    } catch {
      Alert.alert('Could not submit rating', 'Please try once again.');
    }
  };

  const callDriver = async () => {
    const phone = assignedDriverUser?.phone;
    if (!phone) {
      Alert.alert('Driver contact unavailable', 'Phone number is not available yet.');
      return;
    }

    const telUrl = `tel:${phone.replace(/\s+/g, '')}`;

    try {
      const canOpen = await Linking.canOpenURL(telUrl);
      if (!canOpen) {
        Alert.alert('Cannot place call', 'This device cannot place phone calls right now.');
        return;
      }

      await Linking.openURL(telUrl);
    } catch {
      Alert.alert('Cannot place call', 'Please try again after a moment.');
    }
  };

  const ewayDisplay = order?.ewayBillNumber ?? generatedEwayBillNumber;

  if (!activeOrderId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No active trip right now</Text>
          <Text style={styles.emptySubtitle}>Book a new goods delivery from Home.</Text>
          <Pressable style={styles.emptyButton} onPress={() => navigation.navigate('CustomerHome')}>
            <Text style={styles.emptyButtonText}>Go to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.mapWrap}>
          <MapView style={styles.map} initialRegion={region} region={region}>
            <Marker coordinate={pickup} title="Pickup" />
            <Marker coordinate={drop} title="Drop" pinColor="#F97316" />

            {liveDriver ? (
              <Marker
                coordinate={{ latitude: liveDriver.lat, longitude: liveDriver.lng }}
                title="Driver"
                pinColor="#0F766E"
              />
            ) : null}

            <Polyline coordinates={[pickup, drop]} strokeColor="#94A3B8" strokeWidth={3} />

            {points.length > 1 ? (
              <Polyline
                coordinates={points.map((point) => ({
                  latitude: point.lat,
                  longitude: point.lng
                }))}
                strokeColor="#0F766E"
                strokeWidth={4}
              />
            ) : null}
          </MapView>

          <Pressable style={styles.backButton} onPress={() => navigation.navigate('CustomerHome')}>
            <Text style={styles.backButtonText}>{'<'}</Text>
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Live Delivery</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{order?.status ?? 'CREATED'}</Text>
            </View>
          </View>

          <View style={styles.matchingCard}>
            <Text style={styles.matchingTitle}>{matchingHeadline}</Text>
            <Text style={styles.matchingSubtitle}>{matchingSubtitle}</Text>
            <View style={styles.matchingTrack}>
              <View style={[styles.matchingFill, { width: `${Math.round(matchingProgress * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Trip status</Text>
              <Text style={styles.infoValue}>{order?.trip?.status ?? 'MATCHING'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>ETA</Text>
              <Text style={styles.infoValue}>{order?.trip?.etaMinutes ?? 15} min</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Waiting charge</Text>
              <Text style={styles.infoValue}>INR {Number(order?.waitingCharge ?? 0).toFixed(0)}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoValue}>{order?.payment?.status ?? 'PENDING'}</Text>
            </View>
          </View>

          <Pressable style={styles.paymentAction} onPress={() => navigation.navigate('CustomerPayment')}>
            <Text style={styles.paymentActionTitle}>Payment</Text>
            <Text style={styles.paymentActionSubtitle}>
              {order?.payment?.status ?? 'Pending payment'} - tap to pay or change method
            </Text>
          </Pressable>

          {assignedDriver ? (
            <View style={styles.driverCard}>
              <View style={styles.driverCardHead}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>{driverInitial}</Text>
                </View>
                <View style={styles.driverHeadCopy}>
                  <Text style={styles.driverName}>{assignedDriverUser?.name ?? 'Driver assigned'}</Text>
                  <Text style={styles.driverMetaLine}>
                    {typeof assignedDriverUser?.rating === 'number'
                      ? `${assignedDriverUser.rating.toFixed(1)} rating`
                      : 'Rating pending'}
                    {typeof assignedDriver?._count?.trips === 'number'
                      ? ` • ${assignedDriver._count.trips} trips`
                      : ''}
                  </Text>
                </View>
                <Pressable style={styles.callButton} onPress={() => void callDriver()}>
                  <Text style={styles.callButtonText}>Call</Text>
                </Pressable>
              </View>

              <View style={styles.driverInfoGrid}>
                <View style={styles.driverInfoItem}>
                  <Text style={styles.driverInfoLabel}>Vehicle</Text>
                  <Text style={styles.driverInfoValue}>
                    {vehicleLabel(assignedDriverVehicle?.type ?? assignedDriver?.vehicleType)}
                  </Text>
                </View>
                <View style={styles.driverInfoItem}>
                  <Text style={styles.driverInfoLabel}>Vehicle No.</Text>
                  <Text style={styles.driverInfoValue}>{assignedDriver?.vehicleNumber ?? 'Pending'}</Text>
                </View>
                <View style={styles.driverInfoItem}>
                  <Text style={styles.driverInfoLabel}>Phone</Text>
                  <Text style={styles.driverInfoValue}>{assignedDriverUser?.phone ?? 'Pending'}</Text>
                </View>
                <View style={styles.driverInfoItem}>
                  <Text style={styles.driverInfoLabel}>License</Text>
                  <Text style={styles.driverInfoValue}>{assignedDriver?.licenseNumber ?? 'Pending'}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.driverWaitingCard}>
              <Text style={styles.driverWaitingTitle}>Looking for your driver</Text>
              <Text style={styles.driverWaitingSubtitle}>
                Driver profile, vehicle number, and contact will show up as soon as assignment is done.
              </Text>
            </View>
          )}

          {ewayDisplay ? (
            <View style={styles.ewayCard}>
              <Text style={styles.ewayLabel}>GST e-way bill</Text>
              <Text style={styles.ewayNumber}>{ewayDisplay}</Text>
            </View>
          ) : null}

          <Text style={styles.timelineTitle}>Trip timeline</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineRow}>
            {timeline.map((event) => (
              <View key={`${event.key}-${event.timestamp}`} style={styles.timelineItem}>
                <Text style={styles.timelineStatus}>{event.status}</Text>
                <Text style={styles.timelineTime}>
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            ))}
          </ScrollView>

          {order?.status === 'DELIVERED' ? (
            <View style={styles.ratingCard}>
              <Text style={styles.ratingTitle}>Rate your driver</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    style={[styles.ratingDot, rating >= value && styles.ratingDotActive]}
                    onPress={() => setRating(value)}
                    disabled={ratingSubmitted}
                  >
                    <Text style={[styles.ratingDotText, rating >= value && styles.ratingDotTextActive]}>{value}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.rateButton} onPress={() => void submitRating()} disabled={ratingSubmitted}>
                <Text style={styles.rateButtonText}>{ratingSubmitted ? 'Rating submitted' : 'Submit rating'}</Text>
              </Pressable>
            </View>
          ) : null}
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10
  },
  emptyTitle: {
    color: '#0F172A',
    fontFamily: 'Sora_700Bold',
    fontSize: 22,
    textAlign: 'center'
  },
  emptySubtitle: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    textAlign: 'center'
  },
  emptyButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  emptyButtonText: {
    color: '#ECFEFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  mapWrap: {
    flex: 1,
    position: 'relative'
  },
  map: {
    flex: 1
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  backButtonText: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 18
  },
  sheet: {
    marginTop: -8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sheetTitle: {
    color: '#0F172A',
    fontFamily: 'Sora_700Bold',
    fontSize: 20
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  statusPillText: {
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 11
  },
  matchingCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  matchingTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 15
  },
  matchingSubtitle: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12
  },
  matchingTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden'
  },
  matchingFill: {
    height: '100%',
    backgroundColor: '#0F766E'
  },
  paymentAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2
  },
  paymentActionTitle: {
    color: '#115E59',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  paymentActionSubtitle: {
    color: '#0F766E',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  infoCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 8
  },
  infoLabel: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 11
  },
  infoValue: {
    marginTop: 2,
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 13
  },
  driverCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDFA',
    padding: 10,
    gap: 10
  },
  driverCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  driverAvatarText: {
    color: '#0F766E',
    fontFamily: 'Sora_700Bold',
    fontSize: 16
  },
  driverHeadCopy: {
    flex: 1
  },
  driverName: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  driverMetaLine: {
    color: '#0F766E',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    marginTop: 1
  },
  callButton: {
    borderRadius: 999,
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  callButtonText: {
    color: '#ECFEFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  driverInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  driverInfoItem: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    backgroundColor: '#FFFFFF',
    padding: 8
  },
  driverInfoLabel: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 11
  },
  driverInfoValue: {
    marginTop: 2,
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  driverWaitingCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 10
  },
  driverWaitingTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 13
  },
  driverWaitingSubtitle: {
    marginTop: 2,
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12
  },
  ewayCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    padding: 10
  },
  ewayLabel: {
    color: '#92400E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  ewayNumber: {
    marginTop: 2,
    color: '#7C2D12',
    fontFamily: 'Sora_700Bold',
    fontSize: 14
  },
  timelineTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  timelineRow: {
    gap: 8,
    paddingBottom: 2
  },
  timelineItem: {
    minWidth: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  timelineStatus: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 11
  },
  timelineTime: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 10,
    marginTop: 2
  },
  ratingCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 8
  },
  ratingTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6
  },
  ratingDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  ratingDotActive: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1'
  },
  ratingDotText: {
    color: '#475569',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  ratingDotTextActive: {
    color: '#0F766E'
  },
  rateButton: {
    borderRadius: 10,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  rateButtonText: {
    color: '#ECFEFF',
    fontFamily: 'Manrope_700Bold',
    fontSize: 13
  }
});
