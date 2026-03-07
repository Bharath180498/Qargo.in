import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import * as Location from 'expo-location';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverAppStore } from '../../store/useDriverAppStore';
import { openGoogleMapsNavigation } from '../../utils/mapsNavigation';

const actionMap: Array<{ status: string; endpoint: string; label: string; payload?: Record<string, unknown> }> = [
  { status: 'ASSIGNED', endpoint: 'accept', label: 'Start Trip' },
  { status: 'DRIVER_EN_ROUTE', endpoint: 'arrived-pickup', label: 'Reached Pickup' },
  { status: 'ARRIVED_PICKUP', endpoint: 'start-loading', label: 'Start Loading' },
  { status: 'LOADING', endpoint: 'start-transit', label: 'Start Transit' },
  {
    status: 'IN_TRANSIT',
    endpoint: 'complete',
    label: 'Complete Delivery',
    payload: { distanceKm: 14, durationMinutes: 38 }
  }
];

const TRIP_STAGES: Array<{ key: string; label: string }> = [
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'DRIVER_EN_ROUTE', label: 'To pickup' },
  { key: 'ARRIVED_PICKUP', label: 'At pickup' },
  { key: 'LOADING', label: 'Loading' },
  { key: 'IN_TRANSIT', label: 'In transit' },
  { key: 'COMPLETED', label: 'Delivered' }
];

