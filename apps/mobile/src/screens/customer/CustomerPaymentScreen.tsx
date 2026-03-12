import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../../services/api';
import { type PaymentMethod, useCustomerStore } from '../../store/useCustomerStore';
import type { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerPayment'>;

const METHODS: Array<{
  id: PaymentMethod;
  title: string;
  description: string;
  requiresAssignedTrip?: boolean;
}> = [
  {
    id: 'UPI_SCAN_PAY',
    title: 'UPI Scan and Pay',
    description: 'Fastest in India',
    requiresAssignedTrip: true
  },
  { id: 'VISA_5496', title: 'Visa ....5496', description: 'Credit / debit card · +2.5% surcharge' },
  { id: 'MASTERCARD_6802', title: 'Mastercard ....6802', description: 'Credit / debit card · +2.5% surcharge' },
  { id: 'CASH', title: 'Cash at delivery', description: 'Pay driver on completion' }
];

const CARD_METHODS: PaymentMethod[] = ['VISA_5496', 'MASTERCARD_6802'];

interface DriverDirectPaymentProfile {
  name?: string;
  upiId?: string;
  upiQrImageUrl?: string;
  paymentMethodId?: string;
  tripPreferredPaymentMethodId?: string;
  tripPreferredUpiId?: string;
  tripPreferredPaymentLabel?: string;
  tripPreferredUpiQrImageUrl?: string;
  paymentMethods: Array<{
    id: string;
    label?: string;
    upiId: string;
    qrImageUrl?: string;
    isPreferred: boolean;
  }>;
}

function normalize(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }
  return amount;
}

function normalizeStatus(value: unknown) {
  const status = normalize(value);
  return status ? status.toUpperCase() : undefined;
}

