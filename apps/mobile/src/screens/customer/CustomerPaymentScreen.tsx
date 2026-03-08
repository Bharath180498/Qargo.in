import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
}> = [
  { id: 'UPI_SCAN_PAY', title: 'UPI Scan and Pay', description: 'Fastest in India' },
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
  const baseAmount = Number(estimatedPrice ?? 0);
  const isCardMethod = CARD_METHODS.includes(selectedMethod);
  const cardSurchargeAmount = isCardMethod ? Math.round(baseAmount * 0.025 * 100) / 100 : 0;
  const payableAmount = Math.round((baseAmount + cardSurchargeAmount) * 100) / 100;

  useEffect(() => {
    let cancelled = false;

    const loadOrderPaymentProfile = async () => {
      if (!orderId) {
        setDriverDirectProfile({ paymentMethods: [] });
        setSelectedDriverPaymentMethodId(undefined);
        return;
      }

      setLoadingDriverProfile(true);
      try {
        const response = await api.get(`/orders/${orderId}`);
        if (cancelled) {
          return;
        }

        const payload = response.data as {
          trip?: {
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

        const preferredMethod = paymentMethods.find((method) => method.isPreferred) ?? paymentMethods[0];

        setDriverDirectProfile({
          name: normalize(payload.trip?.driver?.user?.name),
          upiId: preferredMethod?.upiId ?? normalize(payload.trip?.driver?.payoutAccount?.upiId),
          upiQrImageUrl:
            preferredMethod?.qrImageUrl ?? normalize(payload.trip?.driver?.payoutAccount?.upiQrImageUrl),
          paymentMethodId: preferredMethod?.id,
          paymentMethods
        });
        setSelectedDriverPaymentMethodId(preferredMethod?.id);
      } catch {
        if (!cancelled) {
          setDriverDirectProfile({ paymentMethods: [] });
          setSelectedDriverPaymentMethodId(undefined);
        }
      } finally {
        if (!cancelled) {
          setLoadingDriverProfile(false);
        }
      }
    };

    void loadOrderPaymentProfile();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const selectedDriverPaymentMethod = useMemo(() => {
    const methods = driverDirectProfile.paymentMethods;
    if (!methods.length) {
      return undefined;
    }
    return (
      methods.find((method) => method.id === selectedDriverPaymentMethodId) ??
      methods.find((method) => method.isPreferred) ??
      methods[0]
    );
  }, [driverDirectProfile.paymentMethods, selectedDriverPaymentMethodId]);

  const resolvedDriverUpiId = selectedDriverPaymentMethod?.upiId ?? driverDirectProfile.upiId;
  const resolvedDriverUpiQrImageUrl =
    selectedDriverPaymentMethod?.qrImageUrl ?? driverDirectProfile.upiQrImageUrl;
  const hasDriverDirectUpi = Boolean(resolvedDriverUpiId);
  const methods = useMemo(() => {
    if (!hasDriverDirectUpi) {
      return METHODS;
    }

    return [
      {
        id: 'DRIVER_UPI_DIRECT' as const,
        title: `Pay driver directly${driverDirectProfile.name ? ` · ${driverDirectProfile.name}` : ''}`,
        description: 'Send full amount to driver UPI'
      },
      ...METHODS
    ];
  }, [driverDirectProfile.name, hasDriverDirectUpi]);

  useEffect(() => {
    if (selectedMethod === 'DRIVER_UPI_DIRECT' && !hasDriverDirectUpi) {
      setPaymentMethod('UPI_SCAN_PAY');
    }
  }, [hasDriverDirectUpi, selectedMethod, setPaymentMethod]);

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

    const preferred = availableMethods.find((method) => method.isPreferred) ?? availableMethods[0];
    setSelectedDriverPaymentMethodId(preferred?.id);
  }, [driverDirectProfile.paymentMethods, selectedDriverPaymentMethodId]);

  const driverUpiIntentUrl = useMemo(() => {
    if (!resolvedDriverUpiId || !(baseAmount > 0)) {
      return undefined;
    }

    const params = new URLSearchParams({
      pa: resolvedDriverUpiId,
      pn: driverDirectProfile.name ?? 'Driver',
      tn: `Qargo ride payment ${orderId?.slice(0, 8) ?? ''}`,
      am: baseAmount.toFixed(2),
      cu: 'INR'
    });

    return `upi://pay?${params.toString()}`;
  }, [baseAmount, driverDirectProfile.name, orderId, resolvedDriverUpiId]);

  const driverUpiQrImageUrl = useMemo(() => {
    if (!resolvedDriverUpiId) {
      return undefined;
    }

    if (resolvedDriverUpiQrImageUrl) {
      return resolvedDriverUpiQrImageUrl;
    }

    if (!driverUpiIntentUrl) {
      return undefined;
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(driverUpiIntentUrl)}`;
  }, [driverUpiIntentUrl, resolvedDriverUpiId, resolvedDriverUpiQrImageUrl]);

  const buttonLabel = useMemo(() => {
    if (orderId && estimatedPrice) {
      if (selectedMethod === 'CASH') {
        return 'Confirm Cash on Delivery';
      }
      if (selectedMethod === 'DRIVER_UPI_DIRECT') {
        return `Pay driver INR ${estimatedPrice.toFixed(2)}`;
      }
      if (selectedMethod === 'UPI_SCAN_PAY') {
        return `Pay INR ${estimatedPrice.toFixed(2)} via UPI`;
      }
      return `Pay INR ${payableAmount.toFixed(2)} (incl. card fee)`;
    }

    return 'Done';
  }, [estimatedPrice, orderId, payableAmount, selectedMethod]);

  const askForUpiConfirmation = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        'UPI Payment',
        'Did the UPI app show payment success?',
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
    if (!orderId || !estimatedPrice) {
      navigation.goBack();
      return;
    }

    setSubmitting(true);
    try {
      const isDirectToDriver = selectedMethod === 'DRIVER_UPI_DIRECT';
      const provider =
        selectedMethod === 'UPI_SCAN_PAY' || isDirectToDriver
          ? 'UPI'
          : selectedMethod === 'CASH'
            ? 'WALLET'
            : 'RAZORPAY';

      if (isDirectToDriver && !resolvedDriverUpiId) {
        Alert.alert('Driver UPI unavailable', 'Driver UPI details are not available for this trip yet.');
        return;
      }

      const intent = await api.post('/payments/create-intent', {
        orderId,
        provider,
        amount: provider === 'RAZORPAY' ? payableAmount : baseAmount,
        directPayToDriver: isDirectToDriver || undefined,
        directUpiVpa: isDirectToDriver ? resolvedDriverUpiId : undefined,
        directUpiName: isDirectToDriver ? driverDirectProfile.name : undefined,
        driverPaymentMethodId: isDirectToDriver ? selectedDriverPaymentMethod?.id : undefined
      });

      if (provider === 'WALLET') {
        Alert.alert(
          'Cash on Delivery Selected',
          'Payment will remain pending until handover. Driver will collect cash or direct UPI at delivery.'
        );
        await Promise.all([refreshOrder(), refreshTimeline()]);
        navigation.goBack();
        return;
      }

      let success = true;
      let providerReference = `PAY_${Date.now()}`;

      if (provider === 'UPI') {
        const upiIntentUrl =
          (intent.data?.upiIntentUrl as string | undefined) ||
          (isDirectToDriver ? driverUpiIntentUrl : undefined);
        if (upiIntentUrl) {
          const canOpen = await Linking.canOpenURL(upiIntentUrl);
          if (canOpen) {
            await Linking.openURL(upiIntentUrl);
          }
        }

        success = await askForUpiConfirmation();
        providerReference = `UPI_${Date.now()}`;
      } else if (provider === 'RAZORPAY') {
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
          provider === 'RAZORPAY'
            ? `Payment confirmed. Card surcharge applied: INR ${cardSurchargeAmount.toFixed(2)}`
            : isDirectToDriver
              ? 'Payment confirmed directly to driver UPI.'
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
          </View>

          {selectedMethod === 'DRIVER_UPI_DIRECT' ? (
            <View style={styles.driverDirectCard}>
              <Text style={styles.driverDirectTitle}>Driver direct payout</Text>
              {loadingDriverProfile ? (
                <ActivityIndicator color="#0F766E" />
              ) : (
                <>
                  <Text style={styles.driverDirectLine}>Driver: {driverDirectProfile.name ?? 'Assigned driver'}</Text>
                  <Text style={styles.driverDirectLine}>UPI ID: {resolvedDriverUpiId ?? 'Not available'}</Text>
                  {driverDirectProfile.paymentMethods.length > 1 ? (
                    <View style={styles.driverMethodChipRow}>
                      {driverDirectProfile.paymentMethods.map((method) => {
                        const isSelected = method.id === selectedDriverPaymentMethod?.id;
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
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  {driverUpiQrImageUrl ? <Image source={{ uri: driverUpiQrImageUrl }} style={styles.qrImage} /> : null}
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
              return (
                <Pressable
                  key={method.id}
                  style={[styles.methodCard, selected && styles.methodCardSelected]}
                  onPress={() => setPaymentMethod(method.id)}
                >
                  <View style={styles.methodCopy}>
                    <Text style={styles.methodTitle}>{method.title}</Text>
                    <Text style={styles.methodDescription}>{method.description}</Text>
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
  qrImage: {
    width: 168,
    height: 168,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 4,
    backgroundColor: '#FFFFFF'
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
