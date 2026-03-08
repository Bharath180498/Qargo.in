import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
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

interface PickedImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
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
  const uploadPaymentMethodQr = useOnboardingStore((state) => state.uploadPaymentMethodQr);
  const setPreferredPaymentMethod = useOnboardingStore((state) => state.setPreferredPaymentMethod);
  const removePaymentMethod = useOnboardingStore((state) => state.removePaymentMethod);
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
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    void Promise.all([refreshOnboardingStatus(), bootstrap(), loadOnboarding()]);
  }, [bootstrap, loadOnboarding, refreshOnboardingStatus]);

  useEffect(() => {
    setUpiId(onboardingUpiId);
  }, [onboardingUpiId]);

  const savePayoutPreferences = async () => {
    const normalizedUpi = upiId.trim().toLowerCase();
    const upiPattern = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i;

    if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
      Alert.alert('Bank details missing', 'Complete payout bank setup first, then add UPI preferences.');
      return;
    }

    if (!normalizedUpi || !upiPattern.test(normalizedUpi)) {
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
      Alert.alert('Saved', 'Payout UPI preferences updated.');
    } catch {
      Alert.alert('Save failed', useOnboardingStore.getState().error ?? 'Unable to save payout details.');
    } finally {
      setSavingPayout(false);
    }
  };

  const addQrCode = async () => {
    const normalizedUpi = upiId.trim().toLowerCase();
    const upiPattern = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i;

    if (!normalizedUpi || !upiPattern.test(normalizedUpi)) {
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
          <Text style={styles.sectionTitle}>Payout Preferences</Text>
          <Text style={styles.fieldLabel}>UPI ID</Text>
          <TextInput
            style={styles.input}
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            placeholder="driver@okaxis"
            placeholderTextColor={colors.mutedText}
          />
          <Text style={styles.helperText}>Add one or more QR codes and mark one preferred for customer checkout.</Text>
          {onboardingLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {onboardingError ? <Text style={styles.errorText}>{onboardingError}</Text> : null}

          <Pressable style={styles.secondaryButton} onPress={() => void addQrCode()} disabled={savingPayout}>
            <Text style={styles.secondaryText}>Upload QR Code</Text>
          </Pressable>

          <View style={styles.methodList}>
            {paymentMethods.length === 0 ? (
              <Text style={styles.helperText}>No QR codes uploaded yet.</Text>
            ) : (
              paymentMethods.map((method) => (
                <View key={method.id} style={[styles.methodCard, method.isPreferred && styles.methodCardPreferred]}>
                  <View style={styles.methodTopRow}>
                    <View>
                      <Text style={styles.methodTitle}>{method.label ?? 'UPI QR'}</Text>
                      <Text style={styles.methodSubtitle}>{method.upiId}</Text>
                    </View>
                    {method.isPreferred ? <Text style={styles.preferredBadge}>Preferred</Text> : null}
                  </View>
                  {method.qrImageUrl ? <Image source={{ uri: method.qrImageUrl }} style={styles.qrPreview} /> : null}
                  <View style={styles.methodActions}>
                    {!method.isPreferred ? (
                      <Pressable
                        style={styles.actionButton}
                        onPress={() => void setPreferredPaymentMethod(method.id)}
                      >
                        <Text style={styles.actionText}>Set preferred</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.actionButton, styles.actionDanger]}
                      onPress={() => void removePaymentMethod(method.id)}
                    >
                      <Text style={[styles.actionText, styles.actionDangerText]}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <Pressable style={styles.secondaryButton} onPress={() => void savePayoutPreferences()} disabled={savingPayout}>
            {savingPayout ? <ActivityIndicator color={colors.secondary} /> : <Text style={styles.secondaryText}>Save Payout Preferences</Text>}
          </Pressable>
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
  methodList: {
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  methodCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.paper
  },
  methodCardPreferred: {
    borderColor: '#0F766E',
    backgroundColor: '#ECFDF5'
  },
  methodTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  methodTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 13
  },
  methodSubtitle: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  preferredBadge: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: '#0F766E',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  qrPreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white
  },
  methodActions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  actionButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  actionDanger: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2'
  },
  actionText: {
    fontFamily: typography.bodyBold,
    color: '#1D4ED8',
    fontSize: 12
  },
  actionDangerText: {
    color: '#B91C1C'
  },
  secondaryButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#ECFDF5'
  },
  secondaryText: {
    fontFamily: typography.bodyBold,
    color: colors.secondary
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
