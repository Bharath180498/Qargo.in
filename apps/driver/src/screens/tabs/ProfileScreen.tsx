import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverSessionStore } from '../../store/useDriverSessionStore';
import { useDriverAppStore } from '../../store/useDriverAppStore';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { useDriverI18n } from '../../i18n/useDriverI18n';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useDriverUxStore } from '../../store/useDriverUxStore';

const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i;

interface PickedImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

function normalizeUpiId(value: string) {
  return value.trim().toLowerCase();
}

function isValidUpiId(value: string) {
  return UPI_PATTERN.test(value);
}

function buildUpiIntentUrl(upiId: string, payeeName: string) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName || 'QARGO Driver',
    cu: 'INR',
    tn: 'QARGO payout'
  });

  return `upi://pay?${params.toString()}`;
}

function buildDynamicQrPreviewUrl(upiIntentUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=png&data=${encodeURIComponent(upiIntentUrl)}`;
}

async function pickQrImageFromLibrary(): Promise<PickedImage | null> {
  try {
    const ImagePicker = require('expo-image-picker') as {
      MediaTypeOptions?: { Images?: unknown };
      requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
      launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
        canceled: boolean;
        assets?: PickedImage[];
      }>;
    };

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Allow photo access to upload QR.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images,
      allowsEditing: true,
      quality: 0.8
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    return result.assets[0];
  } catch {
    throw new Error(
      'QR picker is unavailable. Install dependency with: npx expo install expo-image-picker'
    );
  }
}

export function ProfileScreen() {
  const { t } = useDriverI18n();
  const user = useDriverSessionStore((state) => state.user);
  const onboardingStatus = useDriverSessionStore((state) => state.onboardingStatus);
  const refreshOnboardingStatus = useDriverSessionStore((state) => state.refreshOnboardingStatus);
  const logout = useDriverSessionStore((state) => state.logout);
  const driverProfileId = useDriverAppStore((state) => state.driverProfileId);
  const bootstrap = useDriverAppStore((state) => state.bootstrap);
  const disconnectRealtime = useDriverAppStore((state) => state.disconnectRealtime);
  const loadOnboarding = useOnboardingStore((state) => state.load);
  const updateBank = useOnboardingStore((state) => state.updateBank);
  const addPaymentMethod = useOnboardingStore((state) => state.addPaymentMethod);
  const uploadPaymentMethodQr = useOnboardingStore((state) => state.uploadPaymentMethodQr);
  const setPreferredPaymentMethod = useOnboardingStore((state) => state.setPreferredPaymentMethod);
  const onboardingLoading = useOnboardingStore((state) => state.loading);
  const accountHolderName = useOnboardingStore((state) => state.accountHolderName);
  const bankName = useOnboardingStore((state) => state.bankName);
  const accountNumber = useOnboardingStore((state) => state.accountNumber);
  const ifscCode = useOnboardingStore((state) => state.ifscCode);
  const onboardingUpiId = useOnboardingStore((state) => state.upiId);
  const paymentMethods = useOnboardingStore((state) => state.paymentMethods);
  const onboardingError = useOnboardingStore((state) => state.error);
  const simpleMode = useDriverUxStore((state) => state.simpleMode);
  const setSimpleMode = useDriverUxStore((state) => state.setSimpleMode);
  const voiceGuidanceEnabled = useDriverUxStore((state) => state.voiceGuidanceEnabled);
  const setVoiceGuidanceEnabled = useDriverUxStore((state) => state.setVoiceGuidanceEnabled);
  const guidedHintsEnabled = useDriverUxStore((state) => state.guidedHintsEnabled);
  const setGuidedHintsEnabled = useDriverUxStore((state) => state.setGuidedHintsEnabled);

  const [upiId, setUpiId] = useState('');
  const [newUpiId, setNewUpiId] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [addingUpiMethod, setAddingUpiMethod] = useState(false);
  const [showWalletMore, setShowWalletMore] = useState(false);

  useEffect(() => {
    void Promise.all([refreshOnboardingStatus(), bootstrap(), loadOnboarding()]);
  }, [bootstrap, loadOnboarding, refreshOnboardingStatus]);

  useEffect(() => {
    setUpiId(onboardingUpiId);
  }, [onboardingUpiId]);

  const preferredPaymentMethod = useMemo(
    () => paymentMethods.find((method) => method.isPreferred) ?? paymentMethods[0],
    [paymentMethods]
  );

  const normalizedUpi = useMemo(() => normalizeUpiId(upiId), [upiId]);
  const activeUpi = normalizedUpi || preferredPaymentMethod?.upiId || '';

  const upiIntentUrl = useMemo(() => {
    if (!activeUpi || !isValidUpiId(activeUpi)) {
      return '';
    }

    const payeeName = user?.name?.trim() || accountHolderName.trim() || 'QARGO Driver';
    return buildUpiIntentUrl(activeUpi, payeeName);
  }, [accountHolderName, activeUpi, user?.name]);
  const upiReady = Boolean(upiIntentUrl);

  const dynamicQrPreviewUrl = useMemo(() => {
    if (!upiIntentUrl) {
      return '';
    }
    return buildDynamicQrPreviewUrl(upiIntentUrl);
  }, [upiIntentUrl]);

  const savePayoutPreferences = async () => {
    if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
      Alert.alert('Bank details missing', 'Complete payout bank setup first, then add UPI preferences.');
      return;
    }

    if (!normalizedUpi || !isValidUpiId(normalizedUpi)) {
      Alert.alert('Invalid UPI', 'Enter a valid UPI ID (example: driver@okaxis).');
      return;
    }

    try {
      setSavingPayout(true);
      await updateBank({
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        upiId: normalizedUpi
      });
      Alert.alert('Saved', 'Payout wallet updated. Dynamic UPI link is now ready.');
    } catch {
      Alert.alert('Save failed', useOnboardingStore.getState().error ?? 'Unable to save payout details.');
    } finally {
      setSavingPayout(false);
    }
  };

  const addQrCode = async () => {
    if (!normalizedUpi || !isValidUpiId(normalizedUpi)) {
      Alert.alert('Set UPI ID', 'Enter valid UPI ID before uploading a QR code.');
      return;
    }

    let asset: PickedImage | null = null;
    try {
      asset = await pickQrImageFromLibrary();
    } catch (error: unknown) {
      Alert.alert('QR upload setup required', String((error as Error)?.message ?? 'Unable to open image picker.'));
      return;
    }

    if (!asset) {
      return;
    }

    try {
      await uploadPaymentMethodQr({
        fileUri: asset.uri,
        fileName: asset.fileName || undefined,
        contentType: asset.mimeType || 'image/jpeg',
        upiId: normalizedUpi,
        label: `QR ${paymentMethods.length + 1}`,
        isPreferred: paymentMethods.length === 0
      });
    } catch {
      Alert.alert('QR upload failed', useOnboardingStore.getState().error ?? 'Please try again.');
    }
  };

  const shareDynamicUpiLink = async () => {
    if (!upiIntentUrl) {
      Alert.alert('UPI required', 'Add a valid UPI ID first to generate the dynamic payment link.');
      return;
    }

    try {
      await Share.share({
        title: 'Driver UPI Link',
        message: `Pay driver directly via UPI: ${upiIntentUrl}`
      });
    } catch {
      Alert.alert('Share failed', 'Could not share UPI link right now.');
    }
  };

  const addAnotherUpiId = async () => {
    const normalizedNewUpi = normalizeUpiId(newUpiId);
    if (!normalizedNewUpi || !isValidUpiId(normalizedNewUpi)) {
      Alert.alert('Invalid UPI', 'Enter a valid UPI ID (example: driver@okaxis).');
      return;
    }

    const duplicate = paymentMethods.some(
      (method) => normalizeUpiId(method.upiId) === normalizedNewUpi
    );
    if (duplicate) {
      Alert.alert('Already added', 'This UPI ID is already in your wallet.');
      return;
    }

    try {
      setAddingUpiMethod(true);
      await addPaymentMethod({
        upiId: normalizedNewUpi,
        label: `UPI ${paymentMethods.length + 1}`,
        isPreferred: paymentMethods.length === 0
      });
      if (paymentMethods.length === 0) {
        setUpiId(normalizedNewUpi);
      }
      setNewUpiId('');
    } catch {
      Alert.alert('Could not add UPI', useOnboardingStore.getState().error ?? 'Please try again.');
    } finally {
      setAddingUpiMethod(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('profile.title')}</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Name</Text>
          <Text style={styles.fieldValue}>{user?.name ?? '—'}</Text>
          <Text style={styles.fieldLabel}>Phone</Text>
          <Text style={styles.fieldValue}>{user?.phone ?? '—'}</Text>
          <Text style={styles.fieldLabel}>Driver Profile ID</Text>
          <Text style={styles.fieldValue}>{driverProfileId ?? 'Not available yet'}</Text>
          <Text style={styles.fieldLabel}>Onboarding Status</Text>
          <Text style={[styles.fieldValue, styles.status]}>{onboardingStatus ?? 'NOT_STARTED'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('profile.preferences')}</Text>
          <Text style={styles.fieldLabel}>{t('profile.language')}</Text>
          <LanguageSwitcher />

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>{t('profile.simpleMode')}</Text>
            <Pressable
              style={[styles.preferenceToggle, simpleMode && styles.preferenceToggleActive]}
              onPress={() => setSimpleMode(!simpleMode)}
            >
              <Text style={[styles.preferenceToggleText, simpleMode && styles.preferenceToggleTextActive]}>
                {simpleMode ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>{t('profile.voiceGuide')}</Text>
            <Pressable
              style={[styles.preferenceToggle, voiceGuidanceEnabled && styles.preferenceToggleActive]}
              onPress={() => setVoiceGuidanceEnabled(!voiceGuidanceEnabled)}
            >
              <Text style={[styles.preferenceToggleText, voiceGuidanceEnabled && styles.preferenceToggleTextActive]}>
                {voiceGuidanceEnabled ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>{t('profile.hints')}</Text>
            <Pressable
              style={[styles.preferenceToggle, guidedHintsEnabled && styles.preferenceToggleActive]}
              onPress={() => setGuidedHintsEnabled(!guidedHintsEnabled)}
            >
              <Text style={[styles.preferenceToggleText, guidedHintsEnabled && styles.preferenceToggleTextActive]}>
                {guidedHintsEnabled ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payout Wallet</Text>

          <View style={styles.walletHero}>
            <Text style={styles.walletHeroLabel}>QARGO Wallet</Text>
            <Text style={styles.walletHeroTitle}>Receive money to this UPI</Text>
            <Text style={styles.walletPrimaryValue}>{activeUpi || 'Not set yet'}</Text>
            <Text style={styles.walletHeroSubtitle}>
              After you accept a ride, customer sees this UPI first.
            </Text>
            <View style={styles.walletStatsRow}>
              <View style={styles.walletStat}>
                <Text style={styles.walletStatValue}>{preferredPaymentMethod ? 'Active' : 'Pending'}</Text>
                <Text style={styles.walletStatLabel}>Status</Text>
              </View>
              <View style={styles.walletStat}>
                <Text style={styles.walletStatValue}>{paymentMethods.length}</Text>
                <Text style={styles.walletStatLabel}>Saved IDs</Text>
              </View>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Your UPI ID</Text>
          <TextInput
            style={styles.input}
            value={upiId}
            onChangeText={(value) => {
              setUpiId(value);
            }}
            autoCapitalize="none"
            placeholder="driver@okaxis"
            placeholderTextColor={colors.mutedText}
          />
          <Text style={styles.helperText}>Example: name@okaxis</Text>

          {onboardingLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {onboardingError ? <Text style={styles.errorText}>{onboardingError}</Text> : null}

          <View style={styles.walletActionGrid}>
            <Pressable style={styles.walletPrimaryButton} onPress={() => void savePayoutPreferences()} disabled={savingPayout}>
              {savingPayout ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.walletPrimaryButtonText}>Use this UPI for rides</Text>
              )}
            </Pressable>

            <Pressable style={styles.walletMoreButton} onPress={() => setShowWalletMore((previous) => !previous)}>
              <Text style={styles.walletMoreButtonText}>{showWalletMore ? 'Hide extras' : 'More options'}</Text>
            </Pressable>
          </View>

          <View style={styles.walletStackSection}>
            <Text style={styles.fieldLabel}>Saved UPI cards</Text>
            <Text style={styles.walletStackHint}>Tap any card to set it as default for every ride.</Text>
            {paymentMethods.length === 0 ? (
              <Text style={styles.helperText}>No UPI cards yet. Save one UPI ID to start.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.walletStackRow}
              >
                {paymentMethods.map((method, index) => (
                  <Pressable
                    key={method.id}
                    style={[
                      styles.walletMethodCard,
                      index > 0 ? styles.walletMethodCardOverlap : undefined,
                      { zIndex: paymentMethods.length - index },
                      method.isPreferred ? styles.walletMethodCardActive : undefined
                    ]}
                    onPress={() => {
                      setUpiId(method.upiId);
                      if (!method.isPreferred) {
                        void setPreferredPaymentMethod(method.id);
                      }
                    }}
                  >
                    <Text style={styles.walletMethodLabel}>{method.label ?? 'UPI Wallet'}</Text>
                    <Text style={styles.walletMethodUpi}>{method.upiId}</Text>
                    <Text style={styles.walletMethodState}>{method.isPreferred ? 'Default' : 'Tap to make default'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <Text style={styles.fieldLabel}>Add another UPI ID</Text>
          <View style={styles.addUpiRow}>
            <TextInput
              style={[styles.input, styles.addUpiInput]}
              value={newUpiId}
              onChangeText={setNewUpiId}
              autoCapitalize="none"
              placeholder="secondupi@ybl"
              placeholderTextColor={colors.mutedText}
            />
            <Pressable style={styles.addUpiButton} onPress={() => void addAnotherUpiId()} disabled={addingUpiMethod}>
              {addingUpiMethod ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.addUpiButtonText}>Add</Text>
              )}
            </Pressable>
          </View>
          <Text style={styles.helperText}>You can save many UPI IDs and switch default anytime.</Text>

          {upiReady && dynamicQrPreviewUrl ? (
            <View style={styles.dynamicQrCard}>
              <Text style={styles.dynamicQrTitle}>Live UPI QR</Text>
              <Text style={styles.helperText}>Show this if customer wants to pay directly.</Text>
              <Image source={{ uri: dynamicQrPreviewUrl }} style={styles.dynamicQrPreview} />
            </View>
          ) : null}

          {showWalletMore ? (
            <View style={styles.methodList}>
              <Pressable style={styles.secondaryButton} onPress={() => void addQrCode()} disabled={savingPayout}>
                <Text style={styles.secondaryText}>Upload QR Screenshot (optional)</Text>
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={() => void shareDynamicUpiLink()} disabled={!upiReady}>
                <Text style={styles.secondaryText}>Share UPI Link</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => void Promise.all([refreshOnboardingStatus(), bootstrap(), loadOnboarding()])}
        >
          <Text style={styles.secondaryText}>Refresh Status</Text>
        </Pressable>

        <Pressable
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert('Logout', 'End your driver session?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: () => {
                  disconnectRealtime();
                  void logout();
                }
              }
            ]);
          }}
        >
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 460, alignSelf: 'center' },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  sectionTitle: { fontFamily: typography.bodyBold, color: colors.accent, fontSize: 15, marginBottom: 4 },
  fieldLabel: { fontFamily: typography.bodyBold, color: colors.mutedText, fontSize: 12 },
  fieldValue: { fontFamily: typography.body, color: colors.accent },
  status: { color: colors.secondary, fontFamily: typography.bodyBold },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontFamily: typography.body,
    color: colors.accent,
    backgroundColor: colors.paper
  },
  helperText: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  errorText: {
    fontFamily: typography.body,
    color: colors.danger,
    fontSize: 12
  },
  preferenceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  preferenceLabel: {
    fontFamily: typography.body,
    color: colors.accent
  },
  preferenceToggle: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  preferenceToggleActive: {
    borderColor: colors.secondary,
    backgroundColor: '#ECFDF5'
  },
  preferenceToggleText: {
    fontFamily: typography.bodyBold,
    color: '#475569',
    fontSize: 12
  },
  preferenceToggleTextActive: {
    color: colors.secondary
  },
  walletHero: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.xs,
    shadowColor: '#0F172A',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 3
  },
  walletHeroLabel: {
    fontFamily: typography.bodyBold,
    color: '#93C5FD',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  walletHeroTitle: {
    fontFamily: typography.bodyBold,
    color: '#E2E8F0',
    fontSize: 15
  },
  walletPrimaryValue: {
    fontFamily: typography.heading,
    color: '#7DD3FC',
    fontSize: 22
  },
  walletHeroSubtitle: {
    fontFamily: typography.body,
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18
  },
  walletStatsRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  walletStat: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#172033',
    padding: spacing.xs
  },
  walletStatValue: {
    fontFamily: typography.bodyBold,
    color: '#E2E8F0',
    fontSize: 13
  },
  walletStatLabel: {
    fontFamily: typography.body,
    color: '#94A3B8',
    fontSize: 11
  },
  walletActionGrid: {
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  walletPrimaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#0EA5E9'
  },
  walletPrimaryButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.white
  },
  walletMoreButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#F8FAFC'
  },
  walletMoreButtonText: {
    fontFamily: typography.bodyBold,
    color: '#334155'
  },
  walletStackSection: {
    marginTop: spacing.sm,
    gap: spacing.xs
  },
  walletStackHint: {
    fontFamily: typography.body,
    color: '#64748B',
    fontSize: 12
  },
  walletStackRow: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs + 2,
    paddingRight: spacing.md
  },
  walletMethodCard: {
    width: 208,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    gap: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 3
  },
  walletMethodCardOverlap: {
    marginLeft: -36
  },
  walletMethodCardActive: {
    borderColor: '#0EA5E9',
    backgroundColor: '#E0F2FE'
  },
  walletMethodLabel: {
    fontFamily: typography.bodyBold,
    color: '#1E293B',
    fontSize: 12
  },
  walletMethodUpi: {
    fontFamily: typography.bodyBold,
    color: '#0F172A',
    fontSize: 14
  },
  walletMethodState: {
    fontFamily: typography.body,
    color: '#475569',
    fontSize: 11
  },
  addUpiRow: {
    marginTop: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center'
  },
  addUpiInput: {
    flex: 1
  },
  addUpiButton: {
    minWidth: 72,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#0284C7',
    backgroundColor: '#0284C7',
    paddingVertical: spacing.sm - 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addUpiButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.white
  },
  dynamicQrCard: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    padding: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center'
  },
  dynamicQrTitle: {
    fontFamily: typography.bodyBold,
    color: '#0C4A6E',
    fontSize: 14
  },
  dynamicQrPreview: {
    width: 180,
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    backgroundColor: colors.white
  },
  methodList: {
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  secondaryButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#EFF6FF'
  },
  secondaryText: {
    fontFamily: typography.bodyBold,
    color: '#0369A1'
  },
  logoutButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#FEE2E2'
  },
  logoutText: {
    fontFamily: typography.bodyBold,
    color: '#991B1B'
  }
});
