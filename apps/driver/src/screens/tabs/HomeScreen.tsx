import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverAppStore } from '../../store/useDriverAppStore';
import { useDriverI18n } from '../../i18n/useDriverI18n';
import { useDriverUxStore } from '../../store/useDriverUxStore';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { openGoogleMapsNavigation } from '../../utils/mapsNavigation';
import { speakDriverMessage } from '../../utils/voiceGuide';
import { DeliveryProofModal, type DeliveryProofSubmission } from '../../components/DeliveryProofModal';
import type { DriverTabParamList } from '../../types';
import api, { SUPPORT_PHONE, maskPhone } from '../../services/api';
import { useDriverSessionStore } from '../../store/useDriverSessionStore';

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

interface CompletionMetrics {
  distanceKm?: number;
  durationMinutes?: number;
}

interface OfferPaymentMethod {
  id: string;
  label?: string;
  upiId: string;
  isPreferred: boolean;
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

function getAvailabilityCopy(status?: 'ONLINE' | 'OFFLINE' | 'BUSY', t?: (key: any) => string) {
  if (!t) {
    return '';
  }

  if (status === 'ONLINE') {
    return t('home.availability.online');
  }
  if (status === 'BUSY') {
    return t('home.availability.busy');
  }
  return t('home.availability.offline');
}

export function HomeScreen() {
  const { t } = useDriverI18n();
  const navigation = useNavigation<BottomTabNavigationProp<DriverTabParamList>>();
  const availabilityStatus = useDriverAppStore((state) => state.availabilityStatus);
  const setAvailability = useDriverAppStore((state) => state.setAvailability);
  const updateLocation = useDriverAppStore((state) => state.updateLocation);
  const currentJob = useDriverAppStore((state) => state.currentJob);
  const nextJob = useDriverAppStore((state) => state.nextJob);
  const pendingOffers = useDriverAppStore((state) => state.pendingOffers);
  const earnings = useDriverAppStore((state) => state.earnings);
  const acceptOffer = useDriverAppStore((state) => state.acceptOffer);
  const rejectOffer = useDriverAppStore((state) => state.rejectOffer);
  const runTripAction = useDriverAppStore((state) => state.runTripAction);
  const completeTripWithDeliveryProof = useDriverAppStore((state) => state.completeTripWithDeliveryProof);
  const sessionUser = useDriverSessionStore((state) => state.user);

  const voiceGuidanceEnabled = useDriverUxStore((state) => state.voiceGuidanceEnabled);
  const guidedHintsEnabled = useDriverUxStore((state) => state.guidedHintsEnabled);

  const [lastKnownLocation, setLastKnownLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [deliveryProofVisible, setDeliveryProofVisible] = useState(false);
  const [deliveryProofSubmitting, setDeliveryProofSubmitting] = useState(false);
  const [completionMetrics, setCompletionMetrics] = useState<CompletionMetrics>({});
  const [offerPaymentPickerVisible, setOfferPaymentPickerVisible] = useState(false);
  const [offerPaymentMethods, setOfferPaymentMethods] = useState<OfferPaymentMethod[]>([]);
  const [selectedOfferPaymentMethodId, setSelectedOfferPaymentMethodId] = useState<string>();
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const maskedSupportPhone = useMemo(() => maskPhone(SUPPORT_PHONE), []);

  const callSupport = async () => {
    Alert.alert(
      'Message support first',
      'Please create or reply to a support ticket first. We aim to resolve within 6 hours. If unresolved in 24 hours, call support to escalate.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Support Center', onPress: () => navigation.navigate('Support') }
      ]
    );
  };

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const previousOfferId = useRef<string | undefined>(undefined);
  const previousStatus = useRef<string | undefined>(undefined);

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

  const assistantText = useMemo(() => {
    if (activeOffer) {
      return t('home.assistant.offer');
    }
    if (currentJob) {
      return t('home.assistant.current');
    }
    return t('home.assistant.idle');
  }, [activeOffer, currentJob, t]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeOffer?.id && previousOfferId.current !== activeOffer.id) {
      previousOfferId.current = activeOffer.id;
      speakDriverMessage(t('home.assistant.offer'), voiceGuidanceEnabled);
    }