export function CustomerPaymentScreen({ navigation }: Props) {
  const selectedMethod = useCustomerStore((state) => state.paymentMethod);
  const setPaymentMethod = useCustomerStore((state) => state.setPaymentMethod);
  const orderId = useCustomerStore((state) => state.activeOrderId);
  const estimatedPrice = useCustomerStore((state) => state.estimatedPrice);
  const refreshOrder = useCustomerStore((state) => state.refreshOrder);
  const refreshTimeline = useCustomerStore((state) => state.refreshTimeline);

  const [submitting, setSubmitting] = useState(false);
  const [driverDirectProfile, setDriverDirectProfile] = useState<DriverDirectPaymentProfile>({
    paymentMethods: []
  });
  const [loadingDriverProfile, setLoadingDriverProfile] = useState(false);
  const [selectedDriverPaymentMethodId, setSelectedDriverPaymentMethodId] = useState<string>();
  const [orderAmount, setOrderAmount] = useState<number>(parseAmount(estimatedPrice) ?? 0);
  const [orderStatus, setOrderStatus] = useState<string>();
  const [tripStatus, setTripStatus] = useState<string>();
  const [paymentStatus, setPaymentStatus] = useState<string>();
  const baseAmount = orderAmount > 0 ? orderAmount : Number(estimatedPrice ?? 0);
  const isCardMethod = CARD_METHODS.includes(selectedMethod);
  const cardSurchargeAmount = isCardMethod ? Math.round(baseAmount * 0.025 * 100) / 100 : 0;
  const payableAmount = Math.round((baseAmount + cardSurchargeAmount) * 100) / 100;
  const upiEnabled = Boolean(
    (tripStatus && tripStatus !== 'CANCELLED') ||
      orderStatus === 'ASSIGNED' ||
      orderStatus === 'AT_PICKUP' ||
      orderStatus === 'LOADING' ||
      orderStatus === 'IN_TRANSIT' ||
      orderStatus === 'DELIVERED'
  );

  const loadOrderPaymentProfile = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!orderId) {
        setDriverDirectProfile({ paymentMethods: [] });
        setSelectedDriverPaymentMethodId(undefined);
        setOrderAmount(parseAmount(estimatedPrice) ?? 0);
        setOrderStatus(undefined);
        setTripStatus(undefined);
        setPaymentStatus(undefined);
        return;
      }

      if (!options?.silent) {
        setLoadingDriverProfile(true);
      }

      try {
        const response = await api.get(`/orders/${orderId}`);
        const payload = response.data as {
          status?: string;
          estimatedPrice?: number | string;
          finalPrice?: number | string;
          payment?: {
            status?: string;
          };
          trip?: {
            status?: string;
            driverPreferredPaymentMethodId?: string;
            driverPreferredUpiId?: string;
            driverPreferredPaymentLabel?: string;
            driverPreferredUpiQrImageUrl?: string;
            driver?: {
              user?: {
                name?: string;
              };
              payoutAccount?: {
                upiId?: string;
                upiQrImageUrl?: string;
              };
              paymentMethods?: Array<{
                id?: string;
                label?: string;
                upiId?: string;
                qrImageUrl?: string;
                isPreferred?: boolean;
              }>;
            };
          };
        };

        const tripPreferredPaymentMethodId = normalize(payload.trip?.driverPreferredPaymentMethodId);
        const tripPreferredUpiId = normalize(payload.trip?.driverPreferredUpiId);
        const tripPreferredPaymentLabel = normalize(payload.trip?.driverPreferredPaymentLabel);
        const tripPreferredUpiQrImageUrl = normalize(payload.trip?.driverPreferredUpiQrImageUrl);
        const resolvedAmount =
          parseAmount(payload.finalPrice) ??
          parseAmount(payload.estimatedPrice) ??
          parseAmount(estimatedPrice) ??
          0;

        const paymentMethods = Array.isArray(payload.trip?.driver?.paymentMethods)
          ? payload.trip?.driver?.paymentMethods
              .map((method) => {
                const id = normalize(method.id);
                const upiId = normalize(method.upiId);
                if (!id || !upiId) {
                  return null;
                }
                return {
                  id,
                  label: normalize(method.label),
                  upiId,
                  qrImageUrl: normalize(method.qrImageUrl),
                  isPreferred: Boolean(method.isPreferred)
                };
              })
              .filter(Boolean) as Array<{
              id: string;
              label?: string;
              upiId: string;
              qrImageUrl?: string;
              isPreferred: boolean;
            }>
          : [];

        const tripPreferredMethod = tripPreferredPaymentMethodId
          ? paymentMethods.find((method) => method.id === tripPreferredPaymentMethodId)
          : undefined;
        const preferredMethod =
          tripPreferredMethod ??
          paymentMethods.find((method) => method.isPreferred) ??
          paymentMethods[0];

        setOrderAmount(resolvedAmount);
        setOrderStatus(normalizeStatus(payload.status));
        setTripStatus(normalizeStatus(payload.trip?.status));
        setPaymentStatus(normalizeStatus(payload.payment?.status));
        setDriverDirectProfile({
          name: normalize(payload.trip?.driver?.user?.name),
          upiId:
            tripPreferredUpiId ??
            preferredMethod?.upiId ??
            normalize(payload.trip?.driver?.payoutAccount?.upiId),
          upiQrImageUrl:
            tripPreferredUpiQrImageUrl ??
            preferredMethod?.qrImageUrl ??
            normalize(payload.trip?.driver?.payoutAccount?.upiQrImageUrl),
          paymentMethodId: preferredMethod?.id,
          tripPreferredPaymentMethodId,
          tripPreferredUpiId,
          tripPreferredPaymentLabel,
          tripPreferredUpiQrImageUrl,
          paymentMethods
        });
        setSelectedDriverPaymentMethodId(tripPreferredMethod?.id ?? preferredMethod?.id);
      } catch {
        setDriverDirectProfile({ paymentMethods: [] });
        setSelectedDriverPaymentMethodId(undefined);
        setOrderAmount(parseAmount(estimatedPrice) ?? 0);
        setOrderStatus(undefined);
        setTripStatus(undefined);
        setPaymentStatus(undefined);
      } finally {
        if (!options?.silent) {
          setLoadingDriverProfile(false);
        }
      }
    },
    [estimatedPrice, orderId]
  );

  useEffect(() => {
    void loadOrderPaymentProfile();
  }, [loadOrderPaymentProfile]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const interval = setInterval(() => {
      void loadOrderPaymentProfile({ silent: true });
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [loadOrderPaymentProfile, orderId]);

  const selectedDriverPaymentMethod = useMemo(() => {
    const methods = driverDirectProfile.paymentMethods;
    if (!methods.length) {
      return undefined;
    }
    const tripPreferredMethod = driverDirectProfile.tripPreferredPaymentMethodId
      ? methods.find((method) => method.id === driverDirectProfile.tripPreferredPaymentMethodId)
      : undefined;
    return (
      methods.find((method) => method.id === selectedDriverPaymentMethodId) ??
      tripPreferredMethod ??
      methods.find((method) => method.isPreferred) ??
      methods[0]
    );
  }, [
    driverDirectProfile.paymentMethods,
    driverDirectProfile.tripPreferredPaymentMethodId,
    selectedDriverPaymentMethodId
  ]);

  const resolvedDriverUpiId =
    selectedDriverPaymentMethod?.upiId ??
    driverDirectProfile.tripPreferredUpiId ??
    driverDirectProfile.upiId;
  const hasDriverDirectUpi = Boolean(resolvedDriverUpiId);
  const methods = useMemo(() => {
    if (!hasDriverDirectUpi) {
      return METHODS;
    }

    return [
      {
        id: 'DRIVER_UPI_DIRECT' as const,
        title: `Driver preferred payout${driverDirectProfile.name ? ` · ${driverDirectProfile.name}` : ''}`,
        description: driverDirectProfile.tripPreferredUpiId
          ? `Driver preference: ${driverDirectProfile.tripPreferredUpiId} · Paid via QARGO escrow`
          : 'Driver preference noted · Paid via QARGO escrow',
        requiresAssignedTrip: true
      },
      ...METHODS
    ];
  }, [driverDirectProfile.name, driverDirectProfile.tripPreferredUpiId, hasDriverDirectUpi]);

  useEffect(() => {
    if (
      (selectedMethod === 'DRIVER_UPI_DIRECT' && !hasDriverDirectUpi) ||
      ((selectedMethod === 'DRIVER_UPI_DIRECT' || selectedMethod === 'UPI_SCAN_PAY') && !upiEnabled)
    ) {
      setPaymentMethod('VISA_5496');
    }
  }, [hasDriverDirectUpi, selectedMethod, setPaymentMethod, upiEnabled]);

  useEffect(() => {
    const availableMethods = driverDirectProfile.paymentMethods;
    if (!availableMethods.length) {
      setSelectedDriverPaymentMethodId(undefined);
      return;
    }

    const isCurrentStillAvailable = availableMethods.some(
      (method) => method.id === selectedDriverPaymentMethodId
    );

    if (isCurrentStillAvailable) {
      return;
    }

    const preferred =
      availableMethods.find((method) => method.id === driverDirectProfile.tripPreferredPaymentMethodId) ??
      availableMethods.find((method) => method.isPreferred) ??
      availableMethods[0];
    setSelectedDriverPaymentMethodId(preferred?.id);
  }, [
    driverDirectProfile.paymentMethods,
    driverDirectProfile.tripPreferredPaymentMethodId,
    selectedDriverPaymentMethodId
  ]);

  const buttonLabel = useMemo(() => {
    if (orderId && baseAmount > 0) {
      if (selectedMethod === 'CASH') {
        return 'Confirm Cash on Delivery';
      }
      if (selectedMethod === 'DRIVER_UPI_DIRECT') {
        return `Pay INR ${baseAmount.toFixed(2)} (escrow)`;
      }
      if (selectedMethod === 'UPI_SCAN_PAY') {
        return `Pay INR ${baseAmount.toFixed(2)} via UPI`;
      }
      return `Pay INR ${payableAmount.toFixed(2)} (incl. card fee)`;
    }

    return orderId ? 'Confirm payment setup' : 'Done';
  }, [baseAmount, orderId, payableAmount, selectedMethod]);

  const askForPaymentConfirmation = (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        title,
        message,
        [
          {
            text: 'No',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Yes, paid',
            onPress: () => resolve(true)
          }
        ],
        { cancelable: false }
      );
    });

  const onSubmit = async () => {
    if (!orderId) {
      navigation.goBack();
      return;
    }

    if (paymentStatus === 'CAPTURED') {
      Alert.alert('Already paid', 'Payment for this ride is already completed.');
      return;
    }

    if (!(baseAmount > 0)) {
      Alert.alert('Amount unavailable', 'Please refresh trip details and retry payment.');
      return;
    }

    const usingDriverPreferredRail = selectedMethod === 'DRIVER_UPI_DIRECT';
    const isUpiMethod = selectedMethod === 'UPI_SCAN_PAY' || usingDriverPreferredRail;
    if (isUpiMethod && !upiEnabled) {
      Alert.alert(
        'UPI available after driver acceptance',
        'UPI payments unlock once the driver accepts your ride. You can continue with card/cash for now.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const provider =
        selectedMethod === 'UPI_SCAN_PAY' || usingDriverPreferredRail
          ? 'UPI'
          : selectedMethod === 'CASH'
            ? 'WALLET'
            : 'CASHFREE';

      const intent = await api.post('/payments/create-intent', {
        orderId,
        provider,
        amount: provider === 'CASHFREE' ? payableAmount : baseAmount,
        driverPaymentMethodId: usingDriverPreferredRail ? selectedDriverPaymentMethod?.id : undefined
      });

      if (provider === 'WALLET') {
        Alert.alert(
          'Cash on Delivery Selected',
          'Payment will remain pending until handover. For digital safety, use UPI/card escrow options.'
        );
        await Promise.all([refreshOrder(), refreshTimeline()]);
        navigation.goBack();
        return;
      }

      let success = true;
      let providerReference = String(intent.data?.providerRef ?? `PAY_${Date.now()}`);

      if (provider === 'UPI') {
        const upiIntentUrl = intent.data?.upiIntentUrl as string | undefined;
        if (upiIntentUrl) {
          const canOpen = await Linking.canOpenURL(upiIntentUrl);
          if (canOpen) {
            await Linking.openURL(upiIntentUrl);
          }
        }

        success = await askForPaymentConfirmation(
          'UPI Payment',
          'Did the UPI app show payment success?'
        );
        providerReference = `UPI_${Date.now()}`;
      } else if (provider === 'CASHFREE') {
        const checkoutUrl = intent.data?.checkoutUrl as string | undefined;
        if (checkoutUrl) {
          const canOpen = await Linking.canOpenURL(checkoutUrl);
          if (canOpen) {
            await Linking.openURL(checkoutUrl);
          }
        } else {
          Alert.alert(
            'Payment Link Unavailable',
            'Cashfree checkout link was not returned. Continue only if you completed payment outside the app.'
          );
        }

        success = await askForPaymentConfirmation(
          'Card Payment',
          'Did Cashfree checkout show payment success?'
        );
        providerReference = String(intent.data?.providerRef ?? providerReference);
      }

      await api.post('/payments/confirm', {
        paymentId: intent.data.paymentId,
        success,
        providerReference
      });
      await Promise.all([refreshOrder(), refreshTimeline()]);

      if (success) {
        Alert.alert(
          'Payment Complete',
          provider === 'CASHFREE'
            ? `Payment confirmed. Card surcharge applied: INR ${cardSurchargeAmount.toFixed(2)}`
            : usingDriverPreferredRail
              ? 'Payment confirmed. Funds are held by QARGO and settled to the driver after delivery.'
              : 'Payment confirmed for this order.'
        );
      } else {
        Alert.alert('Payment Pending', 'UPI payment is marked pending/failed. You can retry from tracking.');
      }
      navigation.goBack();
    } catch {
      Alert.alert('Payment failed', 'Could not confirm payment right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeText}>x</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Payment Methods</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Pay the Bharat way</Text>
            <Text style={styles.heroSub}>UPI, cards, or cash. Card payments carry a 2.5% processing surcharge.</Text>
            <Text style={styles.heroMeta}>
              {upiEnabled
                ? 'UPI is active for this ride (during/after trip).'
                : 'UPI unlocks once driver accepts. Cards and cash can be selected now.'}
            </Text>
            <Text style={styles.heroMeta}>All digital payments are held by QARGO and settled after delivery.</Text>
            {driverDirectProfile.tripPreferredPaymentLabel || driverDirectProfile.tripPreferredUpiId ? (
              <Text style={styles.heroMetaStrong}>
                Driver prefers{' '}
                {driverDirectProfile.tripPreferredPaymentLabel ?? driverDirectProfile.tripPreferredUpiId}
              </Text>
            ) : null}
            {paymentStatus === 'CAPTURED' ? (
              <Text style={styles.heroMetaStrong}>Payment already completed for this ride.</Text>
            ) : null}
          </View>

          {selectedMethod === 'DRIVER_UPI_DIRECT' ? (
            <View style={styles.driverDirectCard}>
              <Text style={styles.driverDirectTitle}>Driver payout preference</Text>
              {loadingDriverProfile ? (
                <ActivityIndicator color="#0F766E" />
              ) : (
                <>
                  <Text style={styles.driverDirectLine}>Driver: {driverDirectProfile.name ?? 'Assigned driver'}</Text>
                  <Text style={styles.driverDirectLine}>UPI ID: {resolvedDriverUpiId ?? 'Not available'}</Text>
                  <Text style={styles.driverDirectHint}>Customer payment goes to QARGO escrow first.</Text>
                  {driverDirectProfile.tripPreferredPaymentLabel || driverDirectProfile.tripPreferredUpiId ? (
                    <Text style={styles.driverDirectHint}>
                      Driver prefers:{' '}
                      {driverDirectProfile.tripPreferredPaymentLabel ??
                        driverDirectProfile.tripPreferredUpiId}
                    </Text>
                  ) : null}
                  {driverDirectProfile.paymentMethods.length > 1 ? (
                    <View style={styles.driverMethodChipRow}>
                      {driverDirectProfile.paymentMethods.map((method) => {
                        const isSelected = method.id === selectedDriverPaymentMethod?.id;
                        const isDriverPreferred =
                          method.id === driverDirectProfile.tripPreferredPaymentMethodId;
                        return (
                          <Pressable
                            key={method.id}
                            style={[
                              styles.driverMethodChip,
                              isSelected && styles.driverMethodChipSelected
                            ]}
                            onPress={() => setSelectedDriverPaymentMethodId(method.id)}
                          >
                            <Text
                              style={[
                                styles.driverMethodChipText,
                                isSelected && styles.driverMethodChipTextSelected
                              ]}
                            >
                              {method.label ?? method.upiId}
                              {isDriverPreferred ? ' • Driver preferred' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {isCardMethod ? (
            <View style={styles.surchargeCard}>
              <Text style={styles.surchargeTitle}>Card processing fee</Text>
              <Text style={styles.surchargeLine}>Base fare: INR {baseAmount.toFixed(2)}</Text>
              <Text style={styles.surchargeLine}>Surcharge (2.5%): INR {cardSurchargeAmount.toFixed(2)}</Text>
              <Text style={styles.surchargeTotal}>Total payable: INR {payableAmount.toFixed(2)}</Text>
            </View>
          ) : null}

          <View style={styles.methodList}>
            {methods.map((method) => {
              const selected = method.id === selectedMethod;
              const unavailable = Boolean(method.requiresAssignedTrip && !upiEnabled);
              return (
                <Pressable
                  key={method.id}
                  style={[
                    styles.methodCard,
                    selected && styles.methodCardSelected,
                    unavailable && styles.methodCardDisabled
                  ]}
                  onPress={() => {
                    if (unavailable) {
                      Alert.alert(
                        'Available after driver acceptance',
                        'This UPI option unlocks once your driver accepts the trip.'
                      );
                      return;
                    }
                    setPaymentMethod(method.id);
                  }}
                >
                  <View style={styles.methodCopy}>
                    <Text style={styles.methodTitle}>{method.title}</Text>
                    <Text style={[styles.methodDescription, unavailable && styles.methodDescriptionMuted]}>
                      {method.description}
                      {unavailable ? ' · Available after driver accepts' : ''}
                    </Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <Text style={styles.radioTick}>v</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Pressable style={styles.primaryButton} onPress={() => void onSubmit()} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#ECFEFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
          )}
        </Pressable>
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
    backgroundColor: '#FFF8F1',
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 12
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    color: '#7C2D12',
    fontFamily: 'Manrope_700Bold',
    fontSize: 20
  },
  headerTitle: {
    color: '#7C2D12',
    fontFamily: 'Sora_700Bold',
    fontSize: 17
  },
  hero: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    padding: 14
  },
  heroTitle: {
    color: '#7C2D12',
    fontFamily: 'Sora_700Bold',
    fontSize: 18
  },
  heroSub: {
    marginTop: 4,
    color: '#9A3412',
    fontFamily: 'Manrope_500Medium',
    fontSize: 13
  },
  heroMeta: {
    marginTop: 6,
    color: '#7C2D12',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12
  },
  heroMetaStrong: {
    marginTop: 3,
    color: '#9A3412',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  driverDirectCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#99F6E4',
    backgroundColor: '#ECFEFF',
    padding: 12,
    gap: 6,
    alignItems: 'flex-start'
  },
  driverDirectTitle: {
    color: '#134E4A',
    fontFamily: 'Sora_700Bold',
    fontSize: 15
  },
  driverDirectLine: {
    color: '#0F172A',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12
  },
  driverDirectHint: {
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  driverMethodChipRow: {
    marginTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  driverMethodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  driverMethodChipSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1'
  },
  driverMethodChipText: {
    color: '#134E4A',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11
  },
  driverMethodChipTextSelected: {
    color: '#065F46'
  },
  surchargeCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3
  },
  surchargeTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14
  },
  surchargeLine: {
    color: '#334155',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12
  },
  surchargeTotal: {
    marginTop: 2,
    color: '#0F766E',
    fontFamily: 'Sora_700Bold',
    fontSize: 14
  },
  methodList: {
    marginTop: 12,
    gap: 8
  },
  methodCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  methodCardSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#ECFDF5'
  },
  methodCardDisabled: {
    opacity: 0.6
  },
  methodCopy: {
    flex: 1
  },
  methodTitle: {
    color: '#0F172A',
    fontFamily: 'Manrope_700Bold',
    fontSize: 15
  },
  methodDescription: {
    color: '#64748B',
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    marginTop: 2
  },
  methodDescriptionMuted: {
    color: '#94A3B8'
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#CCFBF1'
  },
  radioTick: {
    color: '#0F766E',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12
  },
  primaryButtonText: {
    color: '#ECFEFF',
    fontFamily: 'Sora_700Bold',
    fontSize: 16,
    textAlign: 'center'
  }
});