export function HomeScreen() {
  const availabilityStatus = useDriverAppStore((state) => state.availabilityStatus);
  const setAvailability = useDriverAppStore((state) => state.setAvailability);
  const updateLocation = useDriverAppStore((state) => state.updateLocation);
  const currentJob = useDriverAppStore((state) => state.currentJob);
  const nextJob = useDriverAppStore((state) => state.nextJob);
  const pendingOffers = useDriverAppStore((state) => state.pendingOffers);
  const acceptOffer = useDriverAppStore((state) => state.acceptOffer);
  const rejectOffer = useDriverAppStore((state) => state.rejectOffer);
  const runTripAction = useDriverAppStore((state) => state.runTripAction);
  const [lastKnownLocation, setLastKnownLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const activeOffer = pendingOffers[0];
  const activeAction = useMemo(
    () => actionMap.find((item) => item.status === currentJob?.status),
    [currentJob?.status]
  );
  const currentStageIndex = useMemo(
    () => TRIP_STAGES.findIndex((stage) => stage.key === (currentJob?.status ?? 'ASSIGNED')),
    [currentJob?.status]
  );
  const offerSecondsLeft = useMemo(() => {
    if (!activeOffer?.expiresAt) {
      return 0;
    }
    const ms = new Date(activeOffer.expiresAt).getTime() - now;
    return Math.max(0, Math.floor(ms / 1000));
  }, [activeOffer?.expiresAt, now]);
  const offerProgress = useMemo(() => {
    if (!activeOffer?.expiresAt) {
      return 0;
    }
    const createdMs = activeOffer.createdAt ? new Date(activeOffer.createdAt).getTime() : now;
    const expiryMs = new Date(activeOffer.expiresAt).getTime();
    const total = Math.max(1, expiryMs - createdMs);
    const elapsed = Math.max(0, now - createdMs);
    return Math.min(1, elapsed / total);
  }, [activeOffer?.createdAt, activeOffer?.expiresAt, now]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const startTracking = async () => {
      if (availabilityStatus === 'OFFLINE' || !availabilityStatus) {
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Enable location permissions to go online.');
        return;
      }

      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      setLastKnownLocation({
        lat: initialPosition.coords.latitude,
        lng: initialPosition.coords.longitude
      });

      await updateLocation(initialPosition.coords.latitude, initialPosition.coords.longitude, currentJob?.orderId);

      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10
        },
        (position) => {
          setLastKnownLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          void updateLocation(position.coords.latitude, position.coords.longitude, currentJob?.orderId);
        }
      );
    };

    void startTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [availabilityStatus, currentJob?.orderId, updateLocation]);

  const runCurrentAction = async () => {
    if (!currentJob || !activeAction) {
      return;
    }

    try {
      await runTripAction(currentJob.id, activeAction.endpoint, activeAction.payload);
    } catch {
      Alert.alert('Action failed', 'Could not update trip state.');
    }
  };

  const quickNavigateCurrent = async () => {
    if (!currentJob?.order) {
      Alert.alert('No active trip', 'You do not have an active job to navigate.');
      return;
    }

    const toDrop = currentJob.status === 'IN_TRANSIT';
    const targetLat = toDrop ? currentJob.order.dropLat : currentJob.order.pickupLat;
    const targetLng = toDrop ? currentJob.order.dropLng : currentJob.order.pickupLng;

    if (typeof targetLat !== 'number' || typeof targetLng !== 'number') {
      Alert.alert('Location unavailable', 'Trip coordinates are not available yet.');
      return;
    }

    await openGoogleMapsNavigation({
      lat: targetLat,
      lng: targetLng,
      originLat: lastKnownLocation?.lat,
      originLng: lastKnownLocation?.lng
    });
  };

  const navigateToOfferPickup = async () => {
    if (!activeOffer?.order) {
      Alert.alert('No offer', 'No pickup location found for active offer.');
      return;
    }

    await openGoogleMapsNavigation({
      lat: activeOffer.order.pickupLat,
      lng: activeOffer.order.pickupLng,
      originLat: lastKnownLocation?.lat,
      originLng: lastKnownLocation?.lng
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Qargo Driver</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Availability</Text>
          <Text style={styles.status}>
            {availabilityStatus === 'ONLINE'
              ? 'You are online'
              : availabilityStatus === 'BUSY'
                ? 'Trip in progress'
                : 'You are offline'}
          </Text>
          <View style={styles.row}>
            <Pressable style={[styles.toggleButton, styles.onlineButton]} onPress={() => void setAvailability('ONLINE')}>
              <Text style={styles.toggleButtonText}>Go Online</Text>
            </Pressable>
            <Pressable style={[styles.toggleButton, styles.offlineButton]} onPress={() => void setAvailability('OFFLINE')}>
              <Text style={[styles.toggleButtonText, { color: colors.accent }]}>Go Offline</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, activeOffer ? styles.offerCardHighlight : undefined]}>
          <View style={styles.offerHeaderRow}>
            <Text style={styles.cardTitle}>Incoming Job</Text>
            <Text style={styles.offerTimer}>{offerSecondsLeft}s</Text>
          </View>
          {activeOffer ? (
            <>
              <Text style={styles.offerMainText}>Pickup: {activeOffer.order?.pickupAddress}</Text>
              <Text style={styles.offerMetaText}>Drop: {activeOffer.order?.dropAddress}</Text>
              <Text style={styles.offerMetaText}>
                ETA {activeOffer.routeEtaMinutes} min • {activeOffer.vehicleMatchType}
              </Text>
              <View style={styles.offerProgressTrack}>
                <View style={[styles.offerProgressFill, { width: `${Math.round(offerProgress * 100)}%` }]} />
              </View>
              <View style={styles.row}>
                <Pressable
                  style={[styles.toggleButton, styles.onlineButton]}
                  onPress={() => void acceptOffer(activeOffer.id)}
                >
                  <Text style={styles.toggleButtonText}>Accept Job</Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleButton, styles.offlineButton]}
                  onPress={() => void rejectOffer(activeOffer.id)}
                >
                  <Text style={[styles.toggleButtonText, { color: colors.accent }]}>Skip</Text>
                </Pressable>
              </View>
              <Pressable style={styles.navButton} onPress={() => void navigateToOfferPickup()}>
                <Text style={styles.navButtonText}>Open Pickup in Google Maps</Text>
              </Pressable>
              {pendingOffers.length > 1 ? (
                <Text style={styles.offerQueueNote}>+{pendingOffers.length - 1} more offer(s) waiting</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.info}>No incoming jobs right now. Keep app open and stay online.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Trip</Text>
          {currentJob ? (
            <>
              <Text style={styles.info}>Pickup: {currentJob.order?.pickupAddress}</Text>
              <Text style={styles.info}>Drop: {currentJob.order?.dropAddress}</Text>
              <Text style={styles.info}>Stage: {currentJob.status}</Text>
              <View style={styles.stageMap}>
                {TRIP_STAGES.map((stage, index) => {
                  const completed = currentStageIndex >= index;
                  const active = currentStageIndex === index;
                  return (
                    <View key={stage.key} style={styles.stageItem}>
                      <View style={styles.stageTrackColumn}>
                        <View style={[styles.stageDot, completed && styles.stageDotCompleted, active && styles.stageDotActive]} />
                        {index < TRIP_STAGES.length - 1 ? (
                          <View style={[styles.stageConnector, currentStageIndex > index && styles.stageConnectorCompleted]} />
                        ) : null}
                      </View>
                      <Text style={[styles.stageLabel, completed && styles.stageLabelCompleted]}>{stage.label}</Text>
                    </View>
                  );
                })}
              </View>
              <Pressable style={styles.navButton} onPress={() => void quickNavigateCurrent()}>
                <Text style={styles.navButtonText}>
                  {currentJob.status === 'IN_TRANSIT' ? 'Navigate to Drop' : 'Navigate to Pickup'}
                </Text>
              </Pressable>
              {activeAction ? (
                <Pressable style={styles.mainActionButton} onPress={() => void runCurrentAction()}>
                  <Text style={styles.mainActionText}>{activeAction.label}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.info}>No active trip. Stay online to receive offers.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Queued Job</Text>
          {nextJob ? (
            <>
              <Text style={styles.info}>Order ID: {nextJob.id}</Text>
              <Text style={styles.info}>Pickup: {nextJob.pickupAddress}</Text>
              <Text style={styles.info}>Drop: {nextJob.dropAddress}</Text>
            </>
          ) : (
            <Text style={styles.info}>No queued order right now.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center'
  },
  title: { fontFamily: typography.heading, color: colors.accent, fontSize: 30 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  cardTitle: { fontFamily: typography.bodyBold, color: colors.accent },
  status: { fontFamily: typography.body, color: colors.secondary },
  offerCardHighlight: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED'
  },
  offerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  offerTimer: {
    fontFamily: typography.bodyBold,
    color: '#B45309'
  },
  offerMainText: {
    fontFamily: typography.bodyBold,
    color: colors.accent
  },
  offerMetaText: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 13
  },
  offerProgressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FED7AA',
    overflow: 'hidden',
    marginTop: spacing.xs
  },
  offerProgressFill: {
    height: '100%',
    backgroundColor: '#F97316'
  },
  offerQueueNote: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  toggleButton: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  onlineButton: { backgroundColor: colors.secondary },
  offlineButton: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74'
  },
  toggleButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.white
  },
  info: { fontFamily: typography.body, color: colors.mutedText },
  navButton: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    backgroundColor: '#ECFDF5'
  },
  navButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.secondary
  },
  mainActionButton: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary
  },
  mainActionText: {
    fontFamily: typography.bodyBold,
    color: colors.white
  },
  stageMap: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    gap: spacing.xs
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs
  },
  stageTrackColumn: {
    alignItems: 'center'
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    marginTop: 2
  },
  stageDotCompleted: {
    borderColor: colors.secondary,
    backgroundColor: '#99F6E4'
  },
  stageDotActive: {
    backgroundColor: '#0F766E'
  },
  stageConnector: {
    width: 2,
    height: 18,
    backgroundColor: '#CBD5E1',
    marginTop: 2
  },
  stageConnectorCompleted: {
    backgroundColor: '#0F766E'
  },
  stageLabel: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  stageLabelCompleted: {
    color: colors.accent,
    fontFamily: typography.bodyBold
  }
});
