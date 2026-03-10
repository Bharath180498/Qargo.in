import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverAppStore } from '../../store/useDriverAppStore';
import { openGoogleMapsNavigation } from '../../utils/mapsNavigation';
import { DeliveryProofModal, type DeliveryProofSubmission } from '../../components/DeliveryProofModal';

const actionMap: Array<{ status: string; endpoint: string; label: string; payload?: Record<string, unknown> }> = [
  { status: 'ASSIGNED', endpoint: 'accept', label: 'Accept Job' },
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

interface CompletionMetrics {
  distanceKm?: number;
  durationMinutes?: number;
}

function parseCompletionMetric(value: unknown) {
  const candidate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(candidate) || candidate < 0) {
    return undefined;
  }
  return candidate;
}

function extractCompletionMetrics(payload?: Record<string, unknown>): CompletionMetrics {
  if (!payload) {
    return {};
  }

  return {
    distanceKm: parseCompletionMetric(payload.distanceKm),
    durationMinutes: parseCompletionMetric(payload.durationMinutes)
  };
}

export function JobsScreen() {
  const currentJob = useDriverAppStore((state) => state.currentJob);
  const nextJob = useDriverAppStore((state) => state.nextJob);
  const pendingOffers = useDriverAppStore((state) => state.pendingOffers);
  const refreshJobs = useDriverAppStore((state) => state.refreshJobs);
  const acceptOffer = useDriverAppStore((state) => state.acceptOffer);
  const rejectOffer = useDriverAppStore((state) => state.rejectOffer);
  const runTripAction = useDriverAppStore((state) => state.runTripAction);
  const completeTripWithDeliveryProof = useDriverAppStore((state) => state.completeTripWithDeliveryProof);
  const [deliveryProofVisible, setDeliveryProofVisible] = useState(false);
  const [deliveryProofSubmitting, setDeliveryProofSubmitting] = useState(false);
  const [completionMetrics, setCompletionMetrics] = useState<CompletionMetrics>({});

  const activeAction = useMemo(
    () => actionMap.find((item) => item.status === currentJob?.status),
    [currentJob?.status]
  );
  const currentNavigationTarget = useMemo(() => {
    if (!currentJob?.order) {
      return null;
    }

    if (currentJob.status === 'IN_TRANSIT') {
      return {
        lat: currentJob.order.dropLat,
        lng: currentJob.order.dropLng,
        label: 'Navigate to Drop'
      };
    }

    return {
      lat: currentJob.order.pickupLat,
      lng: currentJob.order.pickupLng,
      label: 'Navigate to Pickup'
    };
  }, [currentJob]);

  const runAction = async () => {
    if (!currentJob || !activeAction) {
      return;
    }

    if (activeAction.endpoint === 'complete') {
      setCompletionMetrics(extractCompletionMetrics(activeAction.payload));
      setDeliveryProofVisible(true);
      return;
    }

    try {
      await runTripAction(currentJob.id, activeAction.endpoint, activeAction.payload);
    } catch {
      Alert.alert('Action failed', 'Could not update trip state.');
    }
  };

  const submitDeliveryProof = async (payload: DeliveryProofSubmission) => {
    if (!currentJob) {
      Alert.alert('No active trip', 'Trip is no longer active. Refresh jobs and try again.');
      return;
    }

    setDeliveryProofSubmitting(true);
    try {
      await completeTripWithDeliveryProof(currentJob.id, {
        ...payload,
        ...completionMetrics
      });
      setDeliveryProofVisible(false);
      setCompletionMetrics({});
    } catch {
      Alert.alert('Completion failed', 'Could not upload delivery proof. Check network and retry.');
    } finally {
      setDeliveryProofSubmitting(false);
    }
  };

  const navigateToTarget = async (target?: { lat?: number; lng?: number }, fallbackMessage?: string) => {
    if (typeof target?.lat !== 'number' || typeof target?.lng !== 'number') {
      Alert.alert('Location unavailable', fallbackMessage ?? 'Could not find trip coordinates.');
      return;
    }

    await openGoogleMapsNavigation({
      lat: target.lat,
      lng: target.lng
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Jobs & Offers</Text>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Incoming Offers</Text>
            <Pressable onPress={() => void refreshJobs()}>
              <Text style={styles.refresh}>Refresh</Text>
            </Pressable>
          </View>

          {pendingOffers.length === 0 ? (
            <Text style={styles.info}>No pending offers right now.</Text>
          ) : null}

          {pendingOffers.map((offer) => (
            <View key={offer.id} style={styles.offerItem}>
              <View style={styles.offerCopy}>
                <Text style={styles.offerTitle}>Order {offer.orderId.slice(0, 8)}</Text>
                <Text style={styles.offerMeta}>{offer.order?.pickupAddress}</Text>
                <Text style={styles.offerMeta}>ETA {offer.routeEtaMinutes} min • {offer.vehicleMatchType}</Text>
              </View>
              <View style={styles.offerActions}>
                <Pressable style={[styles.offerButton, styles.offerAccept]} onPress={() => void acceptOffer(offer.id)}>
                  <Text style={styles.offerButtonText}>Accept</Text>
                </Pressable>
                <Pressable style={[styles.offerButton, styles.offerReject]} onPress={() => void rejectOffer(offer.id)}>
                  <Text style={[styles.offerButtonText, { color: colors.accent }]}>Reject</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.offerNavButton}
                onPress={() =>
                  void navigateToTarget(
                    { lat: offer.order?.pickupLat, lng: offer.order?.pickupLng },
                    'Offer pickup location is not available yet.'
                  )
                }
              >
                <Text style={styles.offerNavButtonText}>Open Pickup in Google Maps</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Job</Text>
          {currentJob ? (
            <>
              <Text style={styles.info}>Trip: {currentJob.id}</Text>
              <Text style={styles.info}>Status: {currentJob.status}</Text>
              <Text style={styles.info}>Pickup: {currentJob.order?.pickupAddress}</Text>
              <Text style={styles.info}>Drop: {currentJob.order?.dropAddress}</Text>

              <Pressable
                style={styles.navButton}
                onPress={() =>
                  void navigateToTarget(
                    { lat: currentNavigationTarget?.lat, lng: currentNavigationTarget?.lng },
                    'Current trip location coordinates are not available yet.'
                  )
                }
              >
                <Text style={styles.navButtonText}>{currentNavigationTarget?.label ?? 'Open in Google Maps'}</Text>
              </Pressable>

              {activeAction ? (
                <Pressable style={styles.mainActionButton} onPress={() => void runAction()}>
                  <Text style={styles.mainActionText}>{activeAction.label}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.info}>No active job.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next Job (Accepted Queue)</Text>
          {nextJob ? (
            <>
              <Text style={styles.info}>Order: {nextJob.id}</Text>
              <Text style={styles.info}>Pickup: {nextJob.pickupAddress}</Text>
              <Text style={styles.info}>Drop: {nextJob.dropAddress}</Text>
              <Pressable
                style={styles.navButton}
                onPress={() =>
                  void navigateToTarget(
                    { lat: nextJob.pickupLat, lng: nextJob.pickupLng },
                    'Queued job pickup coordinates are not available yet.'
                  )
                }
              >
                <Text style={styles.navButtonText}>Navigate to Queued Pickup</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.info}>No queued job accepted yet.</Text>
          )}
        </View>
      </ScrollView>
      <DeliveryProofModal
        visible={deliveryProofVisible}
        submitting={deliveryProofSubmitting}
        onClose={() => {
          setDeliveryProofVisible(false);
          setCompletionMetrics({});
        }}
        onSubmit={submitDeliveryProof}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: { fontFamily: typography.bodyBold, color: colors.accent },
  refresh: { fontFamily: typography.bodyBold, color: colors.secondary },
  info: { fontFamily: typography.body, color: colors.mutedText },
  offerItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: '#FFF7ED'
  },
  offerCopy: { gap: 2 },
  offerTitle: { fontFamily: typography.bodyBold, color: colors.accent },
  offerMeta: { fontFamily: typography.body, color: colors.mutedText, fontSize: 12 },
  offerActions: { flexDirection: 'row', gap: spacing.xs },
  offerButton: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  offerAccept: { backgroundColor: colors.secondary },
  offerReject: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74'
  },
  offerButtonText: { color: colors.white, fontFamily: typography.bodyBold },
  offerNavButton: {
    marginTop: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    backgroundColor: '#ECFDF5'
  },
  offerNavButtonText: {
    color: colors.secondary,
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
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
    color: colors.secondary,
    fontFamily: typography.bodyBold
  },
  mainActionButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  mainActionText: {
    color: colors.white,
    fontFamily: typography.bodyBold
  }
});