    if (!activeOffer?.id) {
      previousOfferId.current = undefined;
    }
  }, [activeOffer?.id, t, voiceGuidanceEnabled]);

  useEffect(() => {
    if (activeOffer?.id) {
      return;
    }
    setOfferPaymentPickerVisible(false);
    setOfferPaymentMethods([]);
    setSelectedOfferPaymentMethodId(undefined);
  }, [activeOffer?.id]);

  useEffect(() => {
    const currentStatus = currentJob?.status;
    if (!currentStatus) {
      previousStatus.current = undefined;
      return;
    }

    if (previousStatus.current !== currentStatus) {
      previousStatus.current = currentStatus;
      const stageLabel = TRIP_STAGES.find((entry) => entry.key === currentStatus)?.label ?? currentStatus;
      speakDriverMessage(`Trip stage: ${stageLabel}`, voiceGuidanceEnabled);
    }
  }, [currentJob?.status, voiceGuidanceEnabled]);

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

    if (activeAction.endpoint === 'complete') {
      setCompletionMetrics(extractCompletionMetrics(activeAction.payload));
      setDeliveryProofVisible(true);
      return;
    }

    try {
      await runTripAction(currentJob.id, activeAction.endpoint, activeAction.payload);
      speakDriverMessage(activeAction.label, voiceGuidanceEnabled);
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
      speakDriverMessage('Delivery proof captured. Trip completed.', voiceGuidanceEnabled);
    } catch {
      Alert.alert('Completion failed', 'Could not upload delivery proof. Check network and retry.');
    } finally {
      setDeliveryProofSubmitting(false);
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

  const onAcceptOffer = async () => {
    if (!activeOffer?.id) {
      return;
    }

    const userId = sessionUser?.id;
    if (!userId) {
      await acceptOffer(activeOffer.id);
      speakDriverMessage('Job accepted. Start navigation now.', voiceGuidanceEnabled);
      return;
    }

    setAcceptingOffer(true);
    try {
      const response = await api.get('/driver-onboarding/payment-methods', {
        params: { userId }
      });

      const methods = Array.isArray(response.data)
        ? (response.data
            .map((row) => {
              if (!row || typeof row !== 'object') {
                return null;
              }
              const candidate = row as Record<string, unknown>;
              const id = typeof candidate.id === 'string' ? candidate.id : '';
              const upiId = typeof candidate.upiId === 'string' ? candidate.upiId : '';
              if (!id || !upiId) {
                return null;
              }
              return {
                id,
                label:
                  typeof candidate.label === 'string' && candidate.label.trim()
                    ? candidate.label.trim()
                    : undefined,
                upiId: upiId.trim().toLowerCase(),
                isPreferred: Boolean(candidate.isPreferred)
              } satisfies OfferPaymentMethod;
            })
            .filter((method) => method !== null) as OfferPaymentMethod[])
        : [];

      const preferred = methods.find((method) => method.isPreferred) ?? methods[0];
      await acceptOffer(activeOffer.id, preferred?.id);
      speakDriverMessage('Job accepted. Start navigation now.', voiceGuidanceEnabled);
    } catch {
      await acceptOffer(activeOffer.id);
      speakDriverMessage('Job accepted. Start navigation now.', voiceGuidanceEnabled);
    } finally {
      setAcceptingOffer(false);
    }
  };

  const confirmOfferPaymentMethod = async () => {
    if (!activeOffer?.id) {
      return;
    }

    setAcceptingOffer(true);
    try {
      await acceptOffer(activeOffer.id, selectedOfferPaymentMethodId);
      setOfferPaymentPickerVisible(false);
      setOfferPaymentMethods([]);
      setSelectedOfferPaymentMethodId(undefined);
      speakDriverMessage('Job accepted. Start navigation now.', voiceGuidanceEnabled);
    } catch {
      Alert.alert('Could not accept offer', 'Please try again.');
    } finally {
      setAcceptingOffer(false);
    }
  };

  const onRejectOffer = async () => {
    if (!activeOffer?.id) {
      return;
    }
    await rejectOffer(activeOffer.id);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('home.title')}</Text>
          <LanguageSwitcher />
        </View>

        {guidedHintsEnabled ? (
          <View style={styles.assistantCard}>
            <Text style={styles.assistantTitle}>{t('home.assistant.title')}</Text>
            <Text style={styles.assistantText}>{assistantText}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('home.availability.title')}</Text>
          <Text style={styles.status}>{getAvailabilityCopy(availabilityStatus, t)}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.toggleButton, styles.onlineButton]} onPress={() => void setAvailability('ONLINE')}>
              <Text style={styles.toggleButtonText}>{t('home.online')}</Text>
            </Pressable>
            <Pressable style={[styles.toggleButton, styles.offlineButton]} onPress={() => void setAvailability('OFFLINE')}>
              <Text style={[styles.toggleButtonText, { color: colors.accent }]}>{t('home.offline')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, styles.earningsCard]}>
          <Text style={styles.cardTitle}>Earnings Snapshot</Text>
          <Text style={styles.earningsValue}>
            INR {(earnings?.summary.takeHomeAfterSubscription ?? earnings?.summary.netPayout ?? 0).toFixed(2)}
          </Text>
          <Text style={styles.info}>Trips (30d): {earnings?.tripCount ?? 0}</Text>
          <Text style={styles.info}>Plan: {earnings?.subscription?.plan ?? 'GO'}</Text>
          <Text style={styles.info}>Open Earnings tab to view full payout and plan details.</Text>
        </View>

        <View style={[styles.card, activeOffer ? styles.offerCardHighlight : undefined]}>
          <View style={styles.offerHeaderRow}>
            <Text style={styles.cardTitle}>{t('home.offer.title')}</Text>
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
                  onPress={() => void onAcceptOffer()}
                  disabled={acceptingOffer}
                >
                  {acceptingOffer ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.toggleButtonText}>{t('home.offer.accept')}</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.toggleButton, styles.offlineButton]}
                  onPress={() => void onRejectOffer()}
                >
                  <Text style={[styles.toggleButtonText, { color: colors.accent }]}>{t('home.offer.skip')}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.navButton} onPress={() => void navigateToOfferPickup()}>
                <Text style={styles.navButtonText}>{t('home.offer.navigate')}</Text>
              </Pressable>
              {pendingOffers.length > 1 ? (
                <Text style={styles.offerQueueNote}>+{pendingOffers.length - 1} more offer(s) waiting</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.info}>{t('home.offer.none')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('home.trip.title')}</Text>
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
                  {currentJob.status === 'IN_TRANSIT' ? t('home.trip.navigateDrop') : t('home.trip.navigatePickup')}
                </Text>
              </Pressable>
              {activeAction ? (
                <Pressable style={styles.mainActionButton} onPress={() => void runCurrentAction()}>
                  <Text style={styles.mainActionText}>{activeAction.label}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.info}>{t('home.trip.none')}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('home.queue.title')}</Text>
          {nextJob ? (
            <>
              <Text style={styles.info}>Order ID: {nextJob.id}</Text>
              <Text style={styles.info}>Pickup: {nextJob.pickupAddress}</Text>
              <Text style={styles.info}>Drop: {nextJob.dropAddress}</Text>
            </>
          ) : (
            <Text style={styles.info}>{t('home.queue.none')}</Text>
          )}
        </View>

        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>{t('home.support')}</Text>
          <Text style={styles.supportSub}>
            Message support first. We aim to resolve in 6 hours. If unresolved in 24 hours, escalate by call.
          </Text>
          <Text style={styles.supportPhone}>{maskedSupportPhone}</Text>
          <View style={styles.supportActionRow}>
            <Pressable style={styles.supportActionPrimary} onPress={() => navigation.navigate('Support')}>
              <Text style={styles.supportActionPrimaryText}>Open Support Center</Text>
            </Pressable>
            <Pressable style={styles.supportActionGhost} onPress={() => void callSupport()}>
              <Text style={styles.supportActionGhostText}>Call (24h+)</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <Modal
        animationType="slide"
        transparent
        visible={offerPaymentPickerVisible}
        onRequestClose={() => setOfferPaymentPickerVisible(false)}
      >
        <View style={styles.offerPaymentModalBackdrop}>
          <View style={styles.offerPaymentModalCard}>
            <Text style={styles.offerPaymentModalTitle}>Select preferred UPI for this ride</Text>
            <Text style={styles.offerPaymentModalSub}>
              Customer will see this as your recommended direct payment account.
            </Text>
            <View style={styles.offerPaymentMethodList}>
              {offerPaymentMethods.map((method) => {
                const selected = method.id === selectedOfferPaymentMethodId;
                return (
                  <Pressable
                    key={method.id}
                    style={[styles.offerPaymentMethodRow, selected && styles.offerPaymentMethodRowSelected]}
                    onPress={() => setSelectedOfferPaymentMethodId(method.id)}
                  >
                    <Text style={styles.offerPaymentMethodLabel}>
                      {method.label || method.upiId}
                      {method.isPreferred ? ' • Primary' : ''}
                    </Text>
                    <Text style={styles.offerPaymentMethodUpi}>{method.upiId}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.offerPaymentModalActions}>
              <Pressable
                style={styles.offerPaymentCancelButton}
                onPress={() => {
                  setOfferPaymentPickerVisible(false);
                  setOfferPaymentMethods([]);
                  setSelectedOfferPaymentMethodId(undefined);
                }}
                disabled={acceptingOffer}
              >
                <Text style={styles.offerPaymentCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.offerPaymentConfirmButton}
                onPress={() => void confirmOfferPaymentMethod()}
                disabled={acceptingOffer}
              >
                {acceptingOffer ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.offerPaymentConfirmText}>Accept Job</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingBottom: 120
  },
  earningsCard: {
    borderColor: '#99F6E4',
    backgroundColor: '#ECFEFF'
  },
  earningsValue: {
    fontFamily: typography.heading,
    color: colors.secondary,
    fontSize: 28
  },
  headerRow: {
    gap: spacing.sm
  },
  title: { fontFamily: typography.heading, color: colors.accent, fontSize: 30 },
  assistantCard: {
    borderWidth: 1,
    borderColor: '#99F6E4',
    backgroundColor: '#ECFEFF',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 6
  },
  assistantTitle: {
    fontFamily: typography.bodyBold,
    color: '#134E4A',
    fontSize: 14
  },
  assistantText: {
    fontFamily: typography.body,
    color: colors.accent,
    fontSize: 13
  },
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
    justifyContent: 'center',
    minHeight: 52,
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
    color: colors.white,
    fontSize: 15
  },
  info: { fontFamily: typography.body, color: colors.mutedText },
  navButton: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#ECFDF5',
    minHeight: 48,
    justifyContent: 'center'
  },
  navButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.secondary,
    fontSize: 14
  },
  mainActionButton: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 54,
    backgroundColor: colors.primary
  },
  mainActionText: {
    fontFamily: typography.bodyBold,
    color: colors.white,
    fontSize: 15
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
  },
  supportCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    padding: spacing.sm,
    gap: 4
  },
  supportTitle: {
    fontFamily: typography.bodyBold,
    color: '#1D4ED8'
  },
  supportSub: {
    fontFamily: typography.body,
    color: '#334155',
    fontSize: 12
  },
  supportPhone: {
    fontFamily: typography.bodyBold,
    color: '#0F172A'
  },
  supportActionRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs
  },
  supportActionPrimary: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
    paddingVertical: 8,
    alignItems: 'center'
  },
  supportActionPrimaryText: {
    fontFamily: typography.bodyBold,
    color: '#EFF6FF',
    fontSize: 12
  },
  supportActionGhost: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center'
  },
  supportActionGhostText: {
    fontFamily: typography.bodyBold,
    color: '#1E3A8A',
    fontSize: 12
  },
  offerPaymentModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: spacing.md
  },
  offerPaymentModalCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm
  },
  offerPaymentModalTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 16
  },
  offerPaymentModalSub: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  offerPaymentMethodList: {
    gap: 8
  },
  offerPaymentMethodRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  offerPaymentMethodRowSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#ECFDF5'
  },
  offerPaymentMethodLabel: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 13
  },
  offerPaymentMethodUpi: {
    marginTop: 2,
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  offerPaymentModalActions: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs
  },
  offerPaymentCancelButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center'
  },
  offerPaymentCancelText: {
    fontFamily: typography.bodyBold,
    color: '#334155',
    fontSize: 13
  },
  offerPaymentConfirmButton: {
    borderRadius: radius.sm,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    minWidth: 110,
    alignItems: 'center'
  },
  offerPaymentConfirmText: {
    fontFamily: typography.bodyBold,
    color: colors.white,
    fontSize: 13
  }
});
